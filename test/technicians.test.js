import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { technicianWaLink } from '../src/lib/technician-wa.js'
import { menuGroupsFor, PERM } from '../src/lib/permissions.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('messaggio al tecnico: numero senza + e testo con camera, descrizione, nota e urgenza', () => {
  const url = technicianWaLink({ room: '204', category: 'Elettrico', title: 'Luce bagno', urgency: 'alta' }, { name: 'Rossi', phone: '+39 333 123 4567' }, 'Porta la scala')
  assert.ok(url.startsWith('https://wa.me/393331234567?text='))
  const text = decodeURIComponent(url.split('text=')[1])
  for (const part of ['Ciao Rossi', 'in 204', '(Elettrico)', 'Descrizione: Luce bagno', 'Porta la scala', 'Urgenza: Alta']) assert.ok(text.includes(part), part)
  assert.equal(technicianWaLink({ room: '1' }, { name: 'X', phone: '' }), null)
})

test('menu: «Tecnici» solo con technicians.view', () => {
  const ids = (perms) => menuGroupsFor(perms).flatMap((g) => g.items).map((i) => i.id)
  assert.ok(ids([PERM.TECHNICIANS_VIEW]).includes('technicians'))
  assert.ok(!ids([PERM.ISSUES_VIEW]).includes('technicians'))
})

test('0042: RLS su tutte le tabelle, scrittura solo con le funzioni, nessuna policy di scrittura né delete', () => {
  const sql = read('supabase/migrations/0042_tecnici.sql')
  for (const t of ['technician_competencies', 'external_technicians', 'external_technician_competencies']) {
    assert.match(sql, new RegExp(`alter table randapp\\.${t}\\s+enable row level security`))
  }
  assert.ok(!/create policy[^;]*for (insert|update|delete)/i.test(sql))
  assert.ok(!/grant[^;]*(insert|update|delete)[^;]*on randapp\.external_technicians/i.test(sql))
  assert.equal((sql.match(/has_permission\(p_hotel, 'technicians\.manage'\)/g) || []).length, 2)
  assert.ok(!/\bpublic\./.test(sql))
})

test('schermata Tecnici e assegnazione dalla segnalazione', () => {
  assert.match(read('src/app/App.jsx'), /module === 'technicians'/)
  assert.match(read('src/screens/Issues.jsx'), /<TechnicianCard /)
  assert.ok(!/\.delete\(\)/.test(read('src/data/technicians.js')))
})
