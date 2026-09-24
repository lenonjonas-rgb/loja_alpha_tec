self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(payload.title || 'Alpha Tec', {
    body: payload.body || 'Há uma novidade no painel.',
    icon: '/favicon-48.png',
    badge: '/favicon-48.png',
    data: { url: payload.url || '/admin' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/admin'))
})
