// 9jaBeacon Service Worker for Phoenix Browser, Mobile PWA & Push Notifications
const CACHE_NAME = '9jabeacon-cache-v1';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache failed, continuing:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler: Network-first for dynamic news, fallback to cache
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/admin') || request.url.includes('/bonesceo')) {
    return; // Don't cache admin calls
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (await caches.match(OFFLINE_URL)) || new Response('Offline: Please check your connection to read 9jaBeacon.', {
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        return new Response('Network error', { status: 408 });
      })
  );
});

// Push Event: Handle server push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ 9jaBeacon Breaking News',
    body: 'A major verified story has just been published by 9jaBeacon news desk.',
    url: '/',
    tag: 'breaking-news',
    icon: '/favicon.svg'
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || '9jabeacon-news',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'read', title: '📖 Read Story' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click: Open article URL or focus existing window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message Event: Allow web page to trigger native notifications via Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title || '⚡ 9jaBeacon Alert', {
      body: options?.body || 'Breaking news update from 9jaBeacon.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      data: options?.data || { url: '/' },
      ...options
    });
  }
});
