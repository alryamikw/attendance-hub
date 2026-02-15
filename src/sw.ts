/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { Queue } from 'workbox-background-sync';

// Claim clients immediately
clientsClaim();

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST);

// App Shell routing
const fileExtensionRegexp = /[^/?]+\\.[^/]+$/;
registerRoute(({ request, url }) => {
  if (request.mode !== 'navigate') {
    return false;
  }
  if (url.pathname.startsWith('/_next')) {
    return false;
  }
  if (url.pathname.match(fileExtensionRegexp)) {
    return false;
  }
  return true;
}, createHandlerBoundToURL('/'));

// Cache static assets
registerRoute(
  ({ url }) => url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/static'),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// Cache fonts
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// API Cache - Network First for dynamic data
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }),
    ],
    networkTimeoutSeconds: 10,
  })
);

// ==========================================
// OFFLINE QUEUE FOR ATTENDANCE
// ==========================================

const attendanceQueue = new Queue('attendance-sync-queue', {
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request);
        if (response.ok) {
          // Notify the client of successful sync
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              payload: {
                url: entry.request.url,
                status: response.status,
              },
            });
          });
        } else {
          throw new Error('Sync failed');
        }
      } catch (error) {
        console.error('Sync failed, re-queueing:', error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// Intercept attendance API requests
registerRoute(
  ({ url }) => url.pathname.includes('/api/attendance'),
  async ({ request, event }) => {
    try {
      // Try network first
      const response = await fetch(request.clone());
      
      if (response.ok) {
        return response;
      }
      
      throw new Error('Network response not ok');
    } catch (error) {
      // If offline, queue the request
      if (request.method !== 'GET') {
        await attendanceQueue.pushRequest({ request: request.clone() });
        
        // Return a mock response
        return new Response(
          JSON.stringify({
            success: true,
            offline: true,
            message: 'Request queued for sync when online',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 202,
          }
        );
      }
      throw error;
    }
  },
  'POST'
);

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options: NotificationOptions = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/',
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Close' },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'AttendanceHub', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    const url = event.notification.data?.url || '/';
    event.waitUntil(self.clients.openWindow(url));
  }
});

// ==========================================
// PERIODIC BACKGROUND SYNC
// ==========================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendanceData());
  }
});

async function syncAttendanceData() {
  try {
    const cache = await caches.open('offline-attendance');
    const keys = await cache.keys();
    
    for (const request of keys) {
      if (request.method === 'POST') {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      }
    }
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'GET_QUEUED_REQUESTS') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'QUEUED_REQUESTS',
            count: attendanceQueue.size,
          });
        });
      })()
    );
  }
});

// ==========================================
// GEOLOCATION TRACKING (for background)
// ==========================================

let geoWatchId: number | null = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_GEO_WATCH') {
    // Note: Geolocation in service workers requires special permissions
    // This would typically be done in the main thread
  }
  
  if (event.data.type === 'STOP_GEO_WATCH') {
    if (geoWatchId !== null) {
      clearInterval(geoWatchId);
      geoWatchId = null;
    }
  }
});
