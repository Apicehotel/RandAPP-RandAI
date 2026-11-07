import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { ROLES } from '../src/lib/admin.js'
import { ROLE_LABELS } from '../src/lib/permissions.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NEW_ROLES = ['capo_governante', 'portiere_notturno', 'direttore_congressi', 'tecnico_esterno', 'supremo', 'randai']
const migration = read('../supabase/migrations/0031_roles_from_legacy.sql')
const seed = read('../supabase/seed/01_users_from_legacy_roles.sql')

test('i 6 ruoli della vecchia app sono in ROLES e hanno un nome in italiano', () => {
  for (const r of NEW_ROLES) {
    assert.ok(ROLES.includes(r), `${r} manca in ROLES`)
    assert.ok(ROLE_LABELS[r], `${r} senza etichetta`)
  }
  for (const r of ROLES) assert.ok(ROLE_LABELS[r], `${r} senza etichetta`)
})

test('lo stesso elenco di ruoli è nel vincolo SQL, nella funzione admin e nello script create-user', () => {
  for (const r of NEW_ROLES) assert.ok(migration.includes(`'${r}'`), `${r} manca nella migrazione`)
  const fn = read('../supabase/functions/randapp-admin/index.ts')
  const script = read('../scripts/create-user.mjs')
  for (const r of ROLES) {
    assert.ok(fn.includes(`"${r}"`), `${r} manca in randapp-admin`)
    assert.ok(script.includes(`'${r}'`), `${r} manca in create-user`)
  }
})

test('i permessi dei nuovi ruoli usano solo permessi che esistono già nelle migrazioni precedenti', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const earlier = readdirSync(dir).filter((f) => f < '0031').map((f) => read(`../supabase/migrations/${f}`)).join('\n')
  const used = [...migration.matchAll(/\('(?:portiere_notturno|tecnico_esterno|supremo|randai)','([a-z_]+\.[a-z_]+)'\)/g)].map((m) => m[1])
  assert.ok(used.length > 25)
  for (const p of new Set(used)) assert.ok(earlier.includes(`'${p}'`), `permesso sconosciuto: ${p}`)
})

test('il Tecnico esterno e RandAI non hanno accesso admin né creazione di segnalazioni/interventi', () => {
  const rows = [...migration.matchAll(/\('(tecnico_esterno|randai)','([a-z_]+\.[a-z_]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`)
  for (const r of rows) {
    assert.ok(!r.endsWith('admin.access'), r)
    assert.ok(!/^(tecnico_esterno|randai):(issues|interventions)\.create$/.test(r), r)
  }
})

test('i promemoria senza destinatari non arrivano a Tecnico esterno e RandAI', () => {
  assert.match(migration, /staff_list constant text := old_list \|\| ',''capo_governante'',''portiere_notturno'',''direttore_congressi'',''supremo'''/)
  assert.ok(!/staff_list[^;]*tecnico_esterno/.test(migration.split('full_list')[0].split('staff_list constant')[1] || ''))
})

test('il seme copia le strutture com\'erano: una riga per persona e struttura, senza mostrare i PIN', () => {
  for (const old of ['Capo Governante', 'Portiere Notturno', 'Direttore Centro Congressi', 'Tecnico esterno', 'Supremo', 'RandAI']) {
    assert.ok(seed.includes(`'${old}'`), `${old} manca nel seme`)
  }
  assert.match(seed, /on conflict \(auth_user_id, hotel_id\) do nothing/)
  assert.ok(!/pin\s*=\s*'\d/.test(seed))
})
