#!/usr/bin/env node
// Budget del bundle: fallisce se l'app pesa troppo all'avvio o se una singola schermata diventa enorme.
// Eseguire dopo "npm run build". Pesi in KB compressi (gzip).
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const INITIAL_BUDGET_KB = 160 // tutto ciò che si scarica alla prima apertura
const LAZY_CHUNK_BUDGET_KB = 25 // ogni schermata caricata a richiesta

const dist = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'))
const gzKb = (file) => gzipSync(readFileSync(new URL(file, dist))).length / 1024

const entry = Object.values(manifest).find((c) => c.isEntry)
if (!entry) {
  console.error('Entry non trovata nel manifest: esegui prima "npm run build".')
  process.exit(1)
}

// Chunk caricati subito = entry + import statici (ricorsivi) + css
const initial = new Set()
const visit = (chunk) => {
  if (initial.has(chunk.file)) return
  initial.add(chunk.file)
  for (const css of chunk.css || []) initial.add(css)
  for (const key of chunk.imports || []) visit(manifest[key])
}
visit(entry)

const initialKb = [...initial].reduce((sum, f) => sum + gzKb(f), 0)
let failed = false

console.log(`Avvio: ${initialKb.toFixed(1)} KB gz (limite ${INITIAL_BUDGET_KB})`)
if (initialKb > INITIAL_BUDGET_KB) {
  console.error('  ✗ Troppo pesante all\'avvio')
  failed = true
}

for (const chunk of Object.values(manifest)) {
  if (initial.has(chunk.file) || !chunk.file.endsWith('.js')) continue
  const kb = gzKb(chunk.file)
  const ok = kb <= LAZY_CHUNK_BUDGET_KB
  console.log(`  ${ok ? '✓' : '✗'} ${chunk.file.replace('assets/', '')}: ${kb.toFixed(1)} KB (limite ${LAZY_CHUNK_BUDGET_KB})`)
  if (!ok) failed = true
}

process.exit(failed ? 1 : 0)
