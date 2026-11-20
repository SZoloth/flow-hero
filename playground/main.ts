import { createDialKit, createDialRoot } from 'dialkit/vanilla';
import 'dialkit/styles.css';
import * as FH from '../src/index';
import type { FlowPatch } from '../src/index';
import { CUSTOM, dialConfig, patchToValues, valuesToPatch, type DialValues } from './dials';
import { MACROS, nudgeMacro } from './macros';
import { randomPatch } from './random';
import { makeScript } from './script';
import { htmlSnippet, reactSnippet } from './snippets';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);

function fromHash(): FlowPatch | undefined {
  const m = /^#p=(.+)$/.exec(location.hash);
  return m?.[1] ? FH.decodePatch(m[1]) : undefined;
}

const presetParam = params.get('preset');
let patch: FlowPatch = fromHash() ?? (FH.isPresetName(presetParam) ? FH.PRESETS[presetParam] : FH.PRESETS.ember);
if (params.has('bare')) document.documentElement.dataset.bare = '';
const hero = FH.createFlowHero($('hero'), patch, { forceRGBA8: params.has('rgba8') });

function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

const toast = $('toast');
let toastTimer = 0;
async function copy(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.textContent = `Copied ${what}`;
  } catch {
    toast.textContent = `Could not copy ${what}`;
  }
  toast.dataset.show = '';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => delete toast.dataset.show, 1600);
}

const kit = createDialKit('flow-hero', dialConfig(patch) as never, {
  onAction(action) {
    if (action === 'random') apply(randomPatch());
    else if (action === 'copyJson') void copy(JSON.stringify(patch, null, 2), 'patch JSON');
    else if (action === 'copyHtml') void copy(htmlSnippet(patch), 'HTML snippet');
    else if (action === 'copyReact') void copy(reactSnippet(patch), 'React snippet');
  },
});
const root = params.has('bare') ? undefined : createDialRoot({ position: 'top-right', defaultOpen: matchMedia('(min-width: 721px)').matches, theme: 'dark' });

let shown: DialValues = patchToValues(patch);
let hashTimer = 0;

function apply(next: FlowPatch): void {
  patch = next;
  hero.setPatch(patch);
  const avg = patch.background.colors.reduce((sum, c) => sum + lightness(c), 0) / patch.background.colors.length;
  document.documentElement.dataset.tone = avg > 0.55 ? 'light' : 'dark';
  clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => history.replaceState(null, '', `${location.pathname}${location.search}#p=${FH.encodePatch(patch)}`), 200);
  shown = patchToValues(patch);
  kit.setValues(shown as never);
}

/** Turns one panel change into the next patch: a preset pick, a Feel macro nudge, or a raw setting. */
function fromPanel(values: DialValues): FlowPatch | undefined {
  if (values.preset !== shown.preset && values.preset !== CUSTOM && FH.isPresetName(values.preset)) return FH.PRESETS[values.preset];
  const feel = values.feel as Record<string, number>;
  const was = shown.feel as Record<string, number>;
  for (const m of MACROS) {
    const delta = (feel[m.id] ?? 0) - (was[m.id] ?? 0);
    if (Math.abs(delta) > 1e-6) return nudgeMacro(patch, m, delta);
  }
  const next = valuesToPatch(values, patch);
  return JSON.stringify(next) === JSON.stringify(patch) ? undefined : next;
}

function showsPatch(values: DialValues): boolean {
  return Object.entries(shown).every(([key, want]) => {
    const got = values[key];
    if (typeof want !== 'object' || want === null) return got === want;
    return Object.entries(want).every(([k, v]) => (got as Record<string, unknown> | undefined)?.[k] === v);
  });
}

kit.subscribe((values) => {
  const next = fromPanel(values as DialValues);
  if (next) apply(next);
  // A value the patch can't hold, such as a colour typed as oklch(), snaps back so the panel never shows a look the hero isn't drawing.
  else if (!showsPatch(values as DialValues)) kit.setValues(shown as never);
}, false);

$('cta').addEventListener('click', () => copy(htmlSnippet(patch), 'HTML snippet'));

addEventListener('hashchange', () => {
  const next = fromHash();
  if (next && JSON.stringify(next) !== JSON.stringify(patch)) apply(next);
});

apply(patch);
Object.assign(window, { hero, FH, kit, root, script: makeScript(hero), randomPatch });
