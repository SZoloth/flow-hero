import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PATCH,
  PRESETS,
  PRESET_NAMES,
  SETTINGS,
  decodePatch,
  encodePatch,
  getSetting,
  parsePatch,
  withSetting,
  type FlowPatch,
} from '../src/index';

describe('registry', () => {
  it('has one entry per settable path, and the default patch is built from it', () => {
    const paths = SETTINGS.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const s of SETTINGS) expect(getSetting(DEFAULT_PATCH, s.path)).toEqual(s.default);
  });

  it('keeps every numeric default inside its own range', () => {
    for (const s of SETTINGS) {
      if (s.kind !== 'number') continue;
      expect(s.default, s.path).toBeGreaterThanOrEqual(s.min);
      expect(s.default, s.path).toBeLessThanOrEqual(s.max);
    }
  });
});

describe('parsePatch', () => {
  it('fills a complete patch from nothing', () => {
    expect(parsePatch(undefined)).toEqual(DEFAULT_PATCH);
    expect(parsePatch({})).toEqual(DEFAULT_PATCH);
    expect(parsePatch('not json')).toEqual(DEFAULT_PATCH);
    expect(parsePatch(null)).toEqual(DEFAULT_PATCH);
  });

  it('clamps numbers to the registry range', () => {
    const p = parsePatch({ ink: { intensity: 99, lifetime: -4 }, quality: { resolution: 0 } });
    expect(p.ink.intensity).toBe(2);
    expect(p.ink.lifetime).toBe(0.2);
    expect(p.quality.resolution).toBe(0.25);
  });

  it('rounds integer settings', () => {
    expect(parsePatch({ warp: { detail: 4.6 } }).warp.detail).toBe(5);
    expect(parsePatch({ warp: { detail: 12 } }).warp.detail).toBe(6);
  });

  it('defaults wrongly typed or non-finite values', () => {
    const p = parsePatch({ ink: { size: '0.3', drift: Number.NaN, blend: 'overlay', color: 'red' }, idle: { mode: true } });
    expect(p.ink.size).toBe(DEFAULT_PATCH.ink.size);
    expect(p.ink.drift).toBe(DEFAULT_PATCH.ink.drift);
    expect(p.ink.blend).toBe(DEFAULT_PATCH.ink.blend);
    expect(p.ink.color).toBe(DEFAULT_PATCH.ink.color);
    expect(p.idle.mode).toBe(DEFAULT_PATCH.idle.mode);
  });

  it('drops unknown keys at every level', () => {
    const p = parsePatch({ evil: 1, ink: { onload: 'x' }, background: { colors: ['#000', '#fff'], extra: true } }) as unknown as Record<string, unknown>;
    expect(p).not.toHaveProperty('evil');
    expect(p.ink).not.toHaveProperty('onload');
    expect(p.background).not.toHaveProperty('extra');
  });

  it('normalises colours and enforces 2 to 4 stops', () => {
    expect(parsePatch({ ink: { color: '#ABC' } }).ink.color).toBe('#aabbcc');
    expect(parsePatch({ background: { colors: ['#111111'] } }).background.colors).toEqual(DEFAULT_PATCH.background.colors);
    expect(parsePatch({ background: { colors: ['#1', '#000', 'nope', '#fff'] } }).background.colors).toEqual(['#000000', '#ffffff']);
    expect(parsePatch({ background: { colors: ['#000', '#111', '#222', '#333', '#444'] } }).background.colors).toHaveLength(4);
  });

  it('always reports version 1', () => {
    expect(parsePatch({ version: 7 }).version).toBe(1);
  });

  it('layers a partial patch over a base', () => {
    const p = parsePatch({ ink: { color: '#ffffff' } }, PRESETS.aurora);
    expect(p.ink.color).toBe('#ffffff');
    expect(p.ink.lifetime).toBe(PRESETS.aurora.ink.lifetime);
    expect(p.background).toEqual(PRESETS.aurora.background);
  });

  it('accepts a JSON string', () => {
    expect(parsePatch('{"grain":0.5}').grain).toBe(0.5);
  });

  it('does not share arrays with its base', () => {
    const p = parsePatch({});
    p.background.colors.push('#ffffff');
    expect(DEFAULT_PATCH.background.colors).toHaveLength(3);
  });
});

describe('presets', () => {
  it('has at least four, each surviving a parse unchanged', () => {
    expect(PRESET_NAMES.length).toBeGreaterThanOrEqual(4);
    for (const name of PRESET_NAMES) {
      const preset: FlowPatch = PRESETS[name];
      expect(parsePatch(preset), name).toEqual(preset);
      expect(parsePatch(JSON.parse(JSON.stringify(preset))), name).toEqual(preset);
      expect(preset.name).toBe(name);
    }
  });

  it('covers every blend mode', () => {
    expect(new Set(PRESET_NAMES.map((n) => PRESETS[n].ink.blend))).toEqual(new Set(['add', 'screen', 'multiply']));
  });
});

describe('sharing', () => {
  it('round-trips through the URL encoding', () => {
    for (const name of PRESET_NAMES) expect(decodePatch(encodePatch(PRESETS[name]))).toEqual(PRESETS[name]);
  });

  it('returns undefined for garbage and parses hostile payloads', () => {
    expect(decodePatch('%%%')).toBeUndefined();
    const hostile = btoa('{"ink":{"intensity":1e9},"__proto__":{"polluted":true}}');
    expect(decodePatch(hostile)?.ink.intensity).toBe(2);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('withSetting changes one path and clamps it', () => {
    const p = withSetting(DEFAULT_PATCH, 'warp.amount', 5);
    expect(p.warp.amount).toBe(1);
    expect(p.ink).toEqual(DEFAULT_PATCH.ink);
  });
});
