import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'))
const html = readFileSync(new URL('index.html', root), 'utf8')

test('il manifest ha nome, avvio e icone che esistono davvero', () => {
  assert.equal(manifest.short_name, 'RandApp')
  assert.equal(manifest.display, 'standalone')
  for (const icon of manifest.icons) assert.ok(existsSync(new URL(`public/${icon.src}`, root)), icon.src)
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192'))
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'))
})

test('index.html collega manifest e icone', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon"/)
  assert.ok(existsSync(new URL('public/icons/apple-touch-icon.png', root)))
})

test('ogni struttura ha il suo logo nel progetto', () => {
  const src = readFileSync(new URL('src/lib/hotels.js', root), 'utf8')
  for (const id of ['hotelgio', 'chocohotel', 'brigantino']) {
    assert.match(src, new RegExp(`id: '${id}'.*logo:`), id)
    assert.ok(existsSync(new URL(`src/assets/logos/${id}.webp`, root)), id)
  }
  assert.ok(existsSync(new URL('src/assets/logos/apicehotel.webp', root)))
})
