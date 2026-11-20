import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fitSize } from '../src/lib/photo.js'

test('fitSize riduce il lato lungo a 1280 e non ingrandisce', () => {
  assert.deepEqual(fitSize(4000, 3000), { width: 1280, height: 960 })
  assert.deepEqual(fitSize(3000, 4000), { width: 960, height: 1280 })
  assert.deepEqual(fitSize(800, 600), { width: 800, height: 600 })
})

test('dettaglio: coppia Prima | Dopo con aggiunta per chi può modificare', () => {
  const src = readFileSync(new URL('../src/screens/Issues.jsx', import.meta.url), 'utf8')
  assert.match(src, /\['prima', 'dopo'\]\.map\(\(kind\) => \(\s*<PhotoSlot/)
  assert.match(src, /canAdd=\{canUpdate\}/)
  assert.match(readFileSync(new URL('../src/data/issues.js', import.meta.url), 'utf8'), /export async function addIssuePhoto/)
})
