# flow-hero launch film: storyboard

Status: storyboard only, nothing rendered. Frames in this folder are real captures of the live playground (https://szoloth.github.io/flow-hero/), taken 2026-11-19 on the M4 GPU. `contact.png` shows them side by side.

## Brief

- **Who sees it:** developers and designers scrolling X and LinkedIn. They know what a hero section is and have seen fancy WebGL backgrounds. Most assume those take a paid tool or a shader expert.
- **The one change it shows:** you can have this effect on your own site, and the whole look is one small JSON patch.
- **Story shape (house grammar):** a hook line, the thing doing it, a payoff line. One idea, no feature tour. Every word is sourced from the README.
- **Length and sizes:** 15 s. 16:9 at 1280×720 for X, plus 4:5 for LinkedIn, where the words sit above the browser.
- **Sound:** no music. A soft tick on each cut and a pop when the wordmark lands, as in launch-reels.

## Beats

| # | Time | Picture | Words on screen | Source of the words | Frame |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.0–2.0 s | A black hero with the headline. A cursor glides in from the bottom left and ember smoke blooms behind it. A slow camera drift toward the smoke. | "Move the pointer." | Playground subhead | `01-ember-rest.png` to `02-ember-stroke.png` |
| 2 | 2.0–3.6 s | The cursor stops and the smoke curls, drifts on and is gone. | "Leave smoke." | Playground subhead | `03-ember-fade.png` |
| 3 | 3.6–8.0 s | The same stroke repeats while the look cuts mid-stroke (cut on action) from aurora to ink-on-paper to candy, about 1.4 s each. The camera holds still so only the look changes. | "One small JSON patch sets the whole look." | README intro | `04-aurora.png`, `05-ink-on-paper.png`, `06-candy.png` |
| 4 | 8.0–11.0 s | Back to ember with the playground panel in view. A hand-paced cursor drags Lifetime, then Warp amount, and the smoke changes as it moves. The camera punches in on the slider over 6 frames. | "Drag a slider. Copy the patch." | README "Make your own patch" | `07-panel.png` |
| 5 | 11.0–13.0 s | The browser slides aside. One line types in on a dark code card: `<flow-hero preset="ember">`. | "About 10 KB. Zero dependencies. MIT." | README feature list | none yet (code card, built in Remotion) |
| 6 | 13.0–15.0 s | The browser folds into the flow-hero wordmark over an ember wisp. Underneath: `pnpm add flow-hero`, `szoloth.github.io/flow-hero`, "Designed and built by Sam Zoloth". Nothing after it. | (end card) | package name, playground URL, house byline | none yet |

## How it would be made

1. **Footage.** Render frames instead of screen-recording them, so playback is smooth at 60 fps. The playground's `script` helper advances the engine one exact frame at a time, and each frame is screenshotted on the real GPU. Recording live through `agent-browser` drops frames.
2. **Cursor.** Draw it in Remotion along the same path the script feeds the engine, so the cursor and the smoke line up exactly.
3. **Build.** A Remotion composition. launch-reels' `Sizzle` assumes a phone stays on stage the whole time, so this needs a browser-frame stage, either added to launch-reels or built as a one-off composition.
4. **Checks.** Run the launch-reels lint on the words. Then run `qa.mjs` on the render for flashes and freezes. Then review the frames against these beats.
5. **Site film.** A 5-second loop of beats 1 and 2 at 960×540 becomes the door film on szoloth.com/experiments. It replaces the still poster used there now.

## Decisions for Sam

1. **Credit Onlook in the film or only in the post.** I'd put it only in the post text ("inspired by onlook.com's hero"). The film stays about what the viewer can do.
2. **Where the composition lives.** Either a browser-frame stage added to launch-reels, so later web projects reuse it, or a one-off composition in this repo. I'd add the stage to launch-reels.
3. **Real voice or silent.** House rule is silent with ticks. Keep it silent.
