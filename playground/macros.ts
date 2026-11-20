import { SETTINGS, getSetting, withSetting, type FlowPatch, type Setting } from '../src/index';

type NumberSetting = Extract<Setting, { kind: 'number' }>;

export interface Macro {
  id: string;
  label: string;
  help: string;
  targets: readonly { path: string; invert?: boolean }[];
}

export const MACROS: readonly Macro[] = [
  {
    id: 'energy',
    label: 'Energy',
    help: 'How lively it feels: how far ink travels, how fast the smoke churns and how much the background moves.',
    targets: [{ path: 'ink.drift' }, { path: 'warp.speed' }, { path: 'background.motion' }],
  },
  {
    id: 'texture',
    label: 'Texture',
    help: 'Soft glow at the left, torn, grainy smoke at the right.',
    targets: [{ path: 'warp.amount' }, { path: 'warp.detail' }, { path: 'grain' }, { path: 'ink.spread', invert: true }],
  },
  {
    id: 'brush',
    label: 'Brush',
    help: 'Thin wisps at the left, broad bright clouds at the right.',
    targets: [{ path: 'ink.size' }, { path: 'idle.size' }, { path: 'ink.intensity' }],
  },
];

const numberSetting = new Map(
  SETTINGS.filter((s): s is NumberSetting => s.kind === 'number').map((s) => [s.path, s]),
);

function spec(path: string): NumberSetting {
  const s = numberSetting.get(path);
  if (!s) throw new Error(`macro target ${path} is not a number setting`);
  return s;
}

function position(patch: FlowPatch, path: string, invert = false): number {
  const s = spec(path);
  const n = ((getSetting(patch, path) as number) - s.min) / (s.max - s.min);
  return invert ? 1 - n : n;
}

/** Where the macro sits for this patch: the mean position of its targets, 0 to 1. */
export function macroValue(patch: FlowPatch, macro: Macro): number {
  const sum = macro.targets.reduce((acc, t) => acc + position(patch, t.path, t.invert), 0);
  return Math.min(1, Math.max(0, sum / macro.targets.length));
}

/** Moves every target by the same share of its range, so the patch keeps its character. */
export function nudgeMacro(patch: FlowPatch, macro: Macro, delta: number): FlowPatch {
  let next = patch;
  for (const t of macro.targets) {
    const s = spec(t.path);
    const n = Math.min(1, Math.max(0, position(patch, t.path, t.invert) + delta));
    next = withSetting(next, t.path, s.min + (t.invert ? 1 - n : n) * (s.max - s.min));
  }
  return next;
}
