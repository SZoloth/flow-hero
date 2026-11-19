# Teardown: the onlook.com hero

Studied 2026-11-19 from the live site (https://www.onlook.com/), its shipped JavaScript bundles and its public scene file. This document describes behaviour in words and numbers only. It contains no code from Onlook or Unicorn Studio, and flow-hero's engine was written from this description, not from their shaders.

Confidence labels: **Bundle** means the shipped files or the running page show it. **Inferred** means the evidence points there but nobody on the team has said so.

## What you see

At rest the hero is almost black. A faint lighter corner sits top-left and fades to pure black by the middle of the screen. There is no colour at all until you move the pointer.

Move the pointer and it leaves a glowing smoke trail in crimson and orange. The smoke billows: its edges curl like turbulent clouds. It drifts in the direction you moved, spreads out, and is gone about one second after the pointer stops. The page's headline, subhead and button fade up over it in a stagger.

Reference frames (not in this repo, because they are screenshots of someone else's site): idle, mid-trail, and 1.5 s after the trail.

## How it is built

The hero is a [Unicorn Studio](https://www.unicorn.studio/) scene. Unicorn Studio is a paid, no-code WebGL editor. Its designers stack effect layers in a canvas editor and export a scene. **Bundle.**

- **Player.** The page loads Unicorn's player script, `unicornStudio.umd.js` version 1.5.2, from jsDelivr, with Next.js's `lazyOnload` strategy. **Bundle.**
- **Wrapper.** A React component handles loading. Its props are `projectId` or `jsonFilePath`, plus `scale` 1, `dpi` 1.5, `fps` 60 and `lazyLoad`. It gives the player 15 seconds to start, shows an error box if it fails, and skips re-initialising when its settings haven't changed. It matches the open-source `unicornstudio-react` package. **Bundle** for the behaviour, **Inferred** for the package.
- **Scene file.** Onlook self-hosts the exported scene at `/scenes/flow-background.json`, about 15 KB, named "Flow gradient". It does not use a project ID on Unicorn's servers. **Bundle.**
- **Container.** The canvas sits in an absolutely positioned, full-viewport layer with `pointer-events: none`, behind the hero text. So the effect has to listen for the pointer on the whole window, not on the canvas. **Bundle.**

## The three layers, in render order

### 1. Base gradient (rendered at half resolution)

- A linear gradient with three stops: `#151515` at 0, black at 0.5, black at 1. **Bundle.**
- It is rotated so the lighter end is the top-left corner (about −152° in Unicorn's angle convention). **Bundle**, and the idle screenshot agrees.
- Colours blend in OKLab rather than sRGB, which avoids muddy midpoints. **Bundle.**
- The stop positions creep along over time and bounce back at the ends (a ping-pong). It is too slow to notice. **Bundle.**
- A dither of under 0.5% brightness is added per pixel to stop banding on near-black. **Bundle.**

### 2. Pointer ink, a feedback buffer (half resolution)

This is the heart of the effect. It is **not** a fluid simulation: no pressure, no velocity field solve. **Bundle.**

- **What it stores.** Two textures take turns (ping-pong). Each pixel holds the ink's strength and the direction it was moving. Unicorn packs direction into hue and strength into brightness. **Bundle.**
- **Each frame, the old ink:**
  1. **Self-advects.** Each pixel samples from upstream along its own stored direction, by up to about 3% of the screen at full strength. So ink keeps travelling the way the pointer went.
  2. **Swirls.** A faint sinusoidal warp of five rotated sine octaves with an amplitude of about 0.25% of the screen. It is stronger where ink is weak, so fading edges curl.
  3. **Blurs** with a five-tap cross about 0.5% of the screen wide, so ink spreads.
  4. **Decays** by a fixed factor of about 0.87 per frame in linear light. Because the decay is per frame, the trail fades twice as fast on a 120 Hz display. A clean reimplementation should decay per second instead. Visible lifetime is about one second at 60 Hz. **Bundle**, with the lifetime checked against the screenshots.
- **New ink.** Each frame the segment from the previous pointer position to the current one is split into 12 to 24 points. Each point stamps a soft, steep-falloff brush. **Bundle.**
  - The brush radius grows with pointer speed, between about 10% and 70% of a base size.
  - The new ink's colour encodes the stroke's direction as hue.
  - New ink replaces old ink in proportion to stroke strength, so fast strokes write over the trail rather than just adding to it.
- **Showing it.** The ink's displayed colour is its strength times a 50/50 mix of the direction-hue colour and a fixed accent, crimson `#F50032`. It is added on top of the gradient, weighted by strength. The direction hue is why the smoke runs from orange into red rather than one flat red. **Bundle**, and the mid-trail screenshot shows it.

### 3. Domain-warped noise distortion (three-quarter resolution)

- The combined image of gradient plus ink is resampled through an offset field. That field is nested fractal noise: noise sampled at coordinates bent by more noise, the technique Inigo Quilez describes in his article ["warp"](https://iquilezles.org/articles/warp/). **Bundle**, and the structure matches the article.
  - Six octaves of gradient (Perlin-style) noise.
  - Frequency ×2.5 per octave, a rotation of 0.5 rad per octave, and amplitude ×~0.59 per octave.
- **Field settings.** The field is centred near (57%, 65%) of the screen, rotated about −49°, and scaled for aspect ratio. It drifts diagonally and evolves slowly over time. **Bundle.**
- **Strength.** About 0.31. That is large: it is what turns a smooth brush stroke into billowing smoke. The warp does not follow the pointer. It is a fixed, slowly drifting turbulence field that the ink moves through. **Bundle.**
- **Cost.** Each pixel runs three six-octave noise evaluations. This is the most expensive layer, which is why it renders below full resolution. **Inferred.**

## The text intro (CSS, not WebGL)

Each intro element runs a keyframe animation. **Bundle.**

- Opacity goes from 0 to 1, blur from 8px to 0, and vertical offset from 24px to 0.
- It lasts 1 s with easing `cubic-bezier(0.16, 1, 0.3, 1)`, a strong ease-out.
- The delay is the element's `--intro-index` times 0.12 s.
- Under `prefers-reduced-motion: reduce` the animation is removed.

## Decision log

| Chose | Over | Why | Cost accepted | Confidence |
| --- | --- | --- | --- | --- |
| A no-code tool (Unicorn Studio) | Hand-written shaders | A designer can tune it visually and re-export without an engineer | A proprietary player script, a 15-second load timeout path, and no way to change behaviour beyond what the editor exposes | Inferred |
| A self-hosted scene file | A project ID on Unicorn's servers | Fewer third-party requests, and the scene is versioned with the site | The player still loads from a CDN | Bundle |
| Colour only on interaction, near-black at rest | An always-moving gradient blob | Restraint: the hero copy stays the focus, and the effect rewards the visitor who moves | Phones and anyone who doesn't move the pointer see an almost empty dark hero | Inferred |
| A feedback buffer with direction stored per pixel | A real fluid solver | Most of the look of fluid for one cheap pass per frame | It's not physical: ink doesn't swirl around obstacles or conserve mass | Bundle |
| Fixed turbulence the ink drifts through | Turbulence that follows the pointer | It gives the smoke texture without making the cursor feel sticky | Same texture in the same place every visit | Bundle |
| Half- and three-quarter-resolution layers | Full resolution | GPU cost on large screens | Slightly soft ink edges, which the smoke look hides | Bundle |
| A per-frame decay constant | Time-based decay | Simplest to write | Trail length depends on refresh rate | Bundle |
| A CSS text intro | Animating text in WebGL | Text stays real HTML: selectable, accessible and indexable | None worth naming | Bundle |

## What the teardown says to build

The open, customisable version needs the same three ideas: a dark base, ink with stored direction that advects and fades, and a slow domain-warp field. It should fix three gaps:

1. **Decay per second, not per frame.**
2. **Show something with no pointer.** Add an optional idle wanderer that draws ink on its own, so phones and first paint aren't empty.
3. **Expose the settings that change the character, not just the colour.** That means the base colours, ink colours and how much the direction hue shows, brush size, trail lifetime, drift, warp strength and scale, and blend mode. Light backgrounds need a darkening blend, not an additive one.

## Not done yet

- No public statement from Onlook or Unicorn Studio about this scene was looked for. The "why" column is inferred.
- The frame-time cost of the original on real hardware was not measured.
