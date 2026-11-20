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

test('elenco e Operatività mostrano la miniatura (caricata solo se visibile)', () => {
  assert.match(read('src/screens/Issues.jsx'), /<IssueThumb hotelId=\{ctx\.hotelId\} issueId=\{issue\.id\}/)
  assert.match(read('src/screens/Operations.jsx'), /<IssueThumb hotelId=\{ctx\.hotelId\} issueId=\{issue\.id\}/)
  const thumb = read('src/ui/IssueThumb.jsx')
  assert.match(thumb, /IntersectionObserver/)
  assert.match(read('src/data/issues.js'), /\.eq\('kind', 'prima'\)/)
})

test('dettaglio: anteprima piccola con ingrandimento', () => {
  const src = read('src/screens/Issues.jsx')
  assert.match(src, /function IssuePhoto/)
  assert.match(src, /photo-lightbox/)
  assert.match(read('src/ui/base.css'), /\.photo-thumb/)
})
