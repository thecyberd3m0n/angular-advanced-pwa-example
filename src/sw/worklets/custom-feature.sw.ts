import { ServiceWorklet, type ServiceWorkletEvents, type SyncEvent } from '../service-worklet';

// Example feature worklet — drop a file like this anywhere under src/ named
// `*.sw.ts` and it is auto-discovered and compiled into combined-sw.js.

@ServiceWorklet()
export class CustomFeatureServiceWorklet implements ServiceWorkletEvents {
  sync(event: SyncEvent): void {
    console.log('custom feature background sync event', event.tag);
  }
}
