import { build } from 'esbuild';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

const shared = { bundle: true, minify: true, target: 'es2020', legalComments: 'none', logLevel: 'info' };

await build({
  ...shared,
  entryPoints: { index: 'src/index.ts', element: 'src/element.ts', react: 'src/react.ts' },
  outdir: 'dist',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  external: ['react'],
});

writeFileSync('dist/react.js', `'use client';\n${readFileSync('dist/react.js', 'utf8')}`);

await build({
  ...shared,
  entryPoints: ['src/iife.ts'],
  outfile: 'dist/flow-hero.iife.js',
  format: 'iife',
  globalName: 'FlowHero',
});
