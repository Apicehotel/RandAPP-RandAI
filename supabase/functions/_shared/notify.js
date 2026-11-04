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

// WhatsApp Cloud API (Meta): fuori dalle 24 ore serve un modello approvato.
// Il modello ha 2 variabili: {{1}} titolo, {{2}} testo.
export async function sendWhatsApp({ token, phoneId, to, template, language = 'it', payload, fetchFn = fetch }) {
  const res = await fetchFn(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(to).replace(/[^\d]/g, ''),
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [{ type: 'body', parameters: [
          { type: 'text', text: clip(payload.title, 60) },
          { type: 'text', text: clip(payload.body, 200).replace(/\s+/g, ' ') },
        ] }],
      },
    }),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}`);
}

// Esito di un errore di web push: abbonamento scaduto (410/404) = da disattivare.
export const isGone = (e) => e && (e.statusCode === 410 || e.statusCode === 404);

// Decide cosa fare con una consegna (usato dal dispatcher).
export function planDelivery(row, env) {
  if (row.channel === 'ntfy') return env.hasNtfy ? 'ntfy' : 'skip:ntfy non configurato';
  if (row.channel === 'whatsapp') return env.hasWhatsApp && row.template ? 'whatsapp' : 'skip:WhatsApp non configurato';
  if (row.channel === 'push') {
    if (row.platform === 'web') return env.hasVapid ? 'web' : 'skip:chiavi web push mancanti';
    return 'skip:app nativa non ancora configurata'; // android/ios: FCM/APNs arriveranno con le app
  }
  return 'skip:canale sconosciuto';
}
