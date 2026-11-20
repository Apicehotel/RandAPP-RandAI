import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { technicianWaLink } from '../src/lib/technician-wa.js'
import { issueTimeline } from '../src/lib/issue-timeline.js'
import { tokenFromPortalRoute, toLocalInput } from '../src/lib/technician-portal.js'

const T = 'a'.repeat(64)
test('il messaggio WhatsApp contiene il link solo se c\'è', () => {
  const issue = { room: '204', category: 'Idraulica', title: 'Perde', urgency: 'alta' }
  const tech = { name: 'Pecetti', phone: '+390000000000' }
  const text = (u) => decodeURIComponent(technicianWaLink(issue, tech, '', u).split('text=')[1])
  assert.ok(!text('').includes('http'))
  assert.ok(text('https://x.it/#/t/abc').includes('https://x.it/#/t/abc'))
})
test('il link del tecnico e il suo riconoscimento', () => {
  assert.equal(tokenFromPortalRoute(`/t/${T}`), T)
  assert.equal(tokenFromPortalRoute('/t/corto'), '')
})
test('la cronologia include gli eventi del tecnico', () => {
  const ev = issueTimeline({ id: 1, created_at: 'x' }, [{ id: 1, kind: 'note', note: 'torno domani', created_at: 'y' }, { id: 3, kind: 'arrival_set', arrival_at: '2026-11-27T08:30:00Z', created_at: 'w' }, { id: 2, kind: 'opened', created_at: 'z' }])
  assert.ok(ev.some((e) => e.text === 'Nota del tecnico: torno domani'))
  assert.ok(ev.some((e) => /^Il tecnico comunica l'arrivo per il /.test(e.text)))
  assert.equal(ev.length, 3)
})
test('migrazione 0043: codice solo come impronta, funzioni portale non pubbliche', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0043_technician_links.sql', import.meta.url), 'utf8')
  assert.match(sql, /revoke all on function randapp\.portal_get\(text\), randapp\.portal_event\(text, text, text\) from public, anon, authenticated/)
  assert.match(sql, /token_hash/)
  assert.doesNotMatch(sql, /grant select on randapp\.technician_links/)
  assert.match(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), /randapp-technician-portal\]\s*\nverify_jwt = false/)
})
test('appuntamento: valore per il selettore data/ora', () => {
  assert.equal(toLocalInput(''), '')
  assert.match(toLocalInput('2026-11-27T08:30:00Z'), /^2026-11-27T\d\d:30$/)
})
test('migrazione 0044: appuntamento solo da portal_event, funzioni non pubbliche', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0044_technician_appointment.sql', import.meta.url), 'utf8')
  assert.match(sql, /revoke all on function randapp\.portal_get\(text\), randapp\.portal_event\(text, text, text, timestamptz\) from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant update \(appointment_at\)/)
})
