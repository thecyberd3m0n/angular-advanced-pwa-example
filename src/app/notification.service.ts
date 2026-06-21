import { Injectable, signal } from '@angular/core';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly permissionStatus = signal<NotificationPermissionStatus>(this.getCurrentStatus());

  private getCurrentStatus(): NotificationPermissionStatus {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!('Notification' in window)) {
      this.permissionStatus.set('unsupported');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      this.permissionStatus.set(result);
      return result;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return this.getCurrentStatus();
    }
  }

  showNotification(title: string, options?: NotificationOptions): void {
    if (this.permissionStatus() !== 'granted') {
      console.warn('Cannot show notification: permission not granted');
      return;
    }

    new Notification(title, options);
  }
}
