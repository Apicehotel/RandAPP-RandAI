import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/0037_cestino_schermata.sql', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../src/screens/Settings.jsx', import.meta.url), 'utf8')

test('0037: ogni funzione del cestino controlla admin.access ed e\' solo in randapp', () => {
  const fns = [...sql.matchAll(/create or replace function (randapp\.cestino_\w+)/g)].map((m) => m[1])
  assert.deepEqual(fns.sort(), ['randapp.cestino_controlla', 'randapp.cestino_elenco', 'randapp.cestino_elimina', 'randapp.cestino_ripristina', 'randapp.cestino_svuota'])
  assert.ok(!/\bpublic\./.test(sql.replace(/from public, anon/g, '').replace(/from public\b/g, '')), 'non deve toccare lo schema public')
  assert.equal((sql.match(/has_permission\(p_hotel, 'admin\.access'\)/g) || []).length, 3) // elenco, controlla, svuota
  assert.ok(sql.includes('cestino_controlla(p_hotel, p_id)')) // ripristina ed elimina passano dal controllo
})

test('0037: nessun accesso per anon, la tabella non viene mai letta direttamente dall\'app', () => {
  assert.ok(/revoke all on function[\s\S]*from public, anon/.test(sql))
  assert.ok(/grant execute on function[\s\S]*to authenticated/.test(sql))
  assert.ok(!sql.includes('data_url')) // le foto non escono dal cestino
})

test('schermata: Cestino in Impostazioni con conferma per ripristina, elimina e elimina tutto', () => {
  assert.ok(settings.includes("{ id: 'trash', label: 'Cestino' }"))
  for (const t of ['Conferma ripristino', 'Conferma: elimina per sempre', 'Conferma: elimina tutto per sempre']) assert.ok(settings.includes(t), t)
})
