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
cpSync('playground/og.png', 'site/og.png');
cpSync('playground/llms.txt', 'site/llms.txt');
cpSync('schema.json', 'site/schema.json');
cpSync('skills/flow-hero/SKILL.md', 'site/skill.md');
