import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const BUDGET = 15 * 1024;

async function standalone(entry) {
  const out = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'esm', target: 'es2020', write: false, external: ['react'], legalComments: 'none' });
  return out.outputFiles[0].contents;
}

const rows = [
  ['core (flow-hero)', await standalone('src/index.ts')],
  ['element (flow-hero/element)', await standalone('src/element.ts')],
  ['react (flow-hero/react)', await standalone('src/react.ts')],
  ['iife (dist/flow-hero.iife.js)', readFileSync('dist/flow-hero.iife.js')],
];

let failed = false;
for (const [name, bytes] of rows) {
  const gz = gzipSync(bytes, { level: 9 }).length;
  console.log(`${name.padEnd(32)} ${(bytes.length / 1024).toFixed(2).padStart(7)} KB min  ${(gz / 1024).toFixed(2).padStart(6)} KB gzip`);
  if (name.startsWith('core') && gz > BUDGET) failed = true;
}
console.log(`core budget: ${(BUDGET / 1024).toFixed(0)} KB gzip ${failed ? 'EXCEEDED' : 'ok'}`);
if (failed) process.exit(1);
