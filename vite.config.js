import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// A ogni build scrive nel service worker la lista di TUTTI i file dell'app (anche le schermate caricate a richiesta) e un
// identificativo della versione: così si apre offline anche una schermata mai visitata, e il worker cambia a ogni deploy
// (il browser lo reinstalla da solo e butta la cache vecchia).
function swPrecache() {
  let files = []
  let outDir = 'dist'
  return {
    name: 'sw-precache',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    generateBundle(_, bundle) {
      files = Object.keys(bundle).filter((f) => f.startsWith('assets/') && !f.endsWith('.map')).sort()
    },
    closeBundle: {
      order: 'post',
      handler() {
        const target = join(outDir, 'sw.js')
        const build = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10)
        const src = readFileSync(target, 'utf8')
        if (!src.includes("'__BUILD__'") || !src.includes("'__PRECACHE__'")) throw new Error('sw.js: mancano i segnaposto __BUILD__ / __PRECACHE__')
        writeFileSync(target, src.replace("'__BUILD__'", JSON.stringify(build)).replace("'__PRECACHE__'", JSON.stringify(files)))
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor'
        },
      },
    },
  },
  server: { host: true, port: 3000, strictPort: true, allowedHosts: true },
  preview: { host: true, port: 3000, strictPort: true, allowedHosts: true },
})
