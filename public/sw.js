// Service worker SOLO per le notifiche push: nessuna cache, nessun intercettare le richieste,
// così non può mai servire una versione vecchia dell'app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { title: 'RandApp', body: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(d.title || 'RandApp', {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: d.tag || undefined,
    requireInteraction: d.urgent === true,
    data: { url: d.url || './#/notifications' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || './#/notifications'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
