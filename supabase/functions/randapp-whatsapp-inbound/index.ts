// Ricezione WhatsApp per RandApp: Twilio (webhook) → segnalazione in randapp.issues.
// Segreto (Supabase → Edge Functions → Secrets), MAI nel repo: TWILIO_AUTH_TOKEN (e TWILIO_ACCOUNT_SID per scaricare le foto).
// Il canale di ogni hotel sta in randapp.whatsapp_channels ed è SPENTO finché enabled=false: in quel caso non si crea nulla.
// Indirizzo da dare a Twilio (solo il giorno del passaggio): https://<progetto>.supabase.co/functions/v1/randapp-whatsapp-inbound
import postgres from "npm:postgres@3.4.7";
import {
  categoryFrom, findRoom, MAX_PHOTO_BYTES, normalizePhone, sniffImage, titleFrom, twilioSignedString, urgencyFrom, xmlEscape,
} from "../_shared/whatsapp-parse.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const token = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const publicUrl = `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")}/functions/v1/randapp-whatsapp-inbound`;
const LIMIT = 12; // messaggi per numero ogni 60 secondi

const twiml = (message = "") =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${xmlEscape(message)}</Message>` : ""}</Response>`, {
    status: 200, headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
  });

async function validSignature(params: URLSearchParams, provided: string | null) {
  if (!token || !provided) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(twilioSignedString(publicUrl, params))));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  const expected = btoa(bin);
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

async function downloadPhoto(url: string | null, type: string | null) {
  try {
    if (!url || !accountSid || !token || !/^image\/(jpeg|png|webp)/i.test(String(type || ""))) return null;
    if (!/^https:\/\/api\.twilio\.com\//.test(url)) return null;
    const res = await fetch(url, { headers: { authorization: "Basic " + btoa(`${accountSid}:${token}`) }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return null;
    const mime = sniffImage(bytes);
    if (!mime) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${mime};base64,${btoa(bin)}`;
  } catch (e) {
    console.error("whatsapp foto", e instanceof Error ? e.message : "errore");
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return Response.json({ ok: true, service: "randapp-whatsapp-inbound" });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!token) return new Response("Twilio non configurato", { status: 503 });

  const params = new URLSearchParams(await req.text());
  if (!(await validSignature(params, req.headers.get("x-twilio-signature")))) return new Response("Forbidden", { status: 403 });

  const from = normalizePhone(params.get("From"));
  const to = normalizePhone(params.get("To"));
  const sid = params.get("MessageSid") || params.get("SmsMessageSid") || "";
  const body = (params.get("Body") || "").trim().slice(0, 2000);
  const numMedia = Math.max(0, Number(params.get("NumMedia") || 0)) || 0;
  if (!from || !to || !sid) return new Response("Bad Request", { status: 400 });

  try {
    const [channel] = await sql`select hotel_id, enabled from randapp.whatsapp_channels where inbound_number = ${to}`;
    if (!channel || !channel.enabled) return twiml(""); // spento: Twilio riceve una risposta vuota, nessun dato salvato
    const hotel = channel.hotel_id as string;

    const [dup] = await sql`select 1 from randapp.whatsapp_inbound where message_sid = ${sid}`;
    if (dup) return twiml("");

    const [{ n }] = await sql`select count(*)::int n from randapp.whatsapp_inbound where from_phone = ${from} and created_at > now() - interval '60 seconds'`;
    if (n >= LIMIT) {
      await sql`insert into randapp.whatsapp_inbound (message_sid, hotel_id, from_phone, body, num_media, status) values (${sid}, ${hotel}, ${from}, '', ${numMedia}, 'rate_limited') on conflict do nothing`;
      return twiml("Troppi messaggi ravvicinati. Attendi un minuto e riprova.");
    }

    if (!body) {
      await sql`insert into randapp.whatsapp_inbound (message_sid, hotel_id, from_phone, body, num_media, status) values (${sid}, ${hotel}, ${from}, '', ${numMedia}, 'needs_info') on conflict do nothing`;
      return twiml("Ho ricevuto il messaggio. Scrivi anche camera o zona e il problema, così creo la segnalazione.");
    }

    const locations = await sql`select name, aliases from randapp.hotel_locations where hotel_id = ${hotel} and active limit 500`;
    const room = findRoom(hotel, body, locations as unknown as { name: string; aliases: string[] }[]);
    const category = categoryFrom(body);
    const urgency = urgencyFrom(body);
    const title = titleFrom(body, room);
    const description = body.length > title.length ? body : null;
    const photo = numMedia > 0 ? await downloadPhoto(params.get("MediaUrl0"), params.get("MediaContentType0")) : null;

    // Nome: chi ha questo numero nel profilo (stessa regola di link_issue_senders), altrimenti "WhatsApp +39…".
    const [person] = await sql`
      select auth_user_id, coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), display_name) as shown
        from randapp.profiles where phone = ${from} and active order by created_at nulls last limit 1`;

    const issue = await sql.begin(async (tx) => {
      const [row] = await tx`
        insert into randapp.issues (hotel_id, title, description, category, urgency, status, room, source, created_by, created_by_name, created_by_phone)
        values (${hotel}, ${title}, ${description}, ${category}, ${urgency}, 'da_fare', ${room}, 'whatsapp',
                ${person?.auth_user_id ?? null}, ${person?.shown ?? `WhatsApp ${from}`}, ${from})
        returning id`;
      if (photo) await tx`insert into randapp.issue_photos (hotel_id, issue_id, kind, data_url) values (${hotel}, ${row.id}, 'prima', ${photo})`;
      await tx`insert into randapp.whatsapp_inbound (message_sid, hotel_id, from_phone, body, num_media, status, issue_id)
               values (${sid}, ${hotel}, ${from}, ${body}, ${numMedia}, 'created', ${row.id})`;
      return row;
    });

    const where = room ? ` per ${/^\d/.test(room) ? "camera " : ""}${room}` : "";
    const note = numMedia > 0 && !photo ? " (la foto non è stata allegata: troppo pesante o non valida)" : "";
    console.log("whatsapp segnalazione creata", issue.id);
    return twiml(`Segnalazione ricevuta${where} · ${category}.${note} Grazie!`);
  } catch (e) {
    // Messaggio già registrato come duplicato (race) → risposta vuota; altrimenti errore vero, Twilio riprova.
    if ((e as { code?: string })?.code === "23505") return twiml("");
    console.error("whatsapp inbound errore", e instanceof Error ? e.message : "errore");
    return new Response("Errore", { status: 500 });
  }
});
