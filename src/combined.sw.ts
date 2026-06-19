/// <reference lib="webworker" />

// Custom service worker (TypeScript source — compiled to public/combined-sw.js
// via esbuild; see the `build:sw*` npm scripts).
//
// Strategy from the Gemini guide (PWA.md): instead of registering Angular's
// ngsw-worker.js directly, the app registers the COMPILED output of this file,
// and we pull Angular's caching engine in via importScripts so it runs in the
// same worker scope.
//
//   importScripts('./ngsw-worker.js')  ->  Angular handles all asset/data
//                                           caching exactly as before, so the
//                                           existing refresh behavior is
//                                           unchanged.
//
// Anything below importScripts is our own custom, non-caching logic.

declare const self: ServiceWorkerGlobalScope;

const LOG = '[combined-sw]';
log('script evaluated');

// 1. Load the default Angular PWA caching mechanism FIRST. It runs
//    synchronously, so Angular registers its install/activate/fetch listeners
//    before ours. This preserves the current update-on-reload behavior.
//
//    Under `ng serve` (dev) Angular does NOT emit ngsw-worker.js, so the
//    request hits the SPA fallback and returns HTML. Guard with try/catch so
//    the worker still installs in dev (just without ngsw caching); in a real
//    build the import succeeds and full caching/refresh behavior is preserved.
try {
  importScripts('./ngsw-worker.js');
  log('ngsw-worker.js imported');
} catch (error) {
  log('ngsw-worker.js not available (dev mode?) — skipping ngsw', String(error));
}

// Lifecycle logging. These run alongside ngsw's own handlers (multiple
// listeners for the same event all fire), so they don't change behavior.
self.addEventListener('install', () => {
  log('install event');
});

self.addEventListener('activate', () => {
  log('activate event');
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  log('message event', event.data);
});

// 2. Custom feature: Web Push notifications.
self.addEventListener('push', (event: PushEvent) => {
  log('push event');
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'New Message';
  const options: NotificationOptions = {
    body: data.body || 'You have a new update.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: data.customPayload,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks: focus an existing window or open a new one.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  log('notificationclick event');
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}
