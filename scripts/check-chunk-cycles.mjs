#!/usr/bin/env node
// Chunk import-cycle guard (runs in `npm run ci` after the build). No dependencies.
//
// A static import cycle between production chunks means one chunk can run before a chunk it
// depends on has finished initialising. In November 2026 a custom manualChunks split put React in
// one chunk and React-dependent libraries in another that imported each other; the built site
// crashed on load ("Cannot set properties of undefined (setting 'Activity')") while dev and the
// tests were green. This reads Vite's build manifest (build.manifest in vite.config.ts) and fails
// if any cycle exists in the static `imports` graph. Dynamic imports (lazy routes) are not edges:
// they load after the importer has run, so they cannot cause this.
//
// Usage: node scripts/check-chunk-cycles.mjs [--manifest <path>]

import { existsSync, readFileSync } from 'node:fs';

const flag = process.argv.indexOf('--manifest');
const path = flag === -1 ? 'dist/.vite/manifest.json' : process.argv[flag + 1];

if (!path || !existsSync(path)) {
  console.error(`check-chunk-cycles: ${path ?? '(none)'} not found. Run the build first.`);
  process.exit(1);
}

/** @type {Record<string, { file: string, imports?: string[] }>} */
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const keys = Object.keys(manifest);

/** @type {Map<string, number>} 1 = on the current DFS path, 2 = finished */
const state = new Map();
/** @type {string[][]} */
const cycles = [];
/** @type {string[]} */
const stack = [];

/** @param {string} key */
function visit(key) {
  state.set(key, 1);
  stack.push(key);
  for (const next of manifest[key]?.imports ?? []) {
    if (!(next in manifest)) continue;
    if (state.get(next) === 1) {
      cycles.push([...stack.slice(stack.indexOf(next)), next]);
    } else if (!state.has(next)) {
      visit(next);
    }
  }
  stack.pop();
  state.set(key, 2);
}

for (const key of keys) if (!state.has(key)) visit(key);

if (cycles.length > 0) {
  console.error(`check-chunk-cycles: ${String(cycles.length)} import cycle(s) between chunks:`);
  for (const cycle of cycles) {
    console.error(`  ${cycle.map((key) => manifest[key]?.file ?? key).join(' -> ')}`);
  }
  console.error('Remove the split that causes it (see build.rollupOptions in vite.config.ts).');
  process.exit(1);
}

console.log(`check-chunk-cycles: ${String(keys.length)} chunks, no import cycles.`);
