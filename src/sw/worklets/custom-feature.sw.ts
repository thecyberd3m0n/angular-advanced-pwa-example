/// <reference lib="webworker" />
import { ServiceWorklet, type ServiceWorkletEvents, type SyncEvent } from '../service-worklet';

declare const self: ServiceWorkerGlobalScope;

// Example feature worklet — drop a file like this anywhere under src/ named
// `*.sw.ts` and it is auto-discovered and compiled into combined-sw.js.

@ServiceWorklet()
export class CustomFeatureServiceWorklet implements ServiceWorkletEvents {
  // Returning the promise lets the framework call event.waitUntil() for us, so
  // the SW stays alive until the notification is shown.
  sync(event: SyncEvent): Promise<void> {
    console.log('custom feature background sync event', event.tag);

    return self.registration.showNotification('Background Sync', {
      body: `Sync fired for tag: ${event.tag}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
    });
  }
}
