# flow-hero build spec

**Goal.** flow-hero is an open-source (MIT) way for anyone to put a pointer-reactive smoke-and-gradient hero on their own site and make it look like theirs. It recreates the class of effect described in `docs/TEARDOWN.md` (the onlook.com hero). It is an independent implementation: write every shader and line from the behaviour described there, never from Onlook's or Unicorn Studio's code. Inspiration for the open-source shape is `stackedlol/ascii-sharks`: zero dependencies, small, TypeScript. Its gap is that the look is hard-coded. flow-hero's answer is a patch file: a small JSON object of named settings that fully describes a look, with presets you can share.

## Data shape first

```ts
type Hex = `#${string}`;
interface FlowPatch {
  version: 1;
  name: string;
  background: { colors: Hex[] /* 2–4 stops */; angle: number /* deg */; motion: number /* 0–1, slow drift of the stops */ };
  ink: {
    color: Hex;            // accent
    hueShift: number;      // 0–1: how much the stroke-direction hue shows (0 = pure accent)
    intensity: number;     // 0–2
    size: number;          // brush radius, fraction of the short side
    lifetime: number;      // seconds until a trail is about gone (time-based, refresh-rate independent)
    drift: number;         // 0–1: how far ink keeps travelling along its stroke direction
    spread: number;        // 0–1: blur per second
    blend: 'add' | 'screen' | 'multiply';
  };
  warp: { amount: number; scale: number; speed: number; detail: 3 | 4 | 5 | 6 /* octaves */ };
  grain: number;           // 0–1 film grain/dither
  idle: { enabled: boolean; speed: number; size: number }; // seeded wanderer that draws ink with no pointer
  quality: { resolution: number /* 0.25–1, sim + warp buffers */; maxDpr: number };
}
```

You may adjust names, but keep one **settings registry** (path, label, min, max, step, kind, default) as the single source. Patch parsing and clamping, the playground's controls and the README's settings table all come from it. Parse untrusted patches at the boundary: unknown keys dropped, numbers clamped, missing keys defaulted, so the engine trusts its types.

## Engine behaviour

Follow `docs/TEARDOWN.md`'s three layers, merged into as few passes as is clean. The suggested shape is one simulation pass into a ping-pong buffer, then one composite pass to screen.

- **Trail buffer.** Store direction (a signed 2D vector) and strength explicitly. Don't use the HSV packing. Prefer RGBA16F when `EXT_color_buffer_float` is present. Fall back to RGBA8 with encoding plus a small subtractive floor, so 8-bit decay reaches zero and leaves no ghosts.
- **Time.** All decay, drift and blur scale with real `dt`, clamped to about 1/20 s after a stall, so 60 Hz and 120 Hz look the same.
- **Brush.** Splat the segment from the previous to the current pointer position. Radius grows with speed. New ink overwrites old in proportion to its strength.
- **Composite.** Mix the base gradient in OKLab and add ink with the chosen blend. The ink colour is a mix of the accent and the direction hue (`hueShift`). Sample both through the domain-warp field (nested fbm). Add grain. Light backgrounds with `multiply` must darken, not glow.
- **Input.** Listen for pointer moves on `window` and map them into the canvas's rect. The canvas is `pointer-events: none` and `aria-hidden`. Touch moves count. Ink only appears while the pointer is over the canvas rect.
- **Lifecycle.** `createFlowHero(target, patch?) → { setPatch(p), pause(), resume(), step(dt), pointer(x, y), destroy() }`. `step` and `pointer` exist for tests and scripted recordings. Live patch updates must not reset the trail.
- **Gates** (from Sam's house WebGL rules). Each failure falls back to a static CSS gradient of the patch's background colours, never a black box:
  - no WebGL2, a software renderer (`swiftshader|llvmpipe|software`), or a shader that fails to link: fall back
  - `webglcontextlost`: fall back, then recover on restore
  - `prefers-reduced-motion`: render one deterministic still frame with a little seeded ink, then stop
  - off screen (IntersectionObserver) or hidden tab: stop the loop
  - device pixel ratio: capped at `quality.maxDpr`
- **SSR-safe.** Nothing touches `window` or `document` at import time.

## Presets (at least 4, visibly different in character, not just recolours)

Never name one after Onlook.

1. **ember**: near-black, crimson and orange smoke, `add`. Closest to the reference.
2. **aurora**: deep navy, iridescent teal and green, high `hueShift`, long lifetime, broad slow warp.
3. **ink-on-paper**: off-white background, near-black ink, `multiply`, small brush, tight warp. A light-mode proof.
4. **candy**: saturated pastel gradient with real motion, white `screen` ink, idle wanderer on.

## Packaging

- `src/` in TypeScript, strict. Zero runtime dependencies. React is an optional peer dependency used only by the React entry.
- **Entries:**
  - `flow-hero` (core ESM)
  - `flow-hero/element` (`<flow-hero preset="ember">`, plus a `patch` attribute holding JSON or `src="/my-patch.json"`, defined on import)
  - `flow-hero/react` (`<FlowHero patch={...} />`)
  - an IIFE build for a plain `<script>` tag
- **Build.** esbuild plus `tsc --emitDeclarationOnly` through pnpm scripts. pnpm only, never npm.
- **Budget.** The core build should stay under 15 KB minified and gzipped. Add a `pnpm size` script that prints it.
- **Tests.** Vitest for patch parsing and the registry (behaviour: clamping, defaults, unknown keys, round trip). No GPU tests in Vitest.
- **Playground** (`playground/index.html`, `pnpm dev` serves it):
  - full-viewport hero with sample headline text over it, using the staggered blur-up intro from the teardown in CSS
  - a control panel generated from the registry, plus a preset picker
  - "Copy patch JSON", "Copy HTML snippet" and "Copy React snippet"
  - the patch mirrored into the URL hash so a link reproduces a look
  - a "Random" button that rolls a tasteful patch within sane ranges
- **README.** What it is (one GIF or screenshot slot), install, three usage snippets (script tag, web component, React), the settings table (generated from the registry by a script), presets, how to make your own patch, accessibility and performance notes, credit ("inspired by the onlook.com hero, built with Unicorn Studio; this is an independent implementation"), and the MIT license file.

## Done means

1. `pnpm install && pnpm build && pnpm test && pnpm size` all pass. Report the measured size.
2. The playground runs in a real GPU browser, not SwiftShader. Use Chrome for Testing via `agent-browser --args "--use-angle=metal,--enable-gpu,--ignore-gpu-blocklist"`, and print the renderer string first. **Never script `/Applications/Google Chrome.app`.**
3. Screenshots of each preset: at rest, mid-stroke (drive a scripted in-page pointer path with `requestAnimationFrame` through the engine's `pointer()`, not one CLI call per move), and one second later. Also at 390 px width. Save them to `docs/screenshots/` and look at every one yourself.
4. Measured frame time at 1440×900 with the ember preset, via in-page timing over 300 frames, with the renderer string reported.
5. The context-loss test (`WEBGL_lose_context`) falls back and recovers. The reduced-motion emulation shows the still frame.
6. No console errors.
