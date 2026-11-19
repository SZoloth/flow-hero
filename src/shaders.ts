export const MAX_POINTS = 8;

export const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HASH = `
uint hash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}`;

const PRECISION = `precision highp float;
precision highp int;
precision highp sampler2D;`;

const INK_CODEC = `
uniform bool uPacked;
vec3 loadInk(sampler2D tex, vec2 uv) {
  vec4 t = texture(tex, uv);
  if (!uPacked) return t.xyz;
  return vec3((floor(t.xy * 255.0 + 0.5) - 128.0) / 127.0, t.z);
}
vec4 storeInk(vec3 ink) {
  if (!uPacked) return vec4(ink, 1.0);
  return vec4((floor(clamp(ink.xy, -1.0, 1.0) * 127.0 + 0.5) + 128.0) / 255.0, ink.z, 1.0);
}`;

/**
 * Ink simulation. Each texel holds (direction.xy, strength). Old ink advects along
 * its own direction, swirls faintly where it is thin, blurs, and decays per second.
 * New ink is stamped as capsules along the pointer path and replaces old ink in
 * proportion to its strength. Distances are in short-side units.
 */
export const SIMULATE = `#version 300 es
${PRECISION}
in vec2 vUv;
out vec4 outInk;
uniform sampler2D uPrev;
uniform vec2 uUnit;
uniform float uDt;
uniform float uTime;
uniform float uDecay;
uniform float uDrift;
uniform float uSpread;
uniform float uBlurRadius;
uniform float uSeed;
uniform int uCount;
uniform vec4 uSeg[${MAX_POINTS}];
uniform vec2 uBrush[${MAX_POINTS}];
${INK_CODEC}
${HASH}

vec2 swirl(vec2 p, float t) {
  vec2 acc = vec2(0.0);
  float f = 3.0;
  float a = 0.0;
  for (int i = 0; i < 5; i++) {
    a += 1.1;
    vec2 d = vec2(cos(a), sin(a));
    float s = sin(dot(p, d) * f + t * (0.6 + 0.2 * float(i)));
    acc += vec2(-d.y, d.x) * s / f;
    f *= 1.9;
  }
  return acc;
}

void main() {
  vec2 p = vUv / uUnit;
  vec3 here = loadInk(uPrev, vUv);
  float thin = 1.0 - clamp(here.z, 0.0, 1.0);
  vec2 back = here.xy * here.z * uDrift + swirl(p, uTime) * 0.5 * thin;
  vec2 src = vUv - back * uDt * uUnit;

  vec3 c = loadInk(uPrev, src);
  vec2 r = uBlurRadius * uUnit;
  vec3 n = loadInk(uPrev, src + vec2(r.x, 0.0)) + loadInk(uPrev, src - vec2(r.x, 0.0))
         + loadInk(uPrev, src + vec2(0.0, r.y)) + loadInk(uPrev, src - vec2(0.0, r.y));
  c = mix(c, n * 0.25, 1.0 - exp(-uSpread * uDt));
  c.z *= exp(-uDecay * uDt);

  for (int i = 0; i < ${MAX_POINTS}; i++) {
    if (i >= uCount) break;
    vec2 a = uSeg[i].xy;
    vec2 b = uSeg[i].zw;
    vec2 ab = b - a;
    float len2 = dot(ab, ab);
    float h = len2 > 0.0 ? clamp(dot(p - a, ab) / len2, 0.0, 1.0) : 0.0;
    float d = length(p - a - ab * h) / uBrush[i].x;
    float fall = 1.0 - smoothstep(0.0, 1.0, d);
    float w = fall * fall * uBrush[i].y;
    vec2 dir = len2 > 0.0 ? ab * inversesqrt(len2) : c.xy;
    c.xy = mix(c.xy, dir, w);
    c.z = mix(c.z, fall, w);
  }
  if (uPacked && c.z > 0.0) {
    // Unbiased rounding: 8-bit decay then tracks the float curve on average and still reaches 0.
    float r = float(hash(uvec3(uvec2(gl_FragCoord.xy), uint(uSeed))) & 0xffffu) / 65536.0;
    c.z = max(c.z + (r - 0.5) / 255.0, 0.0);
  }
  if (c.z <= 0.0) c.xy = vec2(0.0);
  outInk = storeInk(c);
}`;

/**
 * Composite. Resamples the gradient and the ink through a nested-fbm domain warp,
 * colours ink by rotating the accent's OKLab hue by stroke direction, blends,
 * converts to sRGB and adds grain.
 */
export const COMPOSITE = `#version 300 es
${PRECISION}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uInk;
uniform vec2 uRes;
uniform vec2 uUnit;
uniform float uTime;
uniform vec3 uStops[4];
uniform int uStopCount;
uniform float uAngle;
uniform float uMotion;
uniform vec3 uAccent;
uniform float uHueShift;
uniform float uIntensity;
uniform int uBlend;
uniform float uWarpAmount;
uniform float uWarpScale;
uniform float uWarpSpeed;
uniform int uOctaves;
uniform float uGrain;
uniform float uFrame;
${INK_CODEC}
${HASH}

vec2 grad(ivec2 cell, uint seed) {
  float a = float(hash(uvec3(uvec2(cell + 4096), seed)) & 0xffffu) * (6.2831853 / 65536.0);
  return vec2(cos(a), sin(a));
}

float noise(vec2 p, uint seed) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n00 = dot(grad(i, seed), f);
  float n10 = dot(grad(i + ivec2(1, 0), seed), f - vec2(1.0, 0.0));
  float n01 = dot(grad(i + ivec2(0, 1), seed), f - vec2(0.0, 1.0));
  float n11 = dot(grad(i + ivec2(1, 1), seed), f - vec2(1.0, 1.0));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

const mat2 TURN = mat2(0.87758, 0.47943, -0.47943, 0.87758);

float fbm(vec2 p, uint seed) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= uOctaves) break;
    sum += amp * noise(p, seed);
    p = TURN * p * 2.5 + 17.3;
    amp *= 0.59;
  }
  return sum;
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 gradientAt(vec2 uv) {
  vec2 px = (uv - 0.5) * uRes;
  vec2 dir = vec2(sin(uAngle), cos(uAngle));
  float len = abs(uRes.x * dir.x) + abs(uRes.y * dir.y);
  float t = dot(px, dir) / len + 0.5;
  t += uMotion * 0.22 * sin(uTime * 0.21);
  t = clamp(t, 0.0, 1.0);
  float span = float(uStopCount - 1);
  float x = t * span;
  int k = int(min(floor(x), span - 1.0));
  vec3 a = uStops[0];
  vec3 b = uStops[1];
  for (int i = 1; i < 3; i++) {
    if (i == k) { a = uStops[i]; b = uStops[i + 1]; }
  }
  return mix(a, b, x - float(k));
}

void main() {
  vec2 shortUv = vUv / uUnit;
  float t = uTime * uWarpSpeed;
  float ca = 0.6561, sa = -0.7547;
  vec2 p = mat2(ca, sa, -sa, ca) * (shortUv - vec2(0.57, 0.35) / uUnit) * uWarpScale;
  p += vec2(t * 0.9, -t * 0.6);
  vec2 q = vec2(fbm(p, 1u), fbm(p + vec2(5.2, 1.3) + t * 0.3, 2u));
  vec2 w = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2), 3u), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.2, 4u));
  vec2 offset = w * uWarpAmount;
  vec2 uv = vUv + offset * uUnit;

  vec3 base = max(oklabToLinear(gradientAt(uv)), 0.0);

  vec3 ink = loadInk(uInk, uv);
  float strength = clamp(ink.z, 0.0, 1.0);
  float density = clamp(0.85 + 1.3 * (length(q) - 0.22) + 0.9 * w.x, 0.35, 1.35);
  float amount = pow(strength, 1.35) * uIntensity * mix(1.0, density, min(uWarpAmount * 3.0, 1.0));

  float along = clamp(dot(ink.xy, vec2(0.8, 0.6)), -1.0, 1.0);
  float swing = uHueShift * 3.14159265 * mix(0.55, 1.0, 0.5 + 0.5 * along) * clamp(length(ink.xy), 0.0, 1.0);
  float cs = cos(swing), sn = sin(swing);
  vec3 tint = vec3(uAccent.x, cs * uAccent.y - sn * uAccent.z, sn * uAccent.y + cs * uAccent.z);
  vec3 inkColor = max(oklabToLinear(tint), 0.0);

  vec3 color;
  if (uBlend == 1) {
    color = 1.0 - (1.0 - base) * (1.0 - clamp(inkColor * amount, 0.0, 1.0));
  } else if (uBlend == 2) {
    color = base * mix(vec3(1.0), inkColor, clamp(amount, 0.0, 1.0));
  } else {
    color = base + inkColor * amount;
  }

  vec3 srgb = linearToSrgb(color);
  float g = float(hash(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame))) & 0xffffu) / 65535.0;
  srgb += (g - 0.5) * (uGrain * 0.12 + 0.004);
  outColor = vec4(srgb, 1.0);
}`;
