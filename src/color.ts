import type { Hex } from './patch';

export type Vec3 = [number, number, number];

export function hexToSrgb(hex: Hex): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** sRGB hex to OKLab (Björn Ottosson's published matrices). */
export function hexToOklab(hex: Hex): Vec3 {
  const [r, g, b] = hexToSrgb(hex).map(toLinear) as Vec3;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** The static CSS gradient used whenever WebGL is unavailable. Same angle convention as the shader. */
export function cssGradient(colors: readonly Hex[], angle: number): string {
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}
