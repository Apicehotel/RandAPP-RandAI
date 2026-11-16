// PWA: registra il service worker e controlla che il telefono non resti su una versione vecchia dell'app.
// Funzioni pure (testate) + una piccola parte che tocca il browser.

const GUARD_KEY = 'randapp.build-reload'

// File dell'app (solo <script src> e fogli di stile con hash) citati da un HTML.
// I <link rel="modulepreload"> sono esclusi: il browser non li espone come script, e il confronto darebbe sempre «versione vecchia».
export function assetPaths(html) {
  const out = new Set()
  for (const tag of String(html || '').matchAll(/<(script|link)\b[^>]*>/gi)) {
    const t = tag[0]
    const isScript = tag[1].toLowerCase() === 'script'
    if (!isScript && !/\brel="stylesheet"/i.test(t)) continue
    const m = t.match(isScript ? /\ssrc="([^"#]*\/assets\/[^"#?]+)/ : /\shref="([^"#]*\/assets\/[^"#?]+)/)
    if (!m) continue
    try { out.add(new URL(m[1], 'https://x.invalid').pathname) } catch { /* ignora */ }
  }
  return [...out].sort()
}

// La versione sul server è diversa da quella caricata? Senza file con hash (sviluppo) o senza risposta: mai.
export function isStaleBuild(loaded, latest) {
  if (!loaded?.length || !latest?.length) return false
  return loaded.join('|') !== latest.join('|')
}

const firstSeen = (storage, signature) => {
  try {
    if (storage.getItem(GUARD_KEY) === signature) return false
    storage.setItem(GUARD_KEY, signature)
  } catch { /* storage bloccato: meglio non ricaricare */ return false }
  return true
}

const typing = (doc) => {
  const el = doc.activeElement
  return Boolean(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && (el.value || '').length > 0)
}

// Ricarica una sola volta per ogni nuova versione, e mai mentre qualcuno sta scrivendo in un campo.
export async function checkForNewBuild({
  doc = document, fetchImpl = fetch, storage = sessionStorage, reload = () => window.location.reload(), base = './',
} = {}) {
  try {
    const loaded = assetPaths([...doc.querySelectorAll('script[src],link[rel="stylesheet"][href]')]
      .map((n) => n.outerHTML).join('\n'))
    if (!loaded.length) return false
    const res = await fetchImpl(base, { cache: 'no-store' })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return false
    const latest = assetPaths(await res.text())
    if (!isStaleBuild(loaded, latest) || typing(doc)) return false
    if (!firstSeen(storage, latest.join('|'))) return false
    reload()
    return true
  } catch { return false }
}

export function registerServiceWorker(win = window, prod = import.meta.env?.PROD) {
  if (!prod || !win.navigator?.serviceWorker) return
  const check = () => checkForNewBuild()
  const start = async () => {
    try {
      const reg = await win.navigator.serviceWorker.register('./sw.js')
      const refresh = () => { reg.update().catch(() => {}); check() }
      win.document.addEventListener('visibilitychange', () => { if (win.document.visibilityState === 'visible') refresh() })
      win.addEventListener('online', refresh)
      win.navigator.serviceWorker.addEventListener('controllerchange', check)
      check()
    } catch { /* senza service worker l'app funziona lo stesso, solo non offline */ }
  }
  if (win.document.readyState === 'complete') start()
  else win.addEventListener('load', start, { once: true })
}
