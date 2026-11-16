import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_VARIABLES, whatsappVariables } from '../supabase/functions/_shared/notify.js'

const tpl = JSON.parse(readFileSync(new URL('../twilio/templates/randapp_avviso_it.json', import.meta.url), 'utf8'))
const body = tpl.types['twilio/text'].body
const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))

// Regole WhatsApp per i modelli usati fuori dalle 24 ore (documentazione Twilio «Using variables with Content API»).
test('modello generico: nome, lingua e un solo tipo di contenuto', () => {
  assert.match(tpl.friendly_name, /^[a-z0-9_]{1,200}$/)
  assert.equal(tpl.language, 'it')
  assert.deepEqual(Object.keys(tpl.types), ['twilio/text'])
  assert.ok(body.length <= 1024)
})

test('modello generico: variabili numerate in sequenza e uguali a quelle del dispatcher (titolo, testo)', () => {
  assert.deepEqual([...new Set(vars)].sort(), vars.map((_, i) => i + 1)) // 1, 2 senza salti né ripetizioni
  assert.equal(vars.length, DEFAULT_VARIABLES.length) // il dispatcher riempie {{1}} titolo e {{2}} testo
  assert.deepEqual(Object.keys(whatsappVariables(undefined, { title: 'T', body: 'B' })), vars.map(String))
})

test('modello generico: una variabile non apre né chiude il testo e due variabili non sono vicine', () => {
  assert.doesNotMatch(body, /^\s*\{\{/)
  assert.doesNotMatch(body, /\}\}[\s.,:;!?]*$/)
  assert.doesNotMatch(body, /\}\}\s*\{\{/)
})

test('modello generico: abbastanza parole intorno alle variabili (almeno 2x+1 ogni x variabili)', () => {
  const words = body.replace(/\{\{\d+\}\}[.,:;!?]*/g, ' ').split(/\s+/).filter(Boolean)
  assert.ok(words.length >= 2 * vars.length + 1, `parole fisse: ${words.length}`)
})

test('modello generico: ogni variabile ha un campione senza a capo (obbligatorio per l\'approvazione)', () => {
  for (const n of vars) {
    assert.ok(typeof tpl.variables[String(n)] === 'string' && tpl.variables[String(n)].trim(), `manca il campione di {{${n}}}`)
    assert.doesNotMatch(tpl.variables[String(n)], /[\n\r\t]/)
  }
})
