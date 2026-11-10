// Adattatori di invio notifiche (puri: ricevono `fetchFn`, così si provano senza rete).
// Nessun segreto viene mai scritto nei log né negli errori.

const clip = (s, n) => String(s ?? '').slice(0, n);

export function payloadOf(n, baseUrl = '') {
  const link = n.link ? `${baseUrl}#${n.link}` : baseUrl || undefined;
  return {
    title: clip(n.title, 120),
    body: clip(n.body, 300),
    url: link,
    urgent: n.priority === 'urgent',
    tag: n.kind,
  };
}

// ntfy: POST sul topic personale. Le intestazioni HTTP devono essere ASCII: il titolo va in JSON.
export async function sendNtfy({ base, topic, token, payload, fetchFn = fetch }) {
  const res = await fetchFn(base.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      topic,
      title: payload.title,
      message: payload.body,
      priority: payload.urgent ? 5 : 3,
      tags: [payload.urgent ? 'rotating_light' : 'bell'],
      click: payload.url,
    }),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}

// ---- WhatsApp via Twilio (stesso account e stessi modelli «Content» di Multihotel)
// Fuori dalle 24 ore dall'ultimo messaggio della persona WhatsApp accetta solo modelli approvati: si invia sempre un modello
// (`ContentSid`) con le sue variabili {{1}}, {{2}}… Nessun segreto nei log né negli errori (nemmeno il testo libero di Twilio, che può contenere il numero).

// WhatsApp non accetta a capo, tab o spazi ripetuti dentro le variabili, né variabili vuote.
const oneLine = (s, n) => clip(String(s ?? '').replace(/\s+/g, ' ').trim(), n)

// Quali campi della notifica riempiono {{1}}, {{2}}… del modello. Di default: titolo e testo (modello a 2 variabili).
export const DEFAULT_VARIABLES = ['title', 'body'];
const FIELD_LIMIT = { title: 60, body: 200, kind: 40, url: 200, hotel: 60 };
export function whatsappVariables(spec, payload, ctx = {}) {
  const fields = Array.isArray(spec) && spec.length ? spec : DEFAULT_VARIABLES;
  const values = { title: payload.title, body: payload.body, kind: payload.tag, url: payload.url, hotel: ctx.hotel };
  return Object.fromEntries(fields.map((f, i) => [String(i + 1), oneLine(values[f], FIELD_LIMIT[f] ?? 100) || '-']));
}

// Modello da usare: quello specifico del tipo di notifica (`templates.<kind>`) oppure quello della struttura.
// `config` viene da notification_channels.config: { content_sid, variables?, templates?: { <kind>: { content_sid, variables? } } }
export function pickTemplate(config, kind) {
  const c = config && typeof config === 'object' ? config : {};
  const own = c.templates && typeof c.templates === 'object' ? c.templates[kind] : null;
  const sid = String((own && own.content_sid) || c.content_sid || '');
  return { contentSid: /^HX[0-9a-f]{32}$/i.test(sid) ? sid : '', variables: (own && own.variables) || c.variables };
}

// Mittente WhatsApp della struttura (ogni struttura ha il suo numero): `config.from` in formato +39…; in mancanza, quello di riserva (`TWILIO_WHATSAPP_FROM`).
export function pickSender(config, fallback) {
  const own = config && typeof config === 'object' ? String(config.from || '').replace(/^whatsapp:/i, '').replace(/[\s-]/g, '') : '';
  if (/^\+[1-9][0-9]{7,14}$/.test(own)) return own;
  const alt = String(fallback || '').replace(/^whatsapp:/i, '').replace(/[\s-]/g, '');
  return /^\+[1-9][0-9]{7,14}$/.test(alt) ? alt : '';
}

const waAddress = (n) => {
  const d = String(n).replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');
  return `whatsapp:${d.startsWith('+') ? d : `+${d}`}`;
};

export async function sendWhatsApp({ accountSid, authToken, from, to, contentSid, variables, fetchFn = fetch }) {
  const res = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
    body: new URLSearchParams({ From: waAddress(from), To: waAddress(to), ContentSid: contentSid, ContentVariables: JSON.stringify(variables) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`twilio ${res.status}${data?.code ? ` codice ${data.code}` : ''}`);
  return { sid: data?.sid || null, status: data?.status || null };
}

// Esito di un errore di web push: abbonamento scaduto (410/404) = da disattivare.
export const isGone = (e) => e && (e.statusCode === 410 || e.statusCode === 404);

// Decide cosa fare con una consegna (usato dal dispatcher).
export function planDelivery(row, env) {
  if (row.channel === 'ntfy') return env.hasNtfy ? 'ntfy' : 'skip:ntfy non configurato';
  if (row.channel === 'whatsapp') {
    if (!env.hasWhatsApp) return 'skip:Twilio non configurato';
    if (!row.from) return 'skip:mittente WhatsApp non impostato';
    return row.content_sid ? 'whatsapp' : 'skip:modello WhatsApp non impostato';
  }
  if (row.channel === 'push') {
    if (row.platform === 'web') return env.hasVapid ? 'web' : 'skip:chiavi web push mancanti';
    return 'skip:app nativa non ancora configurata'; // android/ios: FCM/APNs arriveranno con le app
  }
  return 'skip:canale sconosciuto';
}
