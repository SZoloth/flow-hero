import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const FILES = ['README.md', 'skills/flow-hero/SKILL.md', 'examples/html/index.html'];

it('every pinned CDN link points at the current version', () => {
  for (const f of FILES) {
    const pins = [...readFileSync(f, 'utf8').matchAll(/flow-hero@([0-9][^/"'\s)]*)/g)].map((m) => m[1]);
    expect(pins.length, f).toBeGreaterThan(0);
    for (const pin of pins) expect(pin, f).toBe(version);
  }
});
