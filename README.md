# flow-hero

flow-hero adds a smoke-and-gradient background to the hero section of a web page. When a visitor moves the pointer over the hero, it leaves a trail of billowing smoke that drifts in the direction they moved and fades after about a second. A small JSON object, called a patch, sets the colours, brush, trail length, turbulence and blend mode. Four presets ship with the package, and the playground in this repo lets you build a patch with sliders and copy it.

![ember preset, mid-stroke](https://raw.githubusercontent.com/SZoloth/flow-hero/main/docs/ember.jpg)

**[Try the playground](https://szoloth.github.io/flow-hero/)**: pick a preset, drag the sliders, copy the result.

- Zero runtime dependencies. WebGL2 and TypeScript, about 10 KB gzipped for the module build and 11 KB for the script-tag build.
- Works as a script tag, a web component or a React component.
- Falls back to a static CSS gradient of your background colours when WebGL2 is missing, the GPU is a software renderer, a shader fails to compile, or the browser loses the WebGL context. It switches back when the context is restored.
- Draws one still frame when `prefers-reduced-motion` is set, and stops rendering while the hero is off screen or the tab is hidden.

Browser support: any browser with WebGL2, custom elements, `ResizeObserver` and `IntersectionObserver`, which covers current Chrome, Edge and Firefox, and Safari from version 15 (from published compatibility data, not tested here). Everything else gets the CSS gradient.

## Install

```sh
pnpm add flow-hero
```

npm and yarn work too. For a plain HTML page, load the script from a CDN instead.

## Use it with a coding agent

Paste this to Claude Code, Codex, Cursor or any agent working in your site's repo:

```text
Add flow-hero to this site's hero section. Follow https://szoloth.github.io/flow-hero/skill.md
```

The skill tells the agent how to pick the right integration for your framework, keep your existing hero content, match your colours using the [patch schema](https://szoloth.github.io/flow-hero/schema.json), and check the result. To keep it with your project, copy [`skills/flow-hero/SKILL.md`](skills/flow-hero/SKILL.md) into your agent's skills folder (for Claude Code, `.claude/skills/flow-hero/SKILL.md`). It also ships in the npm package at `node_modules/flow-hero/skills/flow-hero/SKILL.md`, next to `schema.json`.

Working examples: [Next.js App Router](examples/next) and [plain HTML](examples/html). CI builds the Next.js example against the packed package on every change.

## Usage

The hero fills its container and sits behind the container's children. The canvas ignores pointer events, so the text and buttons on top stay clickable, and the hero listens for pointer movement on the whole window instead.

Give the container a height. flow-hero does not style your content, so set a text colour that reads against your background. It also changes two styles on the container: it sets `position: relative` if the container is statically positioned, and `isolation: isolate` so the canvas can sit behind the children without going behind the page. The isolation creates a stacking context, which matters if children use `z-index` to escape the hero.

### Script tag

```html
<script src="https://unpkg.com/flow-hero@0.3.0/dist/flow-hero.iife.js"></script>

<flow-hero preset="ember" style="height: 100vh; color: white">
  <h1>Your headline</h1>
</flow-hero>
```

The script defines `<flow-hero>` and exposes the JavaScript API as `window.FlowHero`.

### Web component

```js
import 'flow-hero/element';
```

```html
<flow-hero preset="aurora" style="height: 100vh"></flow-hero>
<flow-hero src="/my-patch.json" style="height: 100vh"></flow-hero>
<flow-hero preset="candy" patch='{"ink":{"color":"#ff4f9a"}}' style="height: 100vh"></flow-hero>
```

Importing the module registers the element. Settings layer in this order: the preset, then the JSON file at `src`, then the inline `patch` attribute, and each layer only needs the keys it changes. With `src`, the element shows the preset until the file arrives; if the request fails, it logs a warning and keeps the preset. Changing an attribute updates the look and keeps the trail; a `quality` change resamples the trail into the new buffer size. The running engine is on `element.hero`.

### React

```tsx
'use client';
import { FlowHero } from 'flow-hero/react';

export function Hero() {
  return (
    <FlowHero preset="aurora" patch={{ ink: { color: '#7cf7c4' } }} style={{ height: '100vh', color: 'white' }}>
      <h1>Your headline</h1>
    </FlowHero>
  );
}
```

React is an optional peer dependency used only by `flow-hero/react`. The component renders a `div`, or the tag you pass as `as` (`section`, `header`, `main`, `article`, `aside`, `footer`) so an existing hero keeps its semantics, and `id`, `className`, `style` and `children` work as usual. The rendered element carries the engine as `.hero`, like the web component. It runs in the browser only; the built file carries a `'use client'` directive for frameworks with server components. Two more props: `options`, passed to `createFlowHero`, and `onReady`, called once with the engine so you can call `pause()` or `resume()`.

### JavaScript API

```js
import { createFlowHero, PRESETS } from 'flow-hero';

const hero = createFlowHero(document.querySelector('#hero'), PRESETS.ember);
hero.setPatch({ ink: { color: '#00e0ff' } });
hero.setPatch(PRESETS.aurora);
hero.pause();
hero.resume();
hero.destroy();
```

`createFlowHero(target, patch?, options?)` returns an object with these members:

| Member | What it does |
| --- | --- |
| `setPatch(patch)` | Layers a full or partial patch over the current one. Pass a preset to switch looks completely. |
| `pause()`, `resume()` | Stop and restart the frame loop. |
| `step(dt?)` | Advances and renders one frame of `dt` seconds (default 1/60, at most 1/20). For tests and scripted recordings. |
| `pointer(x, y)` | Feeds a pointer position in CSS pixels relative to the canvas's top-left corner. |
| `lift()` | Ends the current stroke, so the next `pointer()` call starts a new one. |
| `destroy()` | Removes the canvas, listeners and GPU resources. |
| `patch` | The current patch, complete. |
| `status` | `mode` (`webgl`, `still` or `fallback`), `reason` for a fallback, `running`, the GPU `renderer` string, the ink buffer `format`, and the canvas `width` and `height`. |
| `canvas` | The canvas element. |

`options` takes `ignoreReducedMotion: true` to animate regardless of the user's setting (use with care) and `forceRGBA8: true` to test the 8-bit buffer path. Importing any entry on the server is safe: the code reads `window` and `document` only inside `createFlowHero`, and the element entry registers itself only when `customElements` exists.

`encodePatch(patch)` and `decodePatch(text)` turn a patch into a URL-safe string and back, through the same parser. The playground uses them for its share links.

## Settings

A patch is a plain object. `parsePatch(input, base?)` turns untrusted input into a complete patch: it drops unknown keys, clamps numbers to the ranges below, and fills anything missing or malformed from `base` (the ember preset by default). The engine, the web component, the React component and the playground all call it, so a patch from a URL, an attribute or a fetched file cannot inject CSS or allocate without bound.

<!-- settings:start (generated by pnpm settings-table; edit src/patch.ts instead) -->
| Setting | Range | Default (ember) | What it does |
| --- | --- | --- | --- |
| `name` | text, up to 64 characters | `ember` | A label for the look. Not used for rendering. |
| `background.colors` | 2 to 4 hex colours | `#151515` `#000000` `#000000` | Two to four gradient stops, blended in OKLab. |
| `background.angle` | 0 to 360, whole numbers | `135` | Gradient direction in CSS degrees (0 points up, 90 points right). |
| `background.motion` | 0 to 1 | `0.05` | How far the stops drift back and forth over time. |
| `ink.color` | hex colour | `#f50032` | The accent colour of the trail. |
| `ink.hueShift` | 0 to 1 | `0.22` | How far the ink hue swings away from the accent. Stroke direction varies the swing. 0 is pure accent. |
| `ink.intensity` | 0 to 2 | `0.8` | Brightness (or darkness, for multiply) of the ink. |
| `ink.size` | 0.02 to 0.5 | `0.24` | Largest brush radius, as a fraction of the short side. Fast strokes reach it. |
| `ink.lifetime` | 0.2 to 8 | `1.2` | Seconds until a trail is about gone. Time-based, so 60 Hz and 120 Hz match. |
| `ink.drift` | 0 to 1 | `0.45` | How far ink keeps travelling along its stroke direction. |
| `ink.spread` | 0 to 1 | `0.65` | How quickly ink blurs outward. |
| `ink.blend` | `add`, `screen`, `multiply` | `add` | add glows on dark, screen glows softly, multiply darkens light backgrounds. |
| `warp.amount` | 0 to 1 | `0.31` | Strength of the turbulence the image is resampled through. This is what makes smoke billow. |
| `warp.scale` | 0.2 to 6 | `1.2` | Size of the turbulence. Higher is finer. |
| `warp.speed` | 0 to 1 | `0.08` | How fast the turbulence field drifts and evolves. |
| `warp.detail` | 3 to 6, whole numbers | `6` | Noise octaves. Fewer is cheaper and smoother. |
| `grain` | 0 to 1 | `0.06` | Film grain. A little stops banding on dark gradients. |
| `idle.mode` | `off`, `attract`, `always` | `attract` | off never draws on its own. attract draws until the visitor first moves the pointer, and comes back after a pause only on touch devices. always draws after every pause. |
| `idle.speed` | 0.05 to 2 | `0.5` | How fast the wanderer moves. |
| `idle.size` | 0.1 to 2 | `0.7` | Wanderer brush size relative to Brush size. |
| `quality.resolution` | 0.25 to 1 | `0.75` | Render scale for the warp pass. The ink simulation runs at half of this. |
| `quality.maxDpr` | 0.5 to 3 | `1.5` | Caps device pixel ratio so large retina screens stay cheap. |
<!-- settings:end -->

## Presets

| Preset | Look |
| --- | --- |
| `ember` | Near-black with a faint lighter corner. Crimson and orange smoke, added on top. The default, and the closest to the onlook.com hero that inspired this project. |
| `aurora` | Deep navy. Teal-to-green ink whose hue swings with stroke direction, a long trail and a broad, slow warp. |
| `ink-on-paper` | Warm off-white paper with grain. Near-black ink with a small brush and tight warp, multiplied so it darkens. A light-mode example. |
| `candy` | A four-stop pastel gradient that moves on its own, soft white ink blended with `screen`, and the idle wanderer drawing after every pause. |

| ember | aurora | ink-on-paper | candy |
| --- | --- | --- | --- |
| ![ember](https://raw.githubusercontent.com/SZoloth/flow-hero/main/docs/ember.jpg) | ![aurora](https://raw.githubusercontent.com/SZoloth/flow-hero/main/docs/aurora.jpg) | ![ink-on-paper](https://raw.githubusercontent.com/SZoloth/flow-hero/main/docs/ink-on-paper.jpg) | ![candy](https://raw.githubusercontent.com/SZoloth/flow-hero/main/docs/candy.jpg) |

## Make your own patch

1. Open the [playground](https://szoloth.github.io/flow-hero/), or clone this repo and run `pnpm install && pnpm dev`.
2. Pick a preset, or press the shuffle button beside it for a random look. Shape it with the three Feel sliders: Energy (how far ink travels and how fast the smoke churns), Texture (soft glow to torn, grainy smoke) and Brush (thin wisps to broad clouds). Each one moves several settings together and keeps the rest of the look. The folders below hold every individual setting.
3. The page URL updates as you go, so the address bar is a share link. Save version keeps looks to compare side by side.
4. Press Copy at the top of the panel and choose Patch JSON, HTML or React to take the patch in the form you need.

A patch can be partial. `{"ink": {"color": "#00e0ff"}}` layered over a preset changes only the ink colour. Light backgrounds need `"blend": "multiply"` so the ink darkens instead of glowing.

## Mobile and accessibility

- The canvas is `aria-hidden` and ignores pointer events. Your headline, links and buttons stay real HTML on top of it.
- With `prefers-reduced-motion: reduce`, the hero renders one still frame with a little ink and then stops. It switches live if the setting changes.
- Ink only appears while the pointer is over the hero. Touch drags draw too, but a visitor who only scrolls sees the background alone. So by default (`idle.mode: "attract"`) a wanderer draws ink on first paint. A mouse visitor takes over the moment they move and the wanderer stays gone. On touch devices it comes back after 2.5 seconds without input, so phones never show an empty hero. Use `"off"` for the pure pointer-only look, or `"always"` to have it return after every pause, as `candy` does.
- Check your text contrast against the background colours. The ink fades within seconds, so it can't be relied on for contrast.

## Performance

- The engine runs two GPU passes per frame. One updates the ink buffer at half the canvas resolution. The other warps and composites the result to the screen.
- `quality.resolution` scales the canvas backing store and `quality.maxDpr` caps the device pixel ratio. These two settings matter most on large high-DPI screens, where the canvas has the most pixels to fill.
- Measured on an Apple M4 in Chrome (ANGLE Metal) at 1440×900 with `ember`, averaging 300 frames with a GPU sync after each, five runs per setting on a busy machine: a median of 6.8 ms per frame at a device pixel ratio of 1 (range 6.2 to 7.4 ms) and 12.1 ms at 2 (range 11.6 to 12.7 ms). Most of that is the warp noise. In single runs at a ratio of 2, dropping `warp.detail` from 6 to 3 brought the frame to 6.7 ms, and `quality.resolution: 0.5` brought it to 5.8 ms. Lower both on pages that must run well on older laptops and phones. To measure your own machine, open the playground and run `await script.time(300)` in the console.
- Decay, drift and blur are scaled by real elapsed time, clamped to 1/20 s after a stall. In a scripted test, the same strokes rendered at 60 and 120 frames per second differed by at most 3% in mean brightness and 6% in inked area.
- The loop stops when the hero is off screen or the tab is hidden, and `pause()` stops it on demand.
- The ink buffer uses half-float textures when the GPU supports rendering to them, and 8-bit textures otherwise. The 8-bit path rounds with a little random dither, so its trails fade at the same rate as the float path and still reach zero.

## Development

```sh
pnpm install
pnpm dev             # playground with live rebuild, on localhost only
pnpm test            # patch parsing, presets, Random, snippets, safety, server import, README table
pnpm build           # dist/ ESM entries, IIFE and type declarations
pnpm size            # minified and gzipped sizes; fails if the core exceeds 15 KB gzipped
pnpm settings-table  # regenerate the settings table in this README
pnpm schema          # regenerate schema.json from the settings registry
pnpm site            # build the playground site into site/
```

## Credit

Inspired by the hero on [onlook.com](https://www.onlook.com/), which is built with [Unicorn Studio](https://www.unicorn.studio/). flow-hero is an independent implementation written from a description of how that effect behaves ([docs/TEARDOWN.md](https://raw.githubusercontent.com/SZoloth/flow-hero/main/docs/TEARDOWN.md)). It contains no code from Onlook or Unicorn Studio. The turbulence uses domain warping as described in Inigo Quilez's article [warp](https://iquilezles.org/articles/warp/), and colours are mixed in Björn Ottosson's OKLab space. The packaging was inspired by [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks). The playground's control panel is Josh Puckett's [DialKit](https://github.com/joshpuckett/dialkit) (MIT); the published package does not include it.

## Roadmap

Cloud and water materials and dynamic colour are next. See [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE)
