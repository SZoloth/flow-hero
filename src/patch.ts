import { IDLE_MODES, type IdleMode } from './idle';
export type Hex = `#${string}`;
export type BlendMode = 'add' | 'screen' | 'multiply';
export type Octaves = 3 | 4 | 5 | 6;

export interface FlowPatch {
  version: 1;
  name: string;
  background: { colors: Hex[]; angle: number; motion: number };
  ink: {
    color: Hex;
    hueShift: number;
    intensity: number;
    size: number;
    lifetime: number;
    drift: number;
    spread: number;
    blend: BlendMode;
  };
  warp: { amount: number; scale: number; speed: number; detail: Octaves };
  grain: number;
  idle: { mode: IdleMode; speed: number; size: number };
  quality: { resolution: number; maxDpr: number };
}

export type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type PatchInput = DeepPartial<FlowPatch>;

interface SettingBase<D> {
  path: string;
  label: string;
  group: string;
  help: string;
  default: D;
}
export interface NumberSetting extends SettingBase<number> {
  kind: 'number';
  min: number;
  max: number;
  step: number;
}
export interface ColorSetting extends SettingBase<Hex> {
  kind: 'color';
}
export interface ColorListSetting extends SettingBase<Hex[]> {
  kind: 'colors';
  minItems: number;
  maxItems: number;
}
export interface EnumSetting extends SettingBase<string> {
  kind: 'enum';
  options: readonly string[];
}
export interface TextSetting extends SettingBase<string> {
  kind: 'text';
  maxLength: number;
}
export type Setting = NumberSetting | ColorSetting | ColorListSetting | EnumSetting | TextSetting;

export const BLEND_MODES: readonly BlendMode[] = ['add', 'screen', 'multiply'];

export const SETTINGS: readonly Setting[] = [
  { path: 'name', kind: 'text', group: 'Patch', label: 'Name', maxLength: 64, default: 'ember', help: 'A label for the look. Not used for rendering.' },
  { path: 'background.colors', kind: 'colors', group: 'Background', label: 'Colours', minItems: 2, maxItems: 4, default: ['#151515', '#000000', '#000000'], help: 'Two to four gradient stops, blended in OKLab.' },
  { path: 'background.angle', kind: 'number', group: 'Background', label: 'Angle', min: 0, max: 360, step: 1, default: 135, help: 'Gradient direction in CSS degrees (0 points up, 90 points right).' },
  { path: 'background.motion', kind: 'number', group: 'Background', label: 'Motion', min: 0, max: 1, step: 0.01, default: 0.05, help: 'How far the stops drift back and forth over time.' },
  { path: 'ink.color', kind: 'color', group: 'Ink', label: 'Colour', default: '#f50032', help: 'The accent colour of the trail.' },
  { path: 'ink.hueShift', kind: 'number', group: 'Ink', label: 'Hue shift', min: 0, max: 1, step: 0.01, default: 0.22, help: 'How far the ink hue swings away from the accent. Stroke direction varies the swing. 0 is pure accent.' },
  { path: 'ink.intensity', kind: 'number', group: 'Ink', label: 'Intensity', min: 0, max: 2, step: 0.01, default: 0.8, help: 'Brightness (or darkness, for multiply) of the ink.' },
  { path: 'ink.size', kind: 'number', group: 'Ink', label: 'Brush size', min: 0.02, max: 0.5, step: 0.005, default: 0.24, help: 'Largest brush radius, as a fraction of the short side. Fast strokes reach it.' },
  { path: 'ink.lifetime', kind: 'number', group: 'Ink', label: 'Lifetime', min: 0.2, max: 8, step: 0.05, default: 1.2, help: 'Seconds until a trail is about gone. Time-based, so 60 Hz and 120 Hz match.' },
  { path: 'ink.drift', kind: 'number', group: 'Ink', label: 'Drift', min: 0, max: 1, step: 0.01, default: 0.45, help: 'How far ink keeps travelling along its stroke direction.' },
  { path: 'ink.spread', kind: 'number', group: 'Ink', label: 'Spread', min: 0, max: 1, step: 0.01, default: 0.65, help: 'How quickly ink blurs outward.' },
  { path: 'ink.blend', kind: 'enum', group: 'Ink', label: 'Blend', options: BLEND_MODES, default: 'add', help: 'add glows on dark, screen glows softly, multiply darkens light backgrounds.' },
  { path: 'warp.amount', kind: 'number', group: 'Warp', label: 'Amount', min: 0, max: 1, step: 0.01, default: 0.31, help: 'Strength of the turbulence the image is resampled through. This is what makes smoke billow.' },
  { path: 'warp.scale', kind: 'number', group: 'Warp', label: 'Scale', min: 0.2, max: 6, step: 0.05, default: 1.2, help: 'Size of the turbulence. Higher is finer.' },
  { path: 'warp.speed', kind: 'number', group: 'Warp', label: 'Speed', min: 0, max: 1, step: 0.01, default: 0.08, help: 'How fast the turbulence field drifts and evolves.' },
  { path: 'warp.detail', kind: 'number', group: 'Warp', label: 'Detail', min: 3, max: 6, step: 1, default: 6, help: 'Noise octaves. Fewer is cheaper and smoother.' },
  { path: 'grain', kind: 'number', group: 'Finish', label: 'Grain', min: 0, max: 1, step: 0.01, default: 0.06, help: 'Film grain. A little stops banding on dark gradients.' },
  { path: 'idle.mode', kind: 'enum', group: 'Idle', label: 'Wanderer', options: IDLE_MODES, default: 'attract', help: 'off never draws on its own. attract draws until the visitor first moves the pointer, and comes back after a pause only on touch devices. always draws after every pause.' },
  { path: 'idle.speed', kind: 'number', group: 'Idle', label: 'Speed', min: 0.05, max: 2, step: 0.01, default: 0.5, help: 'How fast the wanderer moves.' },
  { path: 'idle.size', kind: 'number', group: 'Idle', label: 'Size', min: 0.1, max: 2, step: 0.01, default: 0.7, help: 'Wanderer brush size relative to Brush size.' },
  { path: 'quality.resolution', kind: 'number', group: 'Quality', label: 'Resolution', min: 0.25, max: 1, step: 0.05, default: 0.75, help: 'Render scale for the warp pass. The ink simulation runs at half of this.' },
  { path: 'quality.maxDpr', kind: 'number', group: 'Quality', label: 'Max DPR', min: 0.5, max: 3, step: 0.25, default: 1.5, help: 'Caps device pixel ratio so large retina screens stay cheap.' },
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value: unknown): Hex | undefined {
  if (typeof value !== 'string' || !HEX.test(value.trim())) return undefined;
  let h = value.trim().slice(1).toLowerCase();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return `#${h}`;
}

function readPath(source: unknown, path: string): unknown {
  let node = source;
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    if (next && typeof next === 'object') node = next as Record<string, unknown>;
    else node = node[key] = {};
  }
  node[keys[keys.length - 1] as string] = value;
}

function clampToStep(s: NumberSetting, n: number): number {
  const c = Math.min(s.max, Math.max(s.min, n));
  return s.step >= 1 ? Math.round(c) : c;
}

function parseSetting(s: Setting, raw: unknown, fallback: unknown): unknown {
  switch (s.kind) {
    case 'number':
      return typeof raw === 'number' && Number.isFinite(raw) ? clampToStep(s, raw) : fallback;
    case 'color':
      return normalizeHex(raw) ?? fallback;
    case 'colors': {
      if (!Array.isArray(raw)) return fallback;
      const colors = raw.map(normalizeHex).filter((c): c is Hex => c !== undefined).slice(0, s.maxItems);
      return colors.length >= s.minItems ? colors : fallback;
    }
    case 'enum':
      return typeof raw === 'string' && s.options.includes(raw) ? raw : fallback;
    case 'text':
      return typeof raw === 'string' ? raw.slice(0, s.maxLength) : fallback;
  }
}

function cloneValue<T>(v: T): T {
  return Array.isArray(v) ? (v.slice() as T) : v;
}

function fromDefaults(): FlowPatch {
  const out: Record<string, unknown> = { version: 1 };
  for (const s of SETTINGS) writePath(out, s.path, cloneValue(s.default));
  return out as unknown as FlowPatch;
}

export const DEFAULT_PATCH: FlowPatch = fromDefaults();

/**
 * Parses untrusted input into a complete patch. Unknown keys are dropped,
 * numbers are clamped to the registry's range, and anything missing or
 * malformed comes from `base` (the default patch unless given).
 * Accepts an object or a JSON string.
 */
export function parsePatch(input: unknown, base: FlowPatch = DEFAULT_PATCH): FlowPatch {
  let source = input;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      source = undefined;
    }
  }
  const out: Record<string, unknown> = { version: 1 };
  for (const s of SETTINGS) {
    const fallback = cloneValue(readPath(base, s.path));
    writePath(out, s.path, parseSetting(s, readPath(source, s.path), fallback));
  }
  return out as unknown as FlowPatch;
}

export function getSetting(patch: FlowPatch, path: string): unknown {
  return readPath(patch, path);
}

/** Returns a new patch with one registry path changed, parsed through the same rules. */
export function withSetting(patch: FlowPatch, path: string, value: unknown): FlowPatch {
  const draft = JSON.parse(JSON.stringify(patch)) as Record<string, unknown>;
  writePath(draft, path, value);
  return parsePatch(draft, patch);
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Encodes a patch as a URL-safe string, for a link that reproduces a look. */
export function encodePatch(patch: FlowPatch): string {
  return toBase64Url(JSON.stringify(patch));
}

/** Decodes `encodePatch` output through `parsePatch`. Returns undefined if it is not a patch. */
export function decodePatch(encoded: string, base: FlowPatch = DEFAULT_PATCH): FlowPatch | undefined {
  try {
    return parsePatch(JSON.parse(fromBase64Url(encoded)), base);
  } catch {
    return undefined;
  }
}
