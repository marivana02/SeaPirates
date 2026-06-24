self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'SeaPirates';
    const options = {
      body: data.body || '',
      icon: data.icon || '/assets/ui/pearl.png',
      badge: data.badge || '/assets/ui/pearl.png',
      vibrate: [200, 100, 200],
      requireInteraction: true
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // ignore
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
