import { describe, expect, it } from 'vitest';
import { PRESETS, SETTINGS, getSetting } from '../src/index';
import { MACROS, macroValue, nudgeMacro } from '../playground/macros';

const energy = MACROS.find((m) => m.id === 'energy')!;

describe('macros', () => {
  it('only point at real number settings', () => {
    const numbers = new Set(SETTINGS.filter((s) => s.kind === 'number').map((s) => s.path));
    for (const m of MACROS) for (const t of m.targets) expect(numbers.has(t.path)).toBe(true);
  });

  it('reads a value between 0 and 1 for every preset', () => {
    for (const p of Object.values(PRESETS)) {
      for (const m of MACROS) {
        const v = macroValue(p, m);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('moves every target the same way and keeps their spacing', () => {
    const before = PRESETS.ember;
    const after = nudgeMacro(before, energy, 0.1);
    for (const t of energy.targets) {
      expect(getSetting(after, t.path) as number).toBeGreaterThan(getSetting(before, t.path) as number);
    }
    expect(macroValue(after, energy)).toBeCloseTo(macroValue(before, energy) + 0.1, 5);
  });

  it('leaves settings outside the macro alone', () => {
    const after = nudgeMacro(PRESETS.aurora, energy, 0.3);
    expect(after.ink.color).toBe(PRESETS.aurora.ink.color);
    expect(after.background.colors).toEqual(PRESETS.aurora.background.colors);
  });

  it('clamps at the ends instead of overflowing', () => {
    const maxed = nudgeMacro(PRESETS.candy, energy, 5);
    expect(macroValue(maxed, energy)).toBe(1);
    expect(macroValue(nudgeMacro(maxed, energy, -5), energy)).toBe(0);
  });
});
