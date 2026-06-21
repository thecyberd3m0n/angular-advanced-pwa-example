import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationService } from './notification.service';
import { Update } from './update';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('angular-advanced-pwa-example');
  private readonly notificationService = inject(NotificationService);
  private readonly updateService = inject(Update);
  readonly permissionStatus = this.notificationService.permissionStatus;
  readonly isNewVersion$ = this.updateService.isNewVersion$();

  constructor() {
    setTimeout(() => this.title.set('title changed'), 3000);
  }

  async onRequestPermission(): Promise<void> {
    await this.notificationService.requestPermission();
  }
  onUpdate() {
    this.updateService.activeUpdate();
  }
}
