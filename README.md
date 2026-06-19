# Angular Advanced PWA Boilerplate

> ⚠️ **Experimental.** This is an experimental boilerplate exploring an advanced Service Worker
> building environment on top of Angular. APIs, file layout, and conventions are still evolving
> and **will change**. Use it to learn and prototype, not (yet) as a stable foundation.

An Angular boilerplate that lets you **extend Angular's stock PWA service worker** (`ngsw-worker.js`)
with your own custom Service Worker logic — without giving up Angular's built-in asset/data caching.

Custom features are written as small, self-contained **ServiceWorklets**: a class with one method per
Service Worker event. Drop a `*.sw.ts` file anywhere under `src/`, and it's auto-discovered, compiled,
and wired into the worker. No manual registration, no hand-written `addEventListener` boilerplate.

## Features

- **Composable custom Service Worker** — your code and Angular's `ngsw-worker.js` run side by side in
  the same worker scope via `importScripts()`. Caching keeps working; you add everything else.
- **ServiceWorklet framework** — author features as decorated classes (`@ServiceWorklet()`) where each
  method maps to a Service Worker event (`install`, `activate`, `fetch`, `push`, `sync`,
  `periodicsync`, `message`, `notificationclick`, and more).
- **Zero-config auto-discovery** — any `src/**/*.sw.ts` file is globbed at build time and bundled in.
  Add a file, get a feature. Remove it, it's gone.
- **Automatic `waitUntil()`** — return a `Promise` from a hook and the framework keeps the worker alive
  by calling `event.waitUntil()` for you.
- **Ordering & toggles** — control registration order with `order` and disable a worklet with
  `enabled: false`, without deleting the file.
- **Fast esbuild pipeline** — the worker bundles with esbuild (dev, watch, and minified prod modes),
  independent of the Angular build but aligned with the same npm scripts.
- **Dev-friendly** — under `ng serve` (where Angular doesn't emit `ngsw-worker.js`), the worker still
  installs and your worklets still run; full caching kicks in on a real build.
- **Bundled example worklets** — Web Push notifications, lifecycle/message logging, and a background
  sync stub to copy from.

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│  Browser registers: combined-sw.js                          │
│  (provideServiceWorker('combined-sw.js', …) in app.config)  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  combined-sw.js  (built from src/combined.sw.ts)            │
│                                                             │
│  1. import 'virtual:worklets'  → pulls in every *.sw.ts     │
│     so each @ServiceWorklet() decorator runs & registers    │
│  2. importScripts('./ngsw-worker.js')  → Angular caching    │
│     engine registers its listeners FIRST                    │
│  3. bootstrapWorklets()  → instantiates worklets and binds  │
│     each hook to self.addEventListener(...)                 │
└─────────────────────────────────────────────────────────────┘
```

Key files:

- [src/combined.sw.ts](src/combined.sw.ts) — worker entry point / bootstrap.
- [src/sw/service-worklet.ts](src/sw/service-worklet.ts) — the `@ServiceWorklet()` decorator,
  event hook interface, registry, and `bootstrapWorklets()`.
- [esbuild.sw.mjs](esbuild.sw.mjs) — esbuild config + virtual `virtual:worklets` module that globs
  `src/**/*.sw.ts`.
- [src/sw/worklets/](src/sw/worklets/) — example worklets.
- [src/app/app.config.ts](src/app/app.config.ts) — registers `combined-sw.js` instead of
  `ngsw-worker.js`.

## Getting started

Install dependencies:

```bash
npm install
```

Start the dev server. This runs `ng serve` and the service worker build in watch mode concurrently:

```bash
npm start
```

Then open `http://localhost:4200/`.

> Service workers and full ngsw caching only behave fully on a production build served over HTTP(S).
> To test the complete PWA, build and serve the output (see below).

## npm scripts

| Script | Description |
| --- | --- |
| `npm start` | `ng serve` + service worker watch build, concurrently. |
| `npm run build` | Production Angular build **and** minified service worker (`build:sw:prod`). |
| `npm test` | Run unit tests with [Vitest](https://vitest.dev/). |
| `npm run build:sw` | Build the service worker once → `public/combined-sw.js` (dev). |
| `npm run build:sw:watch` | Rebuild the service worker on change/add/remove. |
| `npm run build:sw:prod` | Minified service worker → `dist/.../browser/combined-sw.js`. |

### Production build & serve

```bash
npm run build
npx http-server dist/angular-advanced-pwa-example/browser -p 8080 -c-1
```

Open `http://localhost:8080/` and verify the worker in DevTools → **Application → Service Workers**.

## Writing a worklet

Create a `*.sw.ts` file anywhere under `src/` exporting a class decorated with `@ServiceWorklet()`.
Implement only the event hooks you need; return a `Promise` to keep the worker alive until it settles.

```ts
import { ServiceWorklet, type ServiceWorkletEvents, type SyncEvent } from '../service-worklet';

@ServiceWorklet({ name: 'MyFeature' })
export class MyFeatureServiceWorklet implements ServiceWorkletEvents {
  // Returning a Promise → framework calls event.waitUntil() for you.
  async sync(event: SyncEvent): Promise<void> {
    if (event.tag === 'flush-outbox') {
      await flushOutbox();
    }
  }
}
```

That's it — no manual import or registration. The next worker build picks it up automatically.

### Decorator options

```ts
@ServiceWorklet({
  name: 'MyFeature', // human-readable name for logs (defaults to class name)
  order: -100,       // lower numbers register listeners first (default 0)
  enabled: true,     // set false to bundle but skip wiring (default true)
})
```

### Available event hooks

Each hook is optional. Implement only what your feature needs:

| Hook | Service Worker event |
| --- | --- |
| `install` | `install` |
| `activate` | `activate` |
| `fetch` | `fetch` |
| `push` | `push` |
| `sync` | `sync` |
| `periodicSync` | `periodicsync` |
| `message` | `message` |
| `messageError` | `messageerror` |
| `notificationClick` | `notificationclick` |
| `notificationClose` | `notificationclose` |
| `pushSubscriptionChange` | `pushsubscriptionchange` |

## Example worklets

- [push-notification.sw.ts](src/sw/worklets/push-notification.sw.ts) — Web Push: shows a notification
  on `push` and focuses/opens the app on `notificationClick`.
- [lifecycle-logger.sw.ts](src/sw/worklets/lifecycle-logger.sw.ts) — logs `install`, `activate`, and
  `message` events (registered early via `order: -100`).
- [custom-feature.sw.ts](src/sw/worklets/custom-feature.sw.ts) — minimal Background Sync stub to copy.

## Tech stack

- Angular 21 (`@angular/service-worker` for ngsw caching)
- esbuild for the custom service worker bundle
- tinyglobby for worklet discovery
- Vitest for unit tests

## Status & roadmap

This boilerplate is **experimental and under active development**. Expect breaking changes to the
worklet API, decorator options, file conventions, and build pipeline as the design settles. Feedback
and experimentation are welcome.

## Contributors

See [CONTRIBUTORS.md](CONTRIBUTORS.md).
