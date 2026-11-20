# Working on flow-hero

- Package manager: pnpm only.
- The settings registry `SETTINGS` in `src/patch.ts` is the single source for the parser, the playground panel, the README settings table (`pnpm settings-table`) and `schema.json` (`pnpm schema`). Tests fail if the README table or schema drift.
- Untrusted input reaches the engine only through `parsePatch`.
- The core must stay dependency-free and under 15 KB gzipped (`pnpm size`). DialKit is a dev dependency used only by the playground.
- Before calling a change done: `pnpm typecheck && pnpm test && pnpm build && pnpm size`, then look at the playground (`pnpm dev`) in a browser with a real GPU. Headless Chrome's software renderer makes the engine fall back to a CSS gradient on purpose.
- Adding flow-hero to someone else's site is a different job: follow `skills/flow-hero/SKILL.md`.
