import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PRESETS, SETTINGS } from '../src/index';
// @ts-expect-error plain ESM script without type declarations
import { renderSchema } from '../scripts/schema.mjs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

it('schema.json matches the registry (run pnpm schema to fix)', () => {
  expect(readFileSync('schema.json', 'utf8')).toBe(renderSchema(SETTINGS, pkg.version));
});

it('every preset fits the schema bounds', () => {
  const schema = JSON.parse(readFileSync('schema.json', 'utf8'));
  for (const preset of Object.values(PRESETS)) {
    for (const s of SETTINGS) {
      const keys = s.path.split('.');
      let node = schema;
      let value: unknown = preset;
      for (const k of keys) {
        node = node.properties[k];
        value = (value as Record<string, unknown>)[k];
      }
      if (typeof value === 'number') {
        expect(value).toBeGreaterThanOrEqual(node.minimum);
        expect(value).toBeLessThanOrEqual(node.maximum);
      }
      if (node.enum) expect(node.enum).toContain(value);
    }
  }
});
