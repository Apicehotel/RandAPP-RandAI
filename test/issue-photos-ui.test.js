import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('elenco: conta le foto senza scaricarle', () => {
  const src = read('src/data/issues.js')
  assert.match(src, /issue_photos\(count\)/)
  assert.match(src, /photo_count/)
  // il dettaglio continua a caricare le foto vere solo per la singola segnalazione
  assert.match(src, /listIssuePhotos/)
})

test('elenco e Operatività mostrano l\'icona foto', () => {
  assert.match(read('src/screens/Issues.jsx'), /<PhotoMark count=\{issue\.photo_count\}/)
  assert.match(read('src/screens/Operations.jsx'), /<PhotoMark count=\{issue\.photo_count\}/)
})

test('dettaglio: anteprima piccola con ingrandimento', () => {
  const src = read('src/screens/Issues.jsx')
  assert.match(src, /function IssuePhoto/)
  assert.match(src, /photo-lightbox/)
  assert.match(read('src/ui/base.css'), /\.photo-thumb/)
})
