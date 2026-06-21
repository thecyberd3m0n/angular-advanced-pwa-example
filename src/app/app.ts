import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('angular-advanced-pwa-example');
  private readonly notificationService = inject(NotificationService);
  readonly permissionStatus = this.notificationService.permissionStatus;

  constructor() {
    setTimeout(() => this.title.set('title changed'), 3000);
  }

  async onRequestPermission(): Promise<void> {
    await this.notificationService.requestPermission();
  }
}
