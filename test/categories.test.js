import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATEGORIES } from '../src/lib/queue.js'
import { categoryOptions } from '../src/lib/forms.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('CATEGORIES contiene tutte le categorie della vecchia app (segnalazioni e interventi)', () => {
  for (const c of ['Idraulica', 'Elettrico', 'Climatizzazione', 'Arredi', 'Edilizio', 'Filtri', 'Idromassaggio', 'Extrapiani', 'Altro']) {
    assert.ok(CATEGORIES.includes(c), `manca ${c}`)
  }
  assert.equal(CATEGORIES.at(-1), 'Altro')
  assert.equal(new Set(CATEGORIES).size, CATEGORIES.length)
})

test('ogni categoria ha la sua icona (nessuna cade sul ripiego)', () => {
  const fallback = categoryOptions(['Inesistente'])[0].icon
  for (const o of categoryOptions(CATEGORIES)) {
    if (o.id !== 'Altro') assert.notEqual(o.icon, fallback, `${o.id} senza icona`)
  }
})

test('la sincronizzazione degli interventi produce solo categorie presenti nell\'elenco', () => {
  const ops = read('../supabase/functions/legacy-sync/ops.ts')
  const map = ops.slice(ops.indexOf('const CAT'), ops.indexOf('};', ops.indexOf('const CAT')))
  for (const m of map.matchAll(/:\s*"([A-Za-zà]+)"/g)) assert.ok(CATEGORIES.includes(m[1]), `${m[1]} non è in CATEGORIES`)
})

test('legacy_category mappa edilizio in Edilizio (non più in Altro) e il seme usa id della vecchia app', () => {
  assert.match(read('../supabase/migrations/0032_issue_categories.sql'), /when 'edilizio' then 'Edilizio'/)
  const seed = read('../supabase/seed/02_issue_categories_backfill.sql')
  assert.equal((seed.match(/'[0-9a-f]{8}-[0-9a-f-]{27}'/g) || []).length, 10)
})
