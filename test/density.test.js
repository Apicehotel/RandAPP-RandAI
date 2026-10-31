import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SIZES } from '../src/lib/ui-prefs.js'

const css = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8')
const block = (sel) => {
  const i = css.indexOf(sel)
  assert.ok(i >= 0, `manca ${sel}`)
  return css.slice(i, css.indexOf('}', i))
}
const names = (b) => new Set([...b.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]))

test('la dimensione non è uno zoom: niente --size-scale né html in calc()', () => {
  assert.ok(!css.includes('--size-scale'))
  assert.ok(!/html\s*\{[^}]*calc\(/.test(css))
})

test('Piccolo e Grande ridefiniscono le stesse misure di Normale (font, spazi, controlli, icone, colonne)', () => {
  const normal = names(block(':root {'))
  const must = ['fs', 'fs-h1', 'pad-card', 'gap', 'control', 'chip-h', 'nav-h', 'icon-k', 'avatar', 'tile-cols', 'hub-cols', 'drawer-w']
  for (const m of must) assert.ok(normal.has(m), `Normale senza --${m}`)
  for (const id of SIZES.filter((s) => s.id !== 'normal').map((s) => s.id)) {
    const got = names(block(`:root[data-size='${id}']`))
    for (const m of must) assert.ok(got.has(m), `${id} senza --${m}`)
  }
})
