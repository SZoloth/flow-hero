import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH, cssGradient, parsePatch } from '../src/index';

describe('untrusted patches', () => {
  it('rejects colours that try to smuggle CSS', () => {
    const attempts = ['#fff;background:url(//evil.example/x)', '#fff)', 'url(x)', '#ff00ff00', 'red', ' #fff ;', '#ggg'];
    for (const color of attempts) {
      const p = parsePatch({ ink: { color }, background: { colors: [color, color] } });
      expect(p.ink.color).toBe(DEFAULT_PATCH.ink.color);
      expect(p.background.colors).toEqual(DEFAULT_PATCH.background.colors);
    }
    const css = cssGradient(parsePatch({ background: { colors: ['#000', '#fff;x:y'], angle: 1e9 } }).background.colors, 0);
    expect(css).not.toMatch(/[;:]x/);
  });

  it('does not pollute prototypes from nested __proto__ or constructor keys', () => {
    const payload = '{"__proto__":{"a":1},"ink":{"__proto__":{"b":1},"constructor":{"prototype":{"c":1}}},"background":{"colors":["#000","#fff"],"__proto__":{"d":1}}}';
    const p = parsePatch(payload);
    const probe = {} as Record<string, unknown>;
    expect([probe.a, probe.b, probe.c, probe.d]).toEqual([undefined, undefined, undefined, undefined]);
    expect(Object.getPrototypeOf(p.ink)).toBe(Object.prototype);
  });

  it('bounds sizes so a patch cannot make the engine allocate or loop without limit', () => {
    const p = parsePatch({
      name: 'x'.repeat(100000),
      background: { colors: Array(10000).fill('#123456'), angle: Infinity },
      warp: { detail: 1e9 },
      quality: { resolution: 1e9, maxDpr: 1e9 },
      ink: { size: 1e9, lifetime: 0 },
    });
    expect(p.name.length).toBe(64);
    expect(p.background.colors).toHaveLength(4);
    expect(p.background.angle).toBe(DEFAULT_PATCH.background.angle);
    expect(p.warp.detail).toBe(6);
    expect(p.quality).toEqual({ resolution: 1, maxDpr: 3 });
    expect(p.ink.size).toBe(0.5);
    expect(p.ink.lifetime).toBe(0.2);
  });

  it('treats non-object input as empty rather than throwing', () => {
    for (const input of [42, true, [], () => 1, Symbol('x'), '[1,2]', '{"ink":null}']) {
      expect(() => parsePatch(input)).not.toThrow();
    }
  });
});
