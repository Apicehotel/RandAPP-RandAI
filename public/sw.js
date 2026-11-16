// Service worker di RandApp: push + uso offline.
// - Solo richieste GET dello stesso sito. Supabase (altro dominio) non passa mai di qui: nessun dato viene messo in cache.
// - Pagina: prima la rete; se manca la rete, l'ultima copia salvata (l'app si apre anche senza segnale).
// - File /assets/*-hash.* : immutabili, cache-first.
// - Installazione: salva pagina + TUTTI i file dell'app (anche le schermate caricate a richiesta), così si apre offline anche una schermata mai visitata.
// - Quando cambia la strategia di cache, incrementare VERSION. A ogni build cambia BUILD e la cache vecchia viene cancellata.
const VERSION = 'v2'
// Segnaposto sostituiti a ogni build da vite.config.js: id della versione e elenco di tutti i file dell'app.
const BUILD = '__BUILD__'
const PRECACHE = '__PRECACHE__'
const PREFIX = 'randapp-shell-'
const CACHE = `${PREFIX}${VERSION}-${BUILD}`
const SCOPE = self.registration.scope
// Le copie fatte in installazione non hanno le intestazioni «Vary» della richiesta vera (es. Accept-Encoding): senza questo non si ritroverebbero.
const MATCH = { ignoreVary: true }
const STATIC = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']

const isHashedAsset = (url) => /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/.test(url.pathname)

// Non si salva mai una pagina HTML al posto di uno script o di un foglio di stile (succede quando un deploy toglie il file).
function isValid(request, response) {
  if (!response || !response.ok) return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (request.destination === 'script' || request.destination === 'worker') return type.includes('javascript') || type.includes('ecmascript')
  if (request.destination === 'style') return type.includes('text/css')
  return true
}

async function precache(cache, path) {
  try {
    const request = new Request(path, { cache: 'no-store' })
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response)
  } catch { /* sarà ripreso alla prima richiesta */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    try {
      const shell = await fetch(SCOPE, { cache: 'no-store' })
      if (shell.ok) await cache.put(SCOPE, shell)
    } catch { /* installazione senza rete: la cache si riempie dopo */ }
    const files = (Array.isArray(PRECACHE) ? PRECACHE : []).map((f) => new URL(f, SCOPE).href)
    const todo = [...files, ...STATIC.map((p) => new URL(p, SCOPE).href)]
    // Pochi file alla volta, per non intasare un telefono con poco segnale.
    for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map((href) => precache(cache, href)))
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'PURGE_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((k) => caches.delete(k)))))
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.endsWith('/sw.js')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE).then((c) => c.put(SCOPE, copy)))
        }
        return response
      } catch {
        return (await caches.match(SCOPE, MATCH)) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, MATCH)
    if (cached && isValid(request, cached)) {
      // File con hash: mai cambiano. Gli altri (icone, manifest) si rinfrescano in secondo piano.
      if (!isHashedAsset(url)) {
        event.waitUntil(fetch(request, { cache: 'no-store' }).then((r) => (isValid(request, r) ? caches.open(CACHE).then((c) => c.put(request, r)) : null)).catch(() => {}))
      }
      return cached
    }
    try {
      const response = await fetch(request)
      if (isValid(request, response)) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)))
      }
      return response
    } catch {
      return new Response('Non disponibile offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
  })())
})

// ---- Notifiche push
// Dal tocco su una notifica si apre solo una pagina di QUESTO sito: un indirizzo di un altro sito (payload manomesso) ripiega sulle Notifiche.
const DEFAULT_URL = new URL('./#/notifications', SCOPE).href
function safeUrl(raw) {
  try {
    const u = new URL(raw || DEFAULT_URL, SCOPE)
    return u.origin === self.location.origin ? u.href : DEFAULT_URL
  } catch { return DEFAULT_URL }
}

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { title: 'RandApp', body: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(d.title || 'RandApp', {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: d.tag || undefined,
    requireInteraction: d.urgent === true,
    data: { url: safeUrl(d.url) },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = safeUrl(event.notification.data && event.notification.data.url)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
