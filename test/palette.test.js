import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PALETTES, HOTEL_PALETTE, DEFAULT_PALETTE, paletteFor, applyPalette } from '../src/lib/palette.js'
import { isKeyboardOpen } from '../src/lib/keyboard.js'

// hotels.js importa immagini, che Node non carica: gli id si leggono dal sorgente.
const HOTELS = [...readFileSync(new URL('../src/lib/hotels.js', import.meta.url), 'utf8').matchAll(/\{ id: '([a-z]+)'/g)].map((m) => ({ id: m[1] }))
const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8')
const base = readFileSync(new URL('../src/ui/base.css', import.meta.url), 'utf8')
const css = tokens + '\n' + base

test('il sorgente espone le 3 strutture', () => { assert.equal(HOTELS.length, 3) })

test('ogni hotel ha una palette nota; hotel sconosciuto o assente usa quella di default', () => {
  const ids = new Set(PALETTES.map((p) => p.id))
  for (const h of HOTELS) assert.ok(ids.has(HOTEL_PALETTE[h.id]), `${h.id} senza palette valida`)
  assert.equal(paletteFor('altro'), DEFAULT_PALETTE)
  assert.equal(paletteFor(null), DEFAULT_PALETTE)
})

test('le tre strutture hanno palette diverse tra loro', () => {
  const used = HOTELS.map((h) => paletteFor(h.id))
  assert.equal(new Set(used).size, HOTELS.length)
})

test('applyPalette scrive data-pal sulla radice', () => {
  const attrs = {}
  const root = { setAttribute: (k, v) => { attrs[k] = v } }
  assert.equal(applyPalette('chocohotel', root), 'cacao')
  assert.equal(attrs['data-pal'], 'cacao')
})

test('tokens.css/base.css: ogni palette ha chiaro, scuro scelto e scuro di sistema (stessi token)', () => {
  for (const { id } of PALETTES) {
    assert.match(css, new RegExp(`:root\\[data-pal='${id}'\\] \\{[^}]*--accent`), `${id}: manca il chiaro`)
    assert.match(css, new RegExp(`:root\\[data-theme='dark'\\]\\[data-pal='${id}'\\] \\{[^}]*--accent`), `${id}: manca lo scuro scelto`)
    assert.match(css, new RegExp(`:root\\[data-pal='${id}'\\]:not\\(\\[data-theme='light'\\]\\):not\\(\\[data-theme='dark'\\]\\) \\{[^}]*--accent`), `${id}: manca lo scuro di sistema`)
  }
})

test('tokens.css/base.css: vetro con ripiego pieno, niente sfocatura sulle schede, bordi sicuri laterali e in basso', () => {
  assert.match(css, /@supports not/)
  assert.match(css, /prefers-reduced-transparency/)
  assert.match(css, /--safe-left/)
  assert.match(css, /--safe-right/)
  assert.match(css, /max\(var\(--gap-tight\), var\(--safe-bottom\)\)/)
  const cardRule = css.slice(css.indexOf('.card, .hotel-pick'), css.indexOf('}', css.indexOf('.card, .hotel-pick')))
  assert.ok(!/backdrop-filter/.test(cardRule), 'le schede non devono sfocare')
})

test('tokens.css espone i bordi sicuri laterali', () => {
  assert.match(tokens, /--safe-left: env\(safe-area-inset-left/)
  assert.match(tokens, /--safe-right: env\(safe-area-inset-right/)
})

test('tastiera aperta: altezza visibile sotto il 75% della finestra', () => {
  assert.equal(isKeyboardOpen(800, 780), false)
  assert.equal(isKeyboardOpen(800, 450), true)
  assert.equal(isKeyboardOpen(0, 0), false)
})
