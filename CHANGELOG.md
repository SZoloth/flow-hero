# Changelog

## 0.3.0 (2026-11-20)

- React: `as` prop to render a `section`, `header` or other tag instead of a `div`, an `id` prop, and the engine exposed as `.hero` on the rendered element.
- Agent skill: guidance from two cold agent tests (plain HTML and Next.js): pin the CDN version, how to turn an existing hero into the container, brand-accent hue, accessibility, scripted testing, per-preset fade time, contrast under dense ink.
- CDN links everywhere follow the package version, with a test.

## 0.2.0 (2026-11-20, GitHub release only; first on npm in 0.3.0)

- `schema.json`: a JSON Schema for patches, generated from the settings registry and exported as `flow-hero/schema.json`.
- `skills/flow-hero/SKILL.md`: an agent skill for adding flow-hero to a site, shipped in the package and at https://szoloth.github.io/flow-hero/skill.md.
- Examples for Next.js App Router and plain HTML. CI builds the Next.js example against the packed package.
- Playground: DialKit control panel with Energy, Texture and Brush sliders, a shuffle button, one Copy menu, and links to the repo and npm.
- No changes to the engine or the patch format.

## 0.1.0 (2026-11-19)

- First release: WebGL2 engine, patch parser, four presets (ember, aurora, ink-on-paper, candy), `<flow-hero>` element, React component, script-tag build, idle wanderer with `attract` mode, CSS fallback, reduced-motion still frame.
