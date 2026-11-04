import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { payloadOf, planDelivery, sendNtfy, sendWhatsApp, isGone } from '../supabase/functions/_shared/notify.js';

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

test('whatsapp: modello con 2 variabili, numero solo cifre', async () => {
  const calls = [];
  await sendWhatsApp({ token: 't', phoneId: '123', to: '+39 333 1234567', template: 'avviso', payload: { title: 'A', body: 'B\nC' }, fetchFn: ok(calls) });
  const b = JSON.parse(calls[0].init.body);
  assert.equal(b.to, '393331234567');
  assert.equal(b.template.components[0].parameters.length, 2);
  assert.equal(b.template.components[0].parameters[1].text, 'B C');
});

test('piano: canali non configurati sono saltati, native in attesa', () => {
  const env = { hasVapid: false, hasNtfy: true, hasWhatsApp: false };
  assert.equal(planDelivery({ channel: 'ntfy' }, env), 'ntfy');
  assert.match(planDelivery({ channel: 'whatsapp', template: 'x' }, env), /^skip:/);
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
