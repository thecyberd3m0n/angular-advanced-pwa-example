/// <reference lib="webworker" />
import { ServiceWorklet, type ServiceWorkletEvents } from '../service-worklet';

declare const self: ServiceWorkerGlobalScope;

// Web Push notifications + notification click handling, expressed as a worklet.

@ServiceWorklet({ name: 'PushNotifications' })
export class PushNotificationServiceWorklet implements ServiceWorkletEvents {
  // Returning the promise lets the framework call event.waitUntil() for us.
  push(event: PushEvent): Promise<void> {
    const data = event.data ? event.data.json() : {};

    const title = data.title || 'New Message';
    const options: NotificationOptions = {
      body: data.body || 'You have a new update.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: data.customPayload,
    };

    return self.registration.showNotification(title, options);
  }

  async notificationClick(event: NotificationEvent): Promise<void> {
    event.notification.close();

    const clientList = await self.clients.matchAll({ type: 'window' });
    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow('/');
    }
  }
}
