import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH, PRESETS, parsePatch } from '../src/index';
import { IDLE_AFTER, wandererActive } from '../src/idle';

const never = -Infinity;

describe('idle.mode', () => {
  it('off never wanders', () => {
    expect(wandererActive('off', 10, never, true)).toBe(false);
    expect(wandererActive('off', 10, never, false)).toBe(false);
  });

  it('always wanders whenever input has paused', () => {
    expect(wandererActive('always', 10, never, true)).toBe(true);
    expect(wandererActive('always', 10, 9, true)).toBe(false);
    expect(wandererActive('always', 10, 10 - IDLE_AFTER - 0.1, true)).toBe(true);
  });

  it('attract wanders before the first input on every device', () => {
    expect(wandererActive('attract', 0, never, true)).toBe(true);
    expect(wandererActive('attract', 0, never, false)).toBe(true);
  });

  it('attract hands a mouse visitor the hero for good once they move', () => {
    expect(wandererActive('attract', 100, 1, true)).toBe(false);
  });

  it('attract comes back after a pause on touch devices', () => {
    expect(wandererActive('attract', 100, 1, false)).toBe(true);
    expect(wandererActive('attract', 2, 1, false)).toBe(false);
  });

  it('parses the mode and rejects unknown values', () => {
    expect(parsePatch({ idle: { mode: 'always' } }).idle.mode).toBe('always');
    expect(parsePatch({ idle: { mode: 'sometimes' } }).idle.mode).toBe(DEFAULT_PATCH.idle.mode);
  });

  it('ships attract on the dark presets so phones are never an empty hero', () => {
    expect(DEFAULT_PATCH.idle.mode).toBe('attract');
    expect(PRESETS.aurora.idle.mode).toBe('attract');
    expect(PRESETS.candy.idle.mode).toBe('always');
  });
});
