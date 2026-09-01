// sw.js — minimaler Service Worker fuer Web Push (Lidl-Plus-Paritaet: echte Benachrichtigungen).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Am-Matt', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Am-Matt';
  const options = {
    body: data.body || '',
    icon: '/assets/img/favicon.svg',
    badge: '/assets/img/favicon.svg',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
