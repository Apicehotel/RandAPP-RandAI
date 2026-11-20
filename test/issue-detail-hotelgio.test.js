import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { issueTimeline } from '../src/lib/issue-timeline.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('cronologia: apertura e chiusura con ora, gli altri passaggi senza', () => {
  const ev = issueTimeline({ created_at: '2026-11-20T09:36:00Z', source: 'whatsapp', created_by_name: 'Anna', technician_name: 'Rossi', part_needed: 'Faretto', part_replaced: 'Lampadina', completed_at: '2026-11-20T11:00:00Z', completed_by_name: 'Luca' })
  assert.deepEqual(ev.map((e) => e.id), ['created', 'tech', 'need', 'repl', 'done'])
  assert.equal(ev[0].text, 'Aperta da Anna via WhatsApp')
  assert.equal(ev[1].at, null)
  assert.equal(ev[4].text, 'Completata da Luca')
  assert.deepEqual(issueTimeline(null), [])
})

test('0041: colonna part_needed con grant di update solo su quella, schema randapp', () => {
  const sql = read('supabase/migrations/0041_issue_part_needed.sql')
  assert.match(sql, /add column if not exists part_needed/)
  assert.match(sql, /grant update \(part_needed\) on randapp\.issues/)
  assert.ok(!/\bpublic\./.test(sql))
})

test('dettaglio: serve pezzo, modifica e cronologia sono collegati; nessuna cancellazione dal browser', () => {
  const src = read('src/screens/Issues.jsx')
  for (const c of ['<PartCard ', '<DetailsEditor ', '<Timeline ']) assert.ok(src.includes(c), c)
  const data = read('src/data/issues.js')
  assert.ok(!/\.delete\(\)/.test(data)) // STANDARD §6.3
})
