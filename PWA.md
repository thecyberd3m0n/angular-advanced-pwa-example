Yes, it is entirely possible. By design, Angular’s default @angular/pwa service worker (ngsw-worker.js) is compiled as a "drop-in binary" and cannot be modified or recompiled directly from within the main Angular build pipeline. However, you can elegantly extend it by creating a custom TypeScript file, compiling/bundling it into JavaScript, and using the native importScripts() API to inject the Angular caching worker into it.

Here is the step-by-step approach to achieving this cleanly.

The Strategy
Instead of letting Angular register ngsw-worker.js directly, you will register a custom script (e.g., combined-sw.js). Inside your TypeScript source for this file, you will import Angular's caching engine so they run in the same scope.

+-------------------------------------------------------+
|                 Your Browser Context                  |
|  Registers: 'combined-sw.js'                          |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|                  combined-sw.js                       |
|                                                       |
|  1. importScripts('./ngsw-worker.js') ----------> (Handles asset/data caching)
|  2. Your Custom TypeScript Code -----------------> (Handles push notifications,
|                                                    sync, communication backup, etc.)
+-------------------------------------------------------+
Step-by-Step Implementation
1. Create your Custom Worker in TypeScript
Create a file named src/combined-sw.ts. You must tell TypeScript that this file runs in a service worker context (ServiceWorkerGlobalScope) using a triple-slash directive so it understands keywords like self.

TypeScript
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// 1. Import the default Angular PWA caching mechanism
importScripts('./ngsw-worker.js');

// 2. Add your custom features (e.g., Web Push Notifications)
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'New Message';
  const options: NotificationOptions = {
    body: data.body || 'You have a new update.',
    icon: '/assets/icons/icon-128x128.png',
    badge: '/assets/icons/badge-72x72.png',
    data: data.customPayload // Useful for routing inside your communicator app
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click events
self.addEventListener('notificationclick', (event: NotificationHookEvent) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if the app is already open, focus it, or open a new window
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
2. Set Up Compilation via TS Config
Because this script runs in an isolated context separated from your main Angular application DOM, it needs its own small compilation configuration. Create a src/tsconfig.sw.json:

JSON
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "es2022",
    "lib": ["webworker", "es2022"],
    "types": []
  },
  "include": ["combined-sw.ts"]
}
3. Compile the Service Worker
You have two primary ways to bundle this script into your final build:

Option A: Use esbuild directly in your build scripts (Recommended & Fastest)
Since modern Angular versions use esbuild under the hood anyway, you can compile your worker in a single command. Install esbuild as a dev dependency if you haven't already (npm i -D esbuild), and update your package.json:

JSON
"scripts": {
  "build": "ng build && esbuild src/combined-sw.ts --bundle --minify --outfile=dist/your-project-name/browser/combined-sw.js"
}
(Make sure to adjust the dist/... path to match where your Angular build outputs files).

Option B: Define it as a Web Worker in angular.json
If you prefer to keep everything natively handled by the CLI, you can define it as a web worker. Add a "webWorkerTsConfig" property to your browser target config in angular.jsonpointing to a tsconfig.worker.json.

4. Update Angular Service Worker Registration
Open your main application configuration (typically app.config.ts or app.module.ts) where @angular/pwa set up the registration module, and change the targeting filename from ngsw-worker.js to your newly bundled script combined-sw.js:

TypeScript
// In app.config.ts
provideServiceWorker('combined-sw.js', { // <-- Change this target
  enabled: !isDevMode(),
  registrationStrategy: 'registerWhenStable:3000'
})
Important Architectural Notes
Execution Order: importScripts('./ngsw-worker.js') executes synchronously. Placing it at the top guarantees Angular sets up its event listeners (like fetch and install) first.

Event Interception: If both you and Angular listen to the exact same event (e.g., push), both listeners will execute. However, keep in mind that Angular's worker has very rigid structure requirements for data payloads if it is expected to handle push routing internally. By overriding or adding your own handlers explicitly, you have full programmatic freedom over non-caching functions (like managing local encryption keys, handling background communication backups, or showing highly customized alerts).