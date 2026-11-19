import { parsePatch, type FlowPatch, type Hex } from '../src/index';

type Rng = () => number;

const range = (rng: Rng, lo: number, hi: number): number => lo + (hi - lo) * rng();
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
const round = (n: number, step: number): number => Math.round(n / step) * step;

function oklchToHex(l: number, c: number, hDeg: number): Hex {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const hex = lin
    .map((v) => {
      const x = Math.min(1, Math.max(0, v));
      const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
      return Math.round(srgb * 255).toString(16).padStart(2, '0');
    })
    .join('');
  return `#${hex}`;
}

/**
 * Rolls a patch inside ranges that look good: a dark glow, a light ink wash, or a
 * pastel with soft white ink. Colours are picked in OKLCH so hues stay balanced.
 */
export function randomPatch(rng: Rng = Math.random): FlowPatch {
  const mood = pick(rng, ['dark', 'dark', 'dark', 'paper', 'pastel'] as const);
  const hue = range(rng, 0, 360);
  const stops = rng() < 0.5 ? 2 : 3;
  let colors: Hex[];
  let ink: Partial<FlowPatch['ink']>;
  if (mood === 'dark') {
    colors = Array.from({ length: stops }, (_, i) => oklchToHex(range(rng, 0.14, 0.22) - i * 0.06, range(rng, 0.01, 0.06), hue + i * 12));
    ink = {
      color: oklchToHex(range(rng, 0.62, 0.75), range(rng, 0.15, 0.24), hue + pick(rng, [0, 30, 150, 180, 210])),
      hueShift: round(range(rng, 0, 0.45), 0.01),
      intensity: round(range(rng, 0.6, 1), 0.01),
      blend: 'add',
    };
  } else if (mood === 'paper') {
    colors = Array.from({ length: stops }, (_, i) => oklchToHex(range(rng, 0.93, 0.97) - i * 0.03, range(rng, 0.005, 0.03), hue));
    ink = {
      color: oklchToHex(range(rng, 0.18, 0.35), range(rng, 0.02, 0.14), hue + 180),
      hueShift: round(range(rng, 0, 0.12), 0.01),
      intensity: round(range(rng, 1.3, 2), 0.01),
      blend: 'multiply',
    };
  } else {
    colors = Array.from({ length: stops + 1 }, (_, i) => oklchToHex(range(rng, 0.84, 0.92), range(rng, 0.06, 0.11), hue + i * range(rng, 40, 80)));
    ink = { color: '#ffffff', hueShift: 0, intensity: round(range(rng, 1.1, 1.6), 0.01), blend: 'screen' };
  }
  return parsePatch({
    name: `random-${Math.floor(rng() * 1e6).toString(36)}`,
    background: { colors, angle: Math.round(range(rng, 0, 360)), motion: round(range(rng, 0, mood === 'pastel' ? 0.9 : 0.3), 0.01) },
    ink: {
      ...ink,
      size: round(range(rng, 0.1, 0.3), 0.005),
      lifetime: round(range(rng, 0.8, 3.5), 0.05),
      drift: round(range(rng, 0.15, 0.7), 0.01),
      spread: round(range(rng, 0.25, 0.7), 0.01),
    },
    warp: { amount: round(range(rng, 0.15, 0.45), 0.01), scale: round(range(rng, 0.7, 2.6), 0.05), speed: round(range(rng, 0.03, 0.2), 0.01), detail: pick(rng, [4, 5, 6]) },
    grain: round(range(rng, 0.02, mood === 'paper' ? 0.2 : 0.08), 0.01),
    idle: { mode: mood === 'pastel' || rng() < 0.25 ? 'always' : 'attract', speed: round(range(rng, 0.3, 0.8), 0.01), size: round(range(rng, 0.6, 1), 0.01) },
  });
}
