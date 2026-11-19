import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('site', { recursive: true, force: true });
mkdirSync('site', { recursive: true });

await build({
  entryPoints: { main: 'playground/main.ts' },
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outdir: 'site/build',
  logLevel: 'info',
});

cpSync('playground/index.html', 'site/index.html');
