import * as FH from '../src/index';
import type { FlowPatch, Setting } from '../src/index';
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
const body = $('panel-body');
const presetSelect = $<HTMLSelectElement>('preset');
const inputs = new Map<string, (value: unknown) => void>();

function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

let hashTimer = 0;

function apply(next: FlowPatch, from?: string): void {
  patch = next;
  hero.setPatch(patch);
  const avg = patch.background.colors.reduce((sum, c) => sum + lightness(c), 0) / patch.background.colors.length;
  document.documentElement.dataset.tone = avg > 0.55 ? 'light' : 'dark';
  clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => history.replaceState(null, '', `${location.pathname}${location.search}#p=${FH.encodePatch(patch)}`), 200);
  const match = FH.PRESET_NAMES.find((n) => JSON.stringify(FH.PRESETS[n]) === JSON.stringify(patch));
  presetSelect.value = match ?? '';
  for (const [path, set] of inputs) if (path !== from) set(FH.getSetting(patch, path));
}

const update = (path: string, value: unknown): void => apply(FH.withSetting(patch, path, value), path);

function control(s: Setting): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';
  const id = `s-${s.path.replace('.', '-')}`;
  const label = Object.assign(document.createElement('label'), { textContent: s.label, htmlFor: id, title: s.help });
  row.append(label);

  if (s.kind === 'number') {
    const input = Object.assign(document.createElement('input'), { type: 'range', id, min: String(s.min), max: String(s.max), step: String(s.step) });
    const out = document.createElement('output');
    out.htmlFor.add(id);
    const digits = s.step >= 1 ? 0 : s.step >= 0.1 ? 1 : 2;
    input.addEventListener('input', () => {
      update(s.path, Number(input.value));
      out.textContent = Number(FH.getSetting(patch, s.path)).toFixed(digits);
    });
    inputs.set(s.path, (v) => {
      input.value = String(v);
      out.textContent = Number(v).toFixed(digits);
    });
    row.append(input, out);
  } else if (s.kind === 'color') {
    row.classList.add('wide');
    const input = Object.assign(document.createElement('input'), { type: 'color', id });
    input.addEventListener('input', () => update(s.path, input.value));
    inputs.set(s.path, (v) => (input.value = String(v)));
    row.append(input);
  } else if (s.kind === 'colors') {
    row.classList.add('wide');
    const wrap = document.createElement('div');
    wrap.className = 'swatches';
    wrap.id = id;
    const current = (): string[] => FH.getSetting(patch, s.path) as string[];
    const render = (colors: string[]): void => {
      wrap.replaceChildren(
        ...colors.map((c, i) => {
          const input = Object.assign(document.createElement('input'), { type: 'color', value: c, ariaLabel: `Stop ${i + 1}` });
          input.addEventListener('input', () => update(s.path, current().map((x, j) => (j === i ? input.value : x))));
          return input;
        }),
      );
      if (colors.length > s.minItems) {
        const minus = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '−', ariaLabel: 'Remove stop' });
        minus.addEventListener('click', () => apply(FH.withSetting(patch, s.path, current().slice(0, -1))));
        wrap.append(minus);
      }
      if (colors.length < s.maxItems) {
        const plus = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '+', ariaLabel: 'Add stop' });
        plus.addEventListener('click', () => {
          const now = current();
          apply(FH.withSetting(patch, s.path, [...now, now[now.length - 1]]));
        });
        wrap.append(plus);
      }
    };
    inputs.set(s.path, (v) => render(v as string[]));
    row.append(wrap);
  } else if (s.kind === 'enum') {
    row.classList.add('wide');
    const select = Object.assign(document.createElement('select'), { id });
    select.append(...s.options.map((o) => new Option(o, o)));
    select.addEventListener('change', () => update(s.path, select.value));
    inputs.set(s.path, (v) => (select.value = String(v)));
    row.append(select);
  } else {
    row.classList.add('wide');
    const input = Object.assign(document.createElement('input'), { type: 'text', id, maxLength: s.maxLength, spellcheck: false });
    input.addEventListener('input', () => update(s.path, input.value));
    inputs.set(s.path, (v) => (input.value = String(v)));
    row.append(input);
  }
  return row;
}

const groups = new Map<string, HTMLFieldSetElement>();
for (const s of FH.SETTINGS) {
  let set = groups.get(s.group);
  if (!set) {
    set = document.createElement('fieldset');
    set.append(Object.assign(document.createElement('legend'), { textContent: s.group }));
    groups.set(s.group, set);
    body.append(set);
  }
  set.append(control(s));
}

presetSelect.append(new Option('Custom', ''), ...FH.PRESET_NAMES.map((n) => new Option(n, n)));
presetSelect.options[0]!.disabled = true;
presetSelect.addEventListener('change', () => {
  if (FH.isPresetName(presetSelect.value)) apply(FH.PRESETS[presetSelect.value]);
});
$('random').addEventListener('click', () => apply(randomPatch()));

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
$('copy-json').addEventListener('click', () => copy(JSON.stringify(patch, null, 2), 'patch JSON'));
$('copy-html').addEventListener('click', () => copy(htmlSnippet(patch), 'HTML snippet'));
$('copy-react').addEventListener('click', () => copy(reactSnippet(patch), 'React snippet'));
$('cta').addEventListener('click', () => copy(htmlSnippet(patch), 'HTML snippet'));

const toggle = $('toggle');
toggle.addEventListener('click', () => {
  const panel = $('panel');
  const open = panel.toggleAttribute('data-open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Close' : 'Edit';
});

addEventListener('hashchange', () => {
  const next = fromHash();
  if (next && JSON.stringify(next) !== JSON.stringify(patch)) apply(next);
});

apply(patch);
Object.assign(window, { hero, FH, script: makeScript(hero), randomPatch });
