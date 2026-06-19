// Build the custom service worker (src/combined.sw.ts) into a single bundle.
//
// Worklet discovery: combined.sw.ts imports the virtual module `virtual:worklets`.
// The plugin below resolves that import by globbing `src/**/*.sw.ts` (via the
// well-maintained `tinyglobby`) and emitting side-effect imports for each match,
// so every @ServiceWorklet() decorator runs. This happens inside the same esbuild
// pass — no separate codegen step and no generated .ts file on disk.
//
// Usage (wired to the same npm script names as before):
//   node esbuild.sw.mjs           -> public/combined-sw.js (dev)
//   node esbuild.sw.mjs --watch   -> dev build + rebuild on change/add/remove
//   node esbuild.sw.mjs --prod    -> minified dist build

import * as esbuild from 'esbuild';
import { globSync } from 'tinyglobby';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WORKLET_GLOB = 'src/**/*.sw.ts';
const ENTRY = resolve(ROOT, 'src/combined.sw.ts');
const WATCH = process.argv.includes('--watch');
const PROD = process.argv.includes('--prod');

const OUTFILE = PROD
  ? resolve(ROOT, 'dist/angular-advanced-pwa-example/browser/combined-sw.js')
  : resolve(ROOT, 'public/combined-sw.js');

/** Resolves `virtual:worklets` to a barrel of side-effect imports for every worklet. */
const workletsPlugin = {
  name: 'virtual-worklets',
  setup(build) {
    const NAMESPACE = 'virtual-worklets';

    build.onResolve({ filter: /^virtual:worklets$/ }, () => ({
      path: 'virtual:worklets',
      namespace: NAMESPACE,
    }));

    build.onLoad({ filter: /.*/, namespace: NAMESPACE }, () => {
      // Re-glob on every (re)build so added/removed worklets are picked up.
      const files = globSync(WORKLET_GLOB, {
        cwd: ROOT,
        absolute: true,
        ignore: [ENTRY], // combined.sw.ts is the bootstrap entry, not a worklet
      }).sort();

      const contents = files.map((file) => `import ${JSON.stringify(file)};`).join('\n');

      // esbuild's watchDirs is non-recursive, so register every directory under
      // src/ (plus src/ itself). Adding or removing a *.sw.ts file in any of them
      // invalidates this virtual module and triggers a re-glob + rebuild.
      const watchDirs = [
        resolve(ROOT, 'src'),
        ...globSync('src/**/', { cwd: ROOT, absolute: true, onlyDirectories: true }),
      ];

      return {
        contents: contents || '// no *.sw.ts worklets found',
        resolveDir: ROOT,
        loader: 'ts',
        watchDirs,
      };
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [ENTRY],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  tsconfig: resolve(ROOT, 'src/tsconfig.sw.json'),
  outfile: OUTFILE,
  minify: PROD,
  plugins: [workletsPlugin],
  logLevel: 'info',
};

if (WATCH) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[esbuild.sw] watching for changes...');
} else {
  await esbuild.build(options);
}
