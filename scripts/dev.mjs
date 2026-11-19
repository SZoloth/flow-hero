import { context } from 'esbuild';

const port = Number(process.env.PORT ?? 5174);
const ctx = await context({
  entryPoints: { main: 'playground/main.ts' },
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  outdir: 'playground/build',
  logLevel: 'info',
});
await ctx.watch();
await ctx.serve({ servedir: '.', host: '127.0.0.1', port });
console.log(`flow-hero playground: http://localhost:${port}/playground/`);
