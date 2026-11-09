// Recupero PIN: email via link o WhatsApp OTP (Twilio Authentication). Invii WhatsApp disabilitati per default.
// Segreti della funzione (Supabase → Edge Functions → Secrets), MAI nel repo:
//   GMAIL_USER          indirizzo Gmail mittente
//   GMAIL_APP_PASSWORD  "password per le app" di Google (16 caratteri), non la password dell'account
//   APP_URL             (facoltativo) indirizzo dell'app, default https://randapphotel.vercel.app
// Gmail SMTP sulla porta 465 (le porte 25 e 587 sono bloccate dalle Edge Function di Supabase).
// Risposta di "request" sempre uguale (esista o no l'email) e con attesa minima: non si scopre chi ha un'email.
import postgres from "npm:postgres@3.4.7";
import bcrypt from "npm:bcryptjs@2.4.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const gmailUser = Deno.env.get("GMAIL_USER") || "";
const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
const appUrl = (Deno.env.get("APP_URL") || "https://randapphotel.vercel.app").replace(/\/$/, "");
const configured = Boolean(gmailUser && gmailPass);
const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM") || "";
const whatsappContentSid = Deno.env.get("TWILIO_PIN_CONTENT_SID") || "";
const otpPepper = Deno.env.get("TWILIO_OTP_PEPPER") || "";
// Il flag è volutamente spento: nessun messaggio a pagamento senza consenso esplicito.
const whatsappEnabled = Deno.env.get("TWILIO_RECOVERY_ENABLED") === "true"
  && /^AC[0-9a-f]{32}$/i.test(twilioSid)
  && /^HX[0-9a-f]{32}$/i.test(whatsappContentSid)
  && /^whatsapp:\+[1-9][0-9]{7,14}$/.test(whatsappFrom)
  && Boolean(twilioToken && otpPepper.length >= 32);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const TTL_MS = 15 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT_PER_USER = 3;
const LIMIT_PER_SOURCE = 10;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Conta una richiesta nella finestra di un'ora; false se il limite è superato.
async function consume(key: string, limit: number) {
  const [row] = await sql`
    insert into randapp.pin_recovery_limits (key, count, window_at) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when randapp.pin_recovery_limits.window_at < now() - ${WINDOW_MS / 1000} * interval '1 second' then 1 else randapp.pin_recovery_limits.count + 1 end,
      window_at = case when randapp.pin_recovery_limits.window_at < now() - ${WINDOW_MS / 1000} * interval '1 second' then now() else randapp.pin_recovery_limits.window_at end
    returning count`;
  return Number(row.count) <= limit;
}

async function sendMail(to: string, name: string, link: string) {
  const client = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
  });
  try {
    await client.send({
      from: `RandApp <${gmailUser}>`,
      to,
      subject: "RandApp · Recupero PIN",
      content: `Ciao ${name},\n\nè stato richiesto il recupero del PIN di RandApp.\nApri questo link entro 15 minuti (vale una volta sola):\n${link}\n\nSe non l'hai richiesto tu, ignora questa email: il tuo PIN non cambia.`,
    });
  } finally {
    await client.close();
  }
}

async function sendWhatsapp(to: string, otp: string) {
  const body = new URLSearchParams({
    From: whatsappFrom,
    To: `whatsapp:${to}`,
    ContentSid: whatsappContentSid,
    ContentVariables: JSON.stringify({ "1": otp }),
  });
  const auth = btoa(`${twilioSid}:${twilioToken}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  // Non loggare numeri, codici o payload restituiti da Twilio.
  if (!res.ok) throw new Error("WhatsApp non disponibile");
}
async function whatsappTokenHash(userId: string, otp: string) {
  return sha256(`randapp:whatsapp-recovery:${userId}:${otp}:${otpPepper}`);
}
async function requestRecovery(req: Request, userId: string, channel: string) {
  if (channel !== "email" && channel !== "whatsapp") return json({ ok: false, error: "Canale non valido" }, 400);
  if (channel === "whatsapp" && !whatsappEnabled) return json({ ok: false, error: "WhatsApp non ancora attivo. Seleziona email." }, 503);
  const started = Date.now();
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const sourceKey = `ip:${(await sha256(ip)).slice(0, 24)}`;
  if (/^[0-9a-f-]{36}$/i.test(userId) && (await consume(sourceKey, LIMIT_PER_SOURCE)) && (await consume(`user:${userId}`, LIMIT_PER_USER))) {
    const [person] = await sql`
      select p.auth_user_id, p.display_name, p.email, p.phone from randapp.profiles p
       where p.auth_user_id = ${userId} and p.active
         and (case when ${channel} = 'email' then p.email is not null
                   else p.phone ~ '^\\+[1-9][0-9]{7,14}
         and exists (select 1 from randapp.hotel_memberships m where m.auth_user_id = p.auth_user_id and m.active)`;
    if (person && (channel === "whatsapp" ? whatsappEnabled : configured)) {
      const raw = channel === "email" ? crypto.randomUUID() + crypto.randomUUID() : "";
      const otp = channel === "whatsapp"
        ? String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0")
        : "";
      const digest = channel === "email"
        ? await sha256(raw)
        : await whatsappTokenHash(String(person.auth_user_id), otp);
      await sql`update randapp.pin_recovery_requests set used_at = now() where auth_user_id = ${person.auth_user_id} and used_at is null`;
      await sql`insert into randapp.pin_recovery_requests (auth_user_id, token_hash, expires_at) values (${person.auth_user_id}, ${digest}, ${new Date(Date.now() + TTL_MS)})`;
      try {
        if (channel === "email") {
          await sendMail(String(person.email), String(person.display_name || ""), `${appUrl}/#/recover?token=${encodeURIComponent(raw)}`);
        } else {
          await sendWhatsapp(String(person.phone), otp);
        }
      } catch {
        await sql`update randapp.pin_recovery_requests set used_at = now() where token_hash = ${digest} and used_at is null`;
        console.error("pin-recovery delivery failed", channel);
      }
    }
    await sql`delete from randapp.pin_recovery_requests where expires_at < now() - interval '1 day'`;
  }
  const wait = Math.max(0, 600 - (Date.now() - started));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  return json({ ok: true });
}

async function complete(token: string, newPin: string, channel: string, userId: string, otp: string) {
  if (!/^\\d{4}$/.test(newPin)) return json({ ok: false, error: "PIN non valido" }, 400);
  let digest: string;
  if (channel === "whatsapp") {
    if (!whatsappEnabled || !/^[0-9a-f-]{36}$/i.test(userId) || !/^\\d{6}$/.test(otp)) {
      return json({ ok: false, error: "Codice non valido" }, 400);
    }
    // Limite cumulativo tra richieste per lo stesso utente, contro tentativi di indovinare l'OTP.
    if (!await consume(`verify:${userId}`, 5)) return json({ ok: false, error: "Troppi tentativi. Riprova più tardi." }, 429);
    digest = await whatsappTokenHash(userId, otp);
  } else if (channel === "email" && token.length >= 40) {
    digest = await sha256(token);
  } else {
    return json({ ok: false, error: "Link o codice non valido" }, 400);
  }
  const hash = await bcrypt.hash(newPin, 10);
  // Blocco della riga e consumo del token nella STESSA transazione: due chiamate concorrenti
  // non possono usare lo stesso codice due volte o riscrivere di nuovo il PIN.
  const updated = await sql.begin(async (tx) => {
    const [rec] = await tx`select id, auth_user_id, expires_at, used_at
      from randapp.pin_recovery_requests where token_hash = ${digest} for update`;
    if (!rec || rec.used_at || new Date(rec.expires_at).getTime() <= Date.now()) return false;
    if (channel === "whatsapp" && String(rec.auth_user_id) !== userId) return false;
    await tx`update randapp.auth_pin_credentials
       set pin_hash = ${hash}, failed_attempts = 0, locked_until = null,
           must_change_pin = false, updated_at = now()
       where auth_user_id = ${rec.auth_user_id}`;
    await tx`update randapp.pin_recovery_requests set used_at = now() where id = ${rec.id}`;
    return true;
  });
  return updated ? json({ ok: true }) : json({ ok: false, error: "Link o codice non valido o scaduto" }, 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "");
    if (action === "status") return json({ ok: true, configured, whatsapp_enabled: whatsappEnabled });
    if (action === "request") return await requestRecovery(req, String(body?.user_id || "").trim(), String(body?.channel || "email"));
    if (action === "complete") return await complete(String(body?.token || "").trim(), String(body?.new_pin || "").trim(), String(body?.channel || "email"), String(body?.user_id || "").trim(), String(body?.otp || "").trim());
    return json({ ok: false, error: "Azione non valida" }, 400);
  } catch (error) {
    console.error("pin-recovery", error instanceof Error ? error.message : "errore");
    return json({ ok: false, error: "Recupero PIN temporaneamente non disponibile" }, 503);
  }
});
 end)
         and exists (select 1 from randapp.hotel_memberships m where m.auth_user_id = p.auth_user_id and m.active)`;
    if (person && configured) {
      const raw = crypto.randomUUID() + crypto.randomUUID();
      await sql`update randapp.pin_recovery_requests set used_at = now() where auth_user_id = ${person.auth_user_id} and used_at is null`;
      await sql`insert into randapp.pin_recovery_requests (auth_user_id, token_hash, expires_at) values (${person.auth_user_id}, ${await sha256(raw)}, ${new Date(Date.now() + TTL_MS)})`;
      try {
        await sendMail(String(person.email), String(person.display_name || ""), `${appUrl}/#/recover?token=${encodeURIComponent(raw)}`);
      } catch (e) {
        console.error("pin-recovery mail", e instanceof Error ? e.message : "errore");
      }
    }
    await sql`delete from randapp.pin_recovery_requests where expires_at < now() - interval '1 day'`;
  }
  const wait = Math.max(0, 600 - (Date.now() - started));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  return json({ ok: true });
}

async function complete(token: string, newPin: string) {
  if (token.length < 40 || !/^\d{4}$/.test(newPin)) return json({ ok: false, error: "Link non valido o PIN non valido" }, 400);
  const [rec] = await sql`select id, auth_user_id, expires_at, used_at from randapp.pin_recovery_requests where token_hash = ${await sha256(token)}`;
  if (!rec || rec.used_at || new Date(rec.expires_at).getTime() <= Date.now()) return json({ ok: false, error: "Link non valido o scaduto" }, 400);
  const hash = await bcrypt.hash(newPin, 10);
  await sql.begin(async (tx) => {
    await tx`
      insert into randapp.auth_pin_credentials (auth_user_id, pin_hash, failed_attempts, locked_until, must_change_pin, updated_at)
      values (${rec.auth_user_id}, ${hash}, 0, null, false, now())
      on conflict (auth_user_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, must_change_pin = false, updated_at = now()`;
    await tx`update randapp.pin_recovery_requests set used_at = now() where auth_user_id = ${rec.auth_user_id} and used_at is null`;
  });
  return json({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "");
    if (action === "status") return json({ ok: true, configured });
    if (action === "request") return await requestRecovery(req, String(body?.user_id || "").trim());
    if (action === "complete") return await complete(String(body?.token || "").trim(), String(body?.new_pin || "").trim());
    return json({ ok: false, error: "Azione non valida" }, 400);
  } catch (error) {
    console.error("pin-recovery", error instanceof Error ? error.message : "errore");
    return json({ ok: false, error: "Recupero PIN temporaneamente non disponibile" }, 503);
  }
});
