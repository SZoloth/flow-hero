import { PRESETS, PRESET_NAMES, SETTINGS, getSetting, parsePatch, type FlowPatch, type Setting } from '../src/index';
import { MACROS, macroValue } from './macros';

export const CUSTOM = 'custom';
const STOP_KEYS = ['stop1', 'stop2', 'stop3', 'stop4'] as const;

type Folder = Record<string, unknown>;
export type DialValues = Record<string, unknown>;

const folderKey = (s: Setting): string => s.group.toLowerCase();
const leafKey = (s: Setting): string => s.path.split('.').pop() as string;

/** The preset a patch matches exactly, or `custom`. */
export function presetOf(patch: FlowPatch): string {
  return PRESET_NAMES.find((n) => JSON.stringify(PRESETS[n]) === JSON.stringify(patch)) ?? CUSTOM;
}

/** The DialKit panel definition, built from the settings registry so new settings appear on their own. */
export function dialConfig(patch: FlowPatch): Record<string, unknown> {
  const config: Record<string, unknown> = {
    preset: { type: 'select', options: [CUSTOM, ...PRESET_NAMES], default: presetOf(patch) },
    feel: Object.fromEntries(MACROS.map((m) => [m.id, [macroValue(patch, m), 0, 1, 0.01]])),
  };
  for (const s of SETTINGS) {
    const folder = (config[folderKey(s)] ??= { _collapsed: true }) as Folder;
    const value = getSetting(patch, s.path);
    switch (s.kind) {
      case 'number':
        folder[leafKey(s)] = [value, s.min, s.max, s.step];
        break;
      case 'color':
        folder[leafKey(s)] = { type: 'color', default: value };
        break;
      case 'colors': {
        const colors = value as string[];
        folder.stops = [colors.length, s.minItems, s.maxItems, 1];
        STOP_KEYS.slice(0, s.maxItems).forEach((k, i) => (folder[k] = { type: 'color', default: colors[i] ?? colors[colors.length - 1] }));
        break;
      }
      case 'enum':
        folder[leafKey(s)] = { type: 'select', options: [...s.options], default: value };
        break;
      case 'text':
        folder[leafKey(s)] = { type: 'text', default: value };
        break;
    }
  }
  config.random = { type: 'action', label: 'Random look' };
  config.copyJson = { type: 'action', label: 'Copy patch JSON' };
  config.copyHtml = { type: 'action', label: 'Copy HTML' };
  config.copyReact = { type: 'action', label: 'Copy React' };
  return config;
}

/** The panel values that show this patch. */
export function patchToValues(patch: FlowPatch): DialValues {
  const values: DialValues = {
    preset: presetOf(patch),
    feel: Object.fromEntries(MACROS.map((m) => [m.id, macroValue(patch, m)])),
  };
  for (const s of SETTINGS) {
    const folder = (values[folderKey(s)] ??= {}) as Folder;
    const value = getSetting(patch, s.path);
    if (s.kind === 'colors') {
      const colors = value as string[];
      folder.stops = colors.length;
      STOP_KEYS.slice(0, s.maxItems).forEach((k, i) => (folder[k] = colors[i] ?? colors[colors.length - 1]));
    } else {
      folder[leafKey(s)] = value;
    }
  }
  return values;
}

/** Reads the raw settings back out of the panel. Anything malformed falls back to `base`. */
export function valuesToPatch(values: DialValues, base: FlowPatch): FlowPatch {
  const draft: Record<string, unknown> = {};
  for (const s of SETTINGS) {
    const folder = (values[folderKey(s)] ?? {}) as Folder;
    let value: unknown;
    if (s.kind === 'colors') {
      const count = Math.round(Number(folder.stops));
      value = STOP_KEYS.slice(0, count).map((k) => folder[k]);
    } else {
      value = folder[leafKey(s)];
    }
    const keys = s.path.split('.');
    let node = draft;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
    node[keys[keys.length - 1] as string] = value;
  }
  return parsePatch(draft, base);
}
