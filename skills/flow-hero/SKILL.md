---
name: flow-hero
description: Add a flow-hero background (pointer-following smoke over a gradient, WebGL2, zero dependencies) to a website's hero section, and match it to the site's colours. Use when asked to add flow-hero, a smoke or ink hero, a pointer-reactive hero background, or an Onlook-style hero to a site.
---

# Add flow-hero to a site

flow-hero draws a gradient with smoke that follows the pointer, behind a container's existing content. One JSON object, a patch, sets the whole look. Package: `flow-hero` on npm. Playground for picking a look: https://szoloth.github.io/flow-hero/. Patch schema: https://szoloth.github.io/flow-hero/schema.json (also `node_modules/flow-hero/schema.json`).

## 1. Pick the integration from the project

| The project has | Do this |
| --- | --- |
| React or Next.js (`react` in package.json) | `pnpm add flow-hero` (or the project's package manager), then wrap the hero in `<FlowHero>` from `flow-hero/react`. The built file already carries `'use client'`, so it works inside a Next.js server component page. |
| Vue, Svelte, Astro, Solid or another bundler | Install, then `import 'flow-hero/element'` once in client code and use `<flow-hero>` in markup. |
| Plain HTML, no bundler | `<script src="https://unpkg.com/flow-hero@0/dist/flow-hero.iife.js"></script>` and `<flow-hero>`. |

Use the hero section that already exists. Don't add a new one or move its content.

## 2. Wire it in

React:

```tsx
import { FlowHero } from 'flow-hero/react';

<FlowHero preset="ember" style={{ minHeight: '100vh' }} className="…the section's existing classes…">
  …the section's existing children…
</FlowHero>
```

Web component (any framework or plain HTML):

```html
<flow-hero preset="ember" style="display:block; min-height:100vh">
  …the section's existing children…
</flow-hero>
```

Rules that prevent the common breakages:
- The container needs a height (`min-height` or content that gives it one). With zero height there is nothing to draw on.
- flow-hero sets `position: relative` (if the container was static) and `isolation: isolate` on the container, and puts its canvas behind the children. A child that relied on `z-index` to escape the section may now stay inside it; check overlays, sticky headers and dropdowns that start in the hero.
- The canvas ignores pointer events, so links and buttons keep working. Don't add `pointer-events` rules.
- Keep the text readable on the background colours alone. The ink fades in seconds and can't carry contrast.
- Never put it inside a component that re-mounts on every render; it creates a WebGL context each time it mounts.

## 3. Match the site's look

Start from the closest preset, then layer a partial patch. Read the site's own colour tokens (CSS custom properties, Tailwind theme, design tokens) and use them; don't invent colours.

| Site background | Start from | Then set |
| --- | --- | --- |
| Dark, near-black | `ember` | `ink.color` to the brand accent |
| Dark, coloured (navy, deep green) | `aurora` | `background.colors` to 2–4 of the site's dark tones, `ink.color` to the accent |
| Light, paper, off-white | `ink-on-paper` | `background.colors` to the light tones, `ink.color` to the text or brand colour. Keep `ink.blend: "multiply"`; `add` glows invisibly on light backgrounds. |
| Bright, pastel, playful | `candy` | `background.colors` to the palette |

Example partial patch: `{"background":{"colors":["#0b1020","#05070f"]},"ink":{"color":"#7c5cff"}}`. Colours must be `#rgb` or `#rrggbb` hex; other formats are ignored. Pass it as `patch={…}` in React or `patch='…'` on the element. Validate against the schema if you generate it.

Defaults you usually leave alone: `idle.mode: "attract"` (draws a little smoke before the visitor moves, and on phones), `quality.*` (already capped for large screens).

## 4. Check it

1. Build the project as it normally builds (for Next.js, `next build`; it must not error about `window` or `customElements`).
2. Open the page in a browser with a real GPU. In the console, the hero element's engine reports its state: for `<flow-hero>`, `document.querySelector('flow-hero').hero.status`; for React, use the `onReady` prop. `status.mode` should be `"webgl"`. `"fallback"` means no WebGL2 or a software renderer (headless browsers often use one); the page then shows a static CSS gradient of the background colours, which is the intended fallback, not a bug.
3. Move the pointer over the hero: smoke should follow and fade within about a second.
4. Check the headline contrast, and check the page at phone width.

## When something's off

| Symptom | Cause and fix |
| --- | --- |
| Nothing visible | The container has no height, or the background colours equal the page's. Give it `min-height`. |
| Black box | Shouldn't happen; the fallback is the CSS gradient. Check `status.reason` and the console. |
| Ink invisible on a light background | `ink.blend` is `add` or `screen`; use `multiply`. |
| Slow on old laptops | Lower `warp.detail` to 3 and `quality.resolution` to 0.5. |
| Overlay or menu now hidden behind the next section | The container's `isolation: isolate` created a stacking context; move the overlay out of the hero or raise the hero's own `z-index`. |
