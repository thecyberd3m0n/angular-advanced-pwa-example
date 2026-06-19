/// <reference lib="webworker" />

// ServiceWorklet framework
// ----------------------------------------------------------------------------
// Lets feature authors drop a `*.sw.ts` file containing a class decorated with
// `@ServiceWorklet()`. Each method on the class maps to a ServiceWorker event
// (see EVENT_MAP). At bundle time a codegen step (scripts/generate-worklets.mjs)
// imports every worklet so its decorator runs and registers the class here.
// At runtime `bootstrapWorklets()` instantiates each worklet and wires its
// methods to `self.addEventListener(...)`.
//
// Design choices (confirmed with the project owner):
//   - Discovery:   auto glob -> generated barrel (no manual imports).
//   - Async:       return a Promise and it is passed to event.waitUntil().
//   - Composition: additive. Every worklet + ngsw-worker.js all run.
//   - Lifetime:    zero-arg classes, instantiated with `new Worklet()`.

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Event types not present in the stock `webworker` TS lib.
// ---------------------------------------------------------------------------

/** Background Sync API — fired for a one-off `sync` registration. */
export interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

/** Periodic Background Sync API — fired for a `periodicsync` registration. */
export interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

// ---------------------------------------------------------------------------
// Public surface: the event hooks a worklet may implement.
// ---------------------------------------------------------------------------

/**
 * Every hook is optional. Implement only the events your feature needs.
 *
 * Returning a `Promise` (e.g. `async sync() { ... }`) keeps the service worker
 * alive until it settles — the framework calls `event.waitUntil(result)` for
 * you on events that support it. Returning `void` is fire-and-forget.
 */
export interface ServiceWorkletEvents {
  /** Worker is installing. Pre-cache or prepare resources here. */
  install?(event: ExtendableEvent): void | Promise<unknown>;
  /** Worker is activating. Clean up old state / claim clients here. */
  activate?(event: ExtendableEvent): void | Promise<unknown>;
  /** A network request was issued by a controlled page. */
  fetch?(event: FetchEvent): void | Promise<unknown>;
  /** A push message arrived from the server. */
  push?(event: PushEvent): void | Promise<unknown>;
  /** A one-off background sync fired (Background Sync API). */
  sync?(event: SyncEvent): void | Promise<unknown>;
  /** A periodic background sync fired (Periodic Background Sync API). */
  periodicSync?(event: PeriodicSyncEvent): void | Promise<unknown>;
  /** A `postMessage` was received from a client. */
  message?(event: ExtendableMessageEvent): void | Promise<unknown>;
  /** A `postMessage` failed to deserialize. */
  messageError?(event: MessageEvent): void | Promise<unknown>;
  /** The user clicked a notification shown by this worker. */
  notificationClick?(event: NotificationEvent): void | Promise<unknown>;
  /** A notification shown by this worker was dismissed. */
  notificationClose?(event: NotificationEvent): void | Promise<unknown>;
  /** The push subscription changed and must be renewed. */
  pushSubscriptionChange?(event: ExtendableEvent): void | Promise<unknown>;
}

/** Options accepted by the `@ServiceWorklet()` decorator. */
export interface ServiceWorkletOptions {
  /** Human-readable name used in logs. Defaults to the class name. */
  name?: string;
  /**
   * Registration order. Lower numbers register their listeners first.
   * Listeners fire in registration order, so this controls relative ordering
   * between worklets. Defaults to `0`.
   */
  order?: number;
  /** Set `false` to keep the file bundled but skip wiring it. Defaults to `true`. */
  enabled?: boolean;
}

/** A zero-argument constructor producing a worklet instance. */
export type ServiceWorkletConstructor = new () => ServiceWorkletEvents;

// ---------------------------------------------------------------------------
// Internal registry + event name mapping.
// ---------------------------------------------------------------------------

interface RegisteredWorklet {
  ctor: ServiceWorkletConstructor;
  options: Required<ServiceWorkletOptions>;
}

/** Maps a hook method name -> the DOM ServiceWorker event name it listens to. */
const EVENT_MAP = {
  install: 'install',
  activate: 'activate',
  fetch: 'fetch',
  push: 'push',
  sync: 'sync',
  periodicSync: 'periodicsync',
  message: 'message',
  messageError: 'messageerror',
  notificationClick: 'notificationclick',
  notificationClose: 'notificationclose',
  pushSubscriptionChange: 'pushsubscriptionchange',
} as const satisfies Record<keyof ServiceWorkletEvents, string>;

const REGISTRY: RegisteredWorklet[] = [];
const LOG = '[service-worklet]';

// ---------------------------------------------------------------------------
// Decorator.
// ---------------------------------------------------------------------------

/**
 * Marks a class as a ServiceWorklet so its event methods get wired to the
 * service worker scope at bootstrap.
 *
 * @example
 * ```ts
 * \@ServiceWorklet()
 * export class CustomFeatureServiceWorklet implements ServiceWorkletEvents {
 *   sync(event: SyncEvent): void {
 *     console.log('custom feature background sync event');
 *   }
 * }
 * ```
 */
export function ServiceWorklet(options: ServiceWorkletOptions = {}) {
  return function <T extends ServiceWorkletConstructor>(target: T): T {
    REGISTRY.push({
      ctor: target,
      options: {
        name: options.name ?? target.name,
        order: options.order ?? 0,
        enabled: options.enabled ?? true,
      },
    });
    return target;
  };
}

// ---------------------------------------------------------------------------
// Bootstrap.
// ---------------------------------------------------------------------------

/**
 * Instantiates every registered worklet and binds its implemented hooks to the
 * service worker scope. Call this once, after `importScripts('./ngsw-worker.js')`
 * so Angular's listeners register first.
 */
export function bootstrapWorklets(): void {
  const worklets = REGISTRY.filter((w) => w.options.enabled).sort(
    (a, b) => a.options.order - b.options.order
  );

  for (const { ctor, options } of worklets) {
    const instance = new ctor();

    for (const method of Object.keys(EVENT_MAP) as (keyof ServiceWorkletEvents)[]) {
      const handler = instance[method];
      if (typeof handler !== 'function') {
        continue;
      }

      const eventName = EVENT_MAP[method];
      self.addEventListener(eventName, (event: Event) => {
        const result = (handler as (e: Event) => void | Promise<unknown>).call(instance, event);
        if (isPromise(result) && 'waitUntil' in event) {
          (event as ExtendableEvent).waitUntil(result);
        }
      });

      console.log(`${LOG} bound ${options.name}.${method} -> '${eventName}'`);
    }
  }

  console.log(`${LOG} bootstrapped ${worklets.length} worklet(s)`);
}

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof (value as Promise<unknown> | undefined)?.then === 'function';
}
