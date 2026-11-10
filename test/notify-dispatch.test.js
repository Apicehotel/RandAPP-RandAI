import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { payloadOf, planDelivery, sendNtfy, sendWhatsApp, isGone, whatsappVariables, pickTemplate, pickSender, DEFAULT_VARIABLES } from '../supabase/functions/_shared/notify.js';

const ok = (calls) => async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };

test('payload: urgente e link', () => {
  const p = payloadOf({ title: 'T', body: 'B', link: '/task/urgent', priority: 'urgent', kind: 'urgent_alert' }, 'https://x.it/');
  assert.equal(p.urgent, true);
  assert.equal(p.url, 'https://x.it/#/task/urgent');
});

test('ntfy: POST JSON sul topic, priorità alta se urgente', async () => {
  const calls = [];
  await sendNtfy({ base: 'https://ntfy.sh/', topic: 'abc', payload: { title: 'Àvviso', body: 'x', urgent: true }, fetchFn: ok(calls) });
  const b = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, 'https://ntfy.sh');
  assert.equal(b.topic, 'abc'); assert.equal(b.priority, 5);
});

test('ntfy: errore HTTP lancia senza rivelare il token', async () => {
  await assert.rejects(
    sendNtfy({ base: 'https://n', topic: 't', token: 'SEGRETO', payload: { title: 'a', body: 'b' }, fetchFn: async () => ({ ok: false, status: 403 }) }),
    (e) => e.message === 'ntfy 403' && !e.message.includes('SEGRETO'),
  );
});

const SID = 'HX' + 'a1b2c3d4'.repeat(4);

test('whatsapp (Twilio): modello con ContentSid e variabili, numeri in formato whatsapp:+…', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201, json: async () => ({ sid: 'SM1', status: 'queued' }) }; };
  const r = await sendWhatsApp({ accountSid: 'ACxx', authToken: 'TOK', from: '+39 06 1234567', to: '393331234567', contentSid: SID, variables: { 1: 'A', 2: 'B' }, fetchFn });
  assert.deepEqual(r, { sid: 'SM1', status: 'queued' });
  assert.equal(calls[0].url, 'https://api.twilio.com/2010-04-01/Accounts/ACxx/Messages.json');
  const form = Object.fromEntries(new URLSearchParams(calls[0].init.body));
  assert.deepEqual(form, { From: 'whatsapp:+39061234567', To: 'whatsapp:+393331234567', ContentSid: SID, ContentVariables: '{"1":"A","2":"B"}' });
  assert.equal(calls[0].init.headers.Authorization, `Basic ${btoa('ACxx:TOK')}`);
  // numeri già con prefisso whatsapp: non si raddoppia
  await sendWhatsApp({ accountSid: 'ACxx', authToken: 'TOK', from: 'whatsapp:+39061234567', to: 'whatsapp:+393331234567', contentSid: SID, variables: {}, fetchFn });
  assert.equal(Object.fromEntries(new URLSearchParams(calls[1].init.body)).To, 'whatsapp:+393331234567');
});

test('whatsapp (Twilio): un errore dà solo stato e codice, mai il testo libero né i segreti', async () => {
  const fetchFn = async () => ({ ok: false, status: 400, json: async () => ({ code: 63016, message: 'Il numero +393331234567 è fuori finestra' }) });
  await assert.rejects(
    sendWhatsApp({ accountSid: 'ACxx', authToken: 'SEGRETO', from: '+390612', to: '+393331234567', contentSid: SID, variables: {}, fetchFn }),
    (e) => e.message === 'twilio 400 codice 63016' && !/SEGRETO|3331234567/.test(e.message),
  );
  await assert.rejects(sendWhatsApp({ accountSid: 'ACxx', authToken: 't', from: '+39', to: '+39', contentSid: SID, variables: {}, fetchFn: async () => ({ ok: false, status: 500, json: async () => { throw new Error('non json') } }) }), { message: 'twilio 500' });
});

test('whatsappVariables: titolo e testo di default, una riga sola, mai vuote', () => {
  assert.deepEqual(DEFAULT_VARIABLES, ['title', 'body']);
  assert.deepEqual(whatsappVariables(undefined, { title: 'Avviso urgente', body: 'Allagamento\n\npiano   2' }), { 1: 'Avviso urgente', 2: 'Allagamento piano 2' });
  assert.deepEqual(whatsappVariables(['title', 'body'], { title: 'T', body: null }), { 1: 'T', 2: '-' }); // WhatsApp rifiuta variabili vuote
  assert.deepEqual(whatsappVariables(['hotel', 'title', 'body', 'url'], { title: 'T', body: 'B', url: 'https://app/#/x' }, { hotel: 'Hotel Giò' }), { 1: 'Hotel Giò', 2: 'T', 3: 'B', 4: 'https://app/#/x' })
  assert.equal(whatsappVariables(['title'], { title: 'x'.repeat(300) })[1].length, 60)
  assert.deepEqual(whatsappVariables(['sconosciuto'], { title: 'T' }), { 1: '-' })
});

test('pickTemplate: modello della struttura, con eccezioni per tipo di notifica; un SID non valido non si usa', () => {
  const OTHER = 'HX' + '0f'.repeat(16);
  const cfg = { content_sid: SID, variables: ['title', 'body'], templates: { issue_urgent: { content_sid: OTHER, variables: ['hotel', 'body'] } } };
  assert.deepEqual(pickTemplate(cfg, 'urgent_alert'), { contentSid: SID, variables: ['title', 'body'] });
  assert.deepEqual(pickTemplate(cfg, 'issue_urgent'), { contentSid: OTHER, variables: ['hotel', 'body'] });
  assert.equal(pickTemplate({ content_sid: 'avviso' }, 'urgent_alert').contentSid, '');
  assert.equal(pickTemplate(null, 'x').contentSid, '');
  assert.equal(pickTemplate({}, 'x').contentSid, '');
});

test('piano: canali non configurati sono saltati, native in attesa', () => {
  const env = { hasVapid: false, hasNtfy: true, hasWhatsApp: false };
  assert.equal(planDelivery({ channel: 'ntfy' }, env), 'ntfy');
  assert.match(planDelivery({ channel: 'whatsapp', content_sid: SID, from: '+39061234567' }, env), /Twilio non configurato/);
  assert.match(planDelivery({ channel: 'whatsapp', from: '+39061234567' }, { ...env, hasWhatsApp: true }), /modello WhatsApp non impostato/);
  assert.match(planDelivery({ channel: 'whatsapp', content_sid: SID }, { ...env, hasWhatsApp: true }), /mittente WhatsApp non impostato/);
  assert.equal(planDelivery({ channel: 'whatsapp', content_sid: SID, from: '+39061234567' }, { ...env, hasWhatsApp: true }), 'whatsapp');
  assert.match(planDelivery({ channel: 'push', platform: 'web' }, env), /^skip:/);
  assert.equal(planDelivery({ channel: 'push', platform: 'web' }, { ...env, hasVapid: true }), 'web');
  assert.match(planDelivery({ channel: 'push', platform: 'android' }, { ...env, hasVapid: true }), /nativa/);
});

test('isGone riconosce abbonamenti scaduti', () => {
  assert.ok(isGone({ statusCode: 410 })); assert.ok(isGone({ statusCode: 404 })); assert.ok(!isGone({ statusCode: 500 }));
});

test('dispatcher: Postgres diretto, niente service_role, niente log di segreti', () => {
  const src = readFileSync(new URL('../supabase/functions/notify-dispatch/index.ts', import.meta.url), 'utf8');
  assert.match(src, /SUPABASE_DB_URL/);
  assert.doesNotMatch(src, /service_role|createClient/);
  assert.doesNotMatch(src, /console\.(log|error)/);
  assert.match(src, /skip locked/);
});

test('pickSender: il mittente è della struttura; quello di riserva solo se manca; valori non validi non si usano', () => {
  assert.equal(pickSender({ from: '+39 075 9970 000' }, '+39061111111'), '+390759970000');
  assert.equal(pickSender({ from: 'whatsapp:+390759970000' }, ''), '+390759970000');
  assert.equal(pickSender({}, '+39061111111'), '+39061111111'); // nessun mittente della struttura: riserva
  assert.equal(pickSender({ from: '0759970000' }, '+39061111111'), '+39061111111'); // senza + non è internazionale
  assert.equal(pickSender({ from: 'abc' }, 'xyz'), '');
  assert.equal(pickSender(null, undefined), '');
});
