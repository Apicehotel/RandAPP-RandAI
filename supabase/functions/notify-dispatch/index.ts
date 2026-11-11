// Invia le notifiche in coda (tabella notification_deliveries) ai canali fuori dall'app:
// web push, ntfy, WhatsApp. Le app Android/iOS useranno lo stesso schema (FCM/APNs): per ora "non configurato".
// Si chiama ogni minuto (pg_cron, vedi README) con l'intestazione x-sync-secret.
// Postgres diretto (SUPABASE_DB_URL), come ewelink-sync. Segreti: variabili della funzione o `edge_function_secrets`.
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), NTFY_BASE (default https://ntfy.sh), NTFY_TOKEN,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (mittente di riserva), APP_URL (indirizzo dell'app per aprire il link)
//   Il modello WhatsApp (ContentSid HX…) sta nella configurazione del canale: notification_channels.config → from (mittente della struttura), content_sid, variables, templates.
import postgres from "npm:postgres@3.4.7";
import webpush from "npm:web-push@3.6.7";
import { isGone, payloadOf, pickSender, pickTemplate, planDelivery, romeTime, sendNtfy, sendWhatsApp, whatsappVariables } from "../_shared/notify.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const MAX_ATTEMPTS = 3;
const BATCH = 50;
const HOTEL_NAMES: Record<string, string> = { hotelgio: "Hotel Giò", chocohotel: "Chocohotel", brigantino: "Hotel Il Brigantino" };

async function secret(name: string): Promise<string | null> {
  const v = Deno.env.get(name);
  if (v) return v;
  try {
    // Nel progetto condiviso le chiavi VAPID si chiamano vapid_public / vapid_private.
    const alias: Record<string, string> = { VAPID_PUBLIC_KEY: "vapid_public", VAPID_PRIVATE_KEY: "vapid_private" };
    const rows = await sql`select value from public.edge_function_secrets where key = ${alias[name] ?? name.toLowerCase()} limit 1`;
    return rows[0]?.value ? String(rows[0].value) : null;
  } catch {
    return null;
  }
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
    const provided = req.headers.get("x-sync-secret");
    const expected = (await secret("NOTIFY_SYNC_SECRET")) ?? (await secret("SENSOR_SYNC_SECRET"));
    if (!provided || !expected || !sameSecret(provided, expected)) return json({ ok: false, error: "Non autorizzato" }, 401);

    const [vapidPub, vapidPriv, vapidSub, ntfyBase, ntfyToken, twSid, twToken, twFrom, appUrl] = await Promise.all([
      secret("VAPID_PUBLIC_KEY"), secret("VAPID_PRIVATE_KEY"), secret("VAPID_SUBJECT"), secret("NTFY_BASE"),
      secret("NTFY_TOKEN"), secret("TWILIO_ACCOUNT_SID"), secret("TWILIO_AUTH_TOKEN"), secret("TWILIO_WHATSAPP_FROM"), secret("APP_URL"),
    ]);
    const env = { hasVapid: !!(vapidPub && vapidPriv), hasNtfy: true, hasWhatsApp: !!(twSid && twToken) };
    if (env.hasVapid) webpush.setVapidDetails(vapidSub || "mailto:admin@example.com", vapidPub!, vapidPriv!);

    // Prende un blocco di consegne e le "prenota" (skip locked: due chiamate insieme non si pestano i piedi).
    const rows = await sql`
      with picked as (
        select id from randapp.notification_deliveries
        where status = 'pending' and attempts < ${MAX_ATTEMPTS}
        order by created_at limit ${BATCH} for update skip locked
      ), bumped as (
        update randapp.notification_deliveries d set attempts = d.attempts + 1
        from picked where d.id = picked.id returning d.id, d.attempts
      )
      select d.id, d.channel, b.attempts, n.kind, n.hotel_id, n.title, n.body, n.link, n.priority, n.created_at as notified_at,
             ua.created_at as alert_created_at, pr.display_name as sender,
             iss.room as issue_room, iss.category as issue_category, iss.urgency as issue_urgency, iss.created_at as issue_created_at,
             v.platform, v.token, v.keys, v.id as device_id,
             c.config as config
      from bumped b
      join randapp.notification_deliveries d on d.id = b.id
      join randapp.notifications n on n.id = d.notification_id
      left join randapp.urgent_alerts ua on ua.id = n.ref_id and n.kind in ('urgent_alert', 'urgent_reminder')
      left join randapp.profiles pr on pr.auth_user_id = ua.created_by
      left join randapp.issues iss on iss.id = n.ref_id and n.kind = 'issue_urgent'
      left join randapp.notification_devices v on v.id = d.device_id
      left join randapp.notification_channels c on c.hotel_id = n.hotel_id and c.channel = d.channel`;

    let sent = 0, failed = 0, skipped = 0;
    for (const r of rows) {
      const tpl = pickTemplate(r.config, r.kind, r.priority);
      const from = pickSender(r.config, twFrom);
      const plan = planDelivery({ ...r, content_sid: tpl.contentSid, from }, env);
      const payload = payloadOf(r, appUrl ?? "");
      try {
        if (plan.startsWith("skip:")) {
          await sql`update randapp.notification_deliveries set status = 'skipped', error = ${plan.slice(5)} where id = ${r.id}`;
          skipped += 1;
          continue;
        }
        if (plan === "ntfy") await sendNtfy({ base: ntfyBase ?? "https://ntfy.sh", topic: r.token, token: ntfyToken ?? undefined, payload });
        else if (plan === "whatsapp") {
          await sendWhatsApp({
            accountSid: twSid!, authToken: twToken!, from, to: r.token, contentSid: tpl.contentSid,
            variables: whatsappVariables(tpl.variables, payload, {
              hotel: HOTEL_NAMES[r.hotel_id] ?? r.hotel_id,
              sender: r.sender || "RandApp", // chi ha creato l'avviso (per i promemoria: l'autore originale)
              time: romeTime(r.alert_created_at ?? r.issue_created_at ?? r.notified_at), // ora di CREAZIONE dell'avviso/segnalazione, anche nei promemoria
              room: r.issue_room || "non indicata",
              category: String(r.issue_category ?? "").toLowerCase(),
              urgency: r.issue_urgency ?? "",
              note: (r.kind === "urgent_reminder" ? "PROMEMORIA - " : "") + (r.body ?? ""),
            }),
          });
        }
        else if (plan === "web") {
          await webpush.sendNotification({ endpoint: r.token, keys: r.keys }, JSON.stringify(payload), { TTL: 3600, urgency: payload.urgent ? "high" : "normal" });
        }
        await sql`update randapp.notification_deliveries set status = 'sent', sent_at = now(), error = null where id = ${r.id}`;
        sent += 1;
      } catch (e) {
        if (plan === "web" && isGone(e)) {
          await sql`update randapp.notification_devices set active = false where id = ${r.device_id}`;
          await sql`update randapp.notification_deliveries set status = 'skipped', error = 'abbonamento scaduto' where id = ${r.id}`;
          skipped += 1;
          continue;
        }
        const msg = String((e as Error)?.message ?? e).slice(0, 120); // niente segreti: solo il tipo di errore
        const final = r.attempts >= MAX_ATTEMPTS;
        await sql`update randapp.notification_deliveries set status = ${final ? "failed" : "pending"}, error = ${msg} where id = ${r.id}`;
        failed += 1;
      }
    }
    return json({ ok: true, picked: rows.length, sent, failed, skipped });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) }, 500);
  }
});
