/// <reference lib="webworker" />
import { ServiceWorklet, type ServiceWorkletEvents } from '../service-worklet';

declare const self: ServiceWorkerGlobalScope;

// Lightweight lifecycle + message logging, runs alongside ngsw's own handlers.

@ServiceWorklet({ name: 'LifecycleLogger', order: -100 })
export class LifecycleLoggerServiceWorklet implements ServiceWorkletEvents {
  install(): void {
    console.log('[lifecycle] install event');
  }

  activate(): void {
    console.log('[lifecycle] activate event');
  }

  message(event: ExtendableMessageEvent): void {
    console.log('[lifecycle] message event', event.data);
  }
}
