import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HEX = { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' };

function leaf(s) {
  const base = { title: s.label, description: s.help, default: s.default };
  switch (s.kind) {
    case 'number':
      return { ...base, type: s.step >= 1 ? 'integer' : 'number', minimum: s.min, maximum: s.max };
    case 'color':
      return { ...base, ...HEX };
    case 'colors':
      return { ...base, type: 'array', items: HEX, minItems: s.minItems, maxItems: s.maxItems };
    case 'enum':
      return { ...base, type: 'string', enum: [...s.options] };
    case 'text':
      return { ...base, type: 'string', maxLength: s.maxLength };
  }
  throw new Error(`unknown setting kind ${s.kind}`);
}

/** JSON Schema for a flow-hero patch, generated from the settings registry. */
export function renderSchema(settings, version) {
  const root = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://szoloth.github.io/flow-hero/schema.json',
    title: 'flow-hero patch',
    description: `Settings for a flow-hero background (flow-hero ${version}). Every key is optional: missing keys come from the preset or the default, out-of-range numbers are clamped, and unknown keys are dropped.`,
    type: 'object',
    additionalProperties: false,
    properties: { version: { const: 1 } },
  };
  for (const s of settings) {
    const keys = s.path.split('.');
    let node = root;
    for (const k of keys.slice(0, -1)) {
      node.properties[k] ??= { type: 'object', additionalProperties: false, properties: {} };
      node = node.properties[k];
    }
    node.properties[keys[keys.length - 1]] = leaf(s);
  }
  return `${JSON.stringify(root, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await build({ entryPoints: ['src/patch.ts'], bundle: true, format: 'esm', write: false, platform: 'neutral' });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  writeFileSync('schema.json', renderSchema(mod.SETTINGS, version));
  console.log('schema.json updated');
}
