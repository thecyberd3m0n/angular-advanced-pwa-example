/// <reference lib="webworker" />

// Service worker bootstrap entry — compiled to public/combined-sw.js via esbuild
// (see the `build:sw*` npm scripts).
//
// Pipeline:
//   1. `import 'virtual:worklets'` pulls in every `*.sw.ts` worklet (resolved by
//      esbuild.sw.mjs at build time) so each @ServiceWorklet() decorator runs
//      and registers the class.
//   2. `importScripts('./ngsw-worker.js')` loads Angular's caching engine FIRST
//      (synchronously), so its install/activate/fetch listeners register before
//      ours — preserving the existing update-on-reload behavior.
//   3. `bootstrapWorklets()` instantiates each worklet and wires its methods to
//      the service worker scope.
//
// To add a feature: create a `*.sw.ts` file anywhere under src/ exporting a
// class decorated with @ServiceWorklet(). No manual wiring required.

import { bootstrapWorklets } from './sw/service-worklet';
// Virtual module resolved by esbuild.sw.mjs at build time (see virtual-worklets.d.ts).
// The editor's TS server can lag in picking up the ambient declaration, so silence
// the stale "cannot find module" squiggle; tsc -p src/tsconfig.sw.json passes clean.
// @ts-ignore
import 'virtual:worklets';

declare const self: ServiceWorkerGlobalScope;

console.log('[combined-sw] script evaluated');

// Load the default Angular PWA caching mechanism first. Under `ng serve` (dev)
// Angular does NOT emit ngsw-worker.js, so guard with try/catch: the worker
// still installs in dev (without ngsw caching); a real build keeps full caching.
try {
  importScripts('./ngsw-worker.js');
  console.log('[combined-sw] ngsw-worker.js imported');
} catch (error) {
  console.log(
    '[combined-sw] ngsw-worker.js not available (dev mode?) — skipping ngsw',
    String(error)
  );
}

// Wire up all registered worklets after ngsw has registered its own listeners.
bootstrapWorklets();
