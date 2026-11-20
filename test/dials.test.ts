import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH, PRESETS, SETTINGS, parsePatch } from '../src/index';
import { CUSTOM, dialConfig, patchToValues, presetOf, valuesToPatch } from '../playground/dials';

describe('DialKit mapping', () => {
  it('round-trips every preset through the panel values', () => {
    for (const p of Object.values(PRESETS)) expect(valuesToPatch(patchToValues(p), DEFAULT_PATCH)).toEqual(p);
  });

  it('gives every registry setting a control', () => {
    const config = JSON.stringify(dialConfig(DEFAULT_PATCH));
    for (const s of SETTINGS) {
      const leaf = s.kind === 'colors' ? 'stops' : (s.path.split('.').pop() as string);
      expect(config).toContain(`"${leaf}"`);
    }
  });

  it('uses only as many colour stops as the Stops slider says', () => {
    const values = patchToValues(PRESETS.candy);
    (values.background as Record<string, unknown>).stops = 2;
    expect(valuesToPatch(values, PRESETS.candy).background.colors).toEqual(PRESETS.candy.background.colors.slice(0, 2));
  });

  it('keeps the old value when the panel hands back something malformed', () => {
    const values = patchToValues(PRESETS.ember);
    (values.ink as Record<string, unknown>).color = 'oklch(0.6 0.2 30)';
    expect(valuesToPatch(values, PRESETS.ember).ink.color).toBe(PRESETS.ember.ink.color);
  });

  it('names the preset a patch matches, and custom otherwise', () => {
    expect(presetOf(PRESETS.aurora)).toBe('aurora');
    expect(presetOf(parsePatch({ ink: { size: 0.31 } }))).toBe(CUSTOM);
  });
});
