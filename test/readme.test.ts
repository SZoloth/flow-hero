import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SETTINGS } from '../src/index';
// @ts-expect-error plain ESM script without type declarations
import { renderTable, replaceTable } from '../scripts/settings-table.mjs';

it('README settings table matches the registry (run pnpm settings-table to fix)', () => {
  const readme = readFileSync('README.md', 'utf8');
  expect(replaceTable(readme, renderTable(SETTINGS))).toBe(readme);
});
