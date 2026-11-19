import { DEFAULT_PATCH, parsePatch, type FlowPatch } from './patch';

export const PRESETS = {
  ember: DEFAULT_PATCH,
  aurora: parsePatch({
    name: 'aurora',
    background: { colors: ['#0a1030', '#050816', '#02040b'], angle: 170, motion: 0.25 },
    ink: { color: '#2bd67b', hueShift: 0.35, intensity: 0.55, size: 0.22, lifetime: 3.2, drift: 0.3, spread: 0.55, blend: 'add' },
    warp: { amount: 0.42, scale: 0.8, speed: 0.05, detail: 5 },
    grain: 0.05,
    idle: { mode: 'attract', speed: 0.35, size: 0.8 },
  }),
  'ink-on-paper': parsePatch({
    name: 'ink-on-paper',
    background: { colors: ['#f6f1e7', '#ece4d4'], angle: 160, motion: 0.05 },
    ink: { color: '#16130f', hueShift: 0.04, intensity: 1.8, size: 0.11, lifetime: 3, drift: 0.2, spread: 0.3, blend: 'multiply' },
    warp: { amount: 0.16, scale: 3.2, speed: 0.04, detail: 6 },
    grain: 0.18,
    idle: { mode: 'attract', speed: 0.4, size: 0.8 },
  }),
  candy: parsePatch({
    name: 'candy',
    background: { colors: ['#ffb3d1', '#c7b8ff', '#9fe3ff', '#fff1a8'], angle: 115, motion: 0.85 },
    ink: { color: '#ffffff', hueShift: 0, intensity: 1.5, size: 0.24, lifetime: 1.8, drift: 0.6, spread: 0.45, blend: 'screen' },
    warp: { amount: 0.36, scale: 1.2, speed: 0.22, detail: 4 },
    grain: 0.03,
    idle: { mode: 'always', speed: 0.6, size: 0.9 },
  }),
} satisfies Record<string, FlowPatch>;

export type PresetName = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

export function isPresetName(name: unknown): name is PresetName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, name);
}
