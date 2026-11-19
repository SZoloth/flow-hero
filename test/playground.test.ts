import { describe, expect, it } from 'vitest';
import { PRESETS, parsePatch } from '../src/index';
import { randomPatch } from '../playground/random';
import { htmlSnippet, reactSnippet } from '../playground/snippets';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Random', () => {
  it('rolls patches that survive parsing unchanged', () => {
    for (let i = 0; i < 500; i++) {
      const p = randomPatch(seeded(i));
      expect(parsePatch(JSON.parse(JSON.stringify(p)))).toEqual(p);
    }
  });

  it('uses all three blend modes across rolls', () => {
    const blends = new Set(Array.from({ length: 200 }, (_, i) => randomPatch(seeded(i)).ink.blend));
    expect(blends).toEqual(new Set(['add', 'screen', 'multiply']));
  });
});

describe('snippets', () => {
  it('uses the preset attribute for an unmodified preset', () => {
    expect(htmlSnippet(PRESETS.aurora)).toContain('preset="aurora"');
    expect(reactSnippet(PRESETS.candy)).toContain('preset="candy"');
  });

  it('embeds a custom patch that parses back to itself', () => {
    const custom = parsePatch({ name: "it's mine", ink: { color: '#123456' } });
    const html = htmlSnippet(custom);
    const attr = /patch='([^']*)'/.exec(html)?.[1] ?? '';
    expect(parsePatch(attr.replace(/&#39;/g, "'").replace(/&amp;/g, '&'))).toEqual(custom);
    expect(reactSnippet(custom)).toContain('"#123456"');
  });
});
