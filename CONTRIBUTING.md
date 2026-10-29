# Contributing

## Getting running

Tuck has local native modules (`modules/`), so it runs in a development build,
not Expo Go. After `pnpm install`, `pnpm ios` or `pnpm android` builds
and launches it, and `pnpm web` runs the web version.
[docs/development.md](./docs/development.md) covers simulators, devices, and
the quirks of each.

## Before you push

CI runs all four on every pull request. Run the first two after any change,
and the others when they apply:

```sh
pnpm check       # formatting and lint, including the import rules (pnpm format fixes formatting)
pnpm typecheck
pnpm test        # after touching document or layer files, store slices, or other pure modules
pnpm build:web   # after changing .web files, the entry files, or untyped imports
```

Changing the imports of `src/editor/render/` or the layer views, or something
an "Inside Tuck" lesson quotes, can break `pnpm --dir docs/interactive build`;
update the lesson in the same change.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat: add text editing`, `fix: handle invalid image input`,
`refactor: make Crop a tool`.

## What you'll meet first

The full list of conventions and hard-won lessons is
[AGENTS.md](./AGENTS.md); [docs/architecture.md](./docs/architecture.md)
explains the layout. The ones that come up first:

- Imports flow one way, from `app/` down to the editor (see the README's map),
  and nothing checks it. Outside `src/editor/`, import the editor only from
  `@/editor`, or `@/editor/core` for plain TypeScript.
- The editor's `document/` and its layers' lowercase `.ts` files are plain
  TypeScript: no React, React Native, or Skia.
- Colors, text styles, corners, and gaps come from `ui/theme.ts`, never
  literals: the palette is picked at launch.
- A tool lives in its own folder under `src/editor/tools/`, as a spec (plain
  TypeScript, which the tests read) and a definition. Its hook gets what it
  needs through `ToolEnv`, the store, or a shared preference; only its views
  read the editor's context.
- Tests live in `__tests__/` beside what they test and import with an explicit
  `.ts` extension, since Node runs them by stripping types.
- Platform differences go in a `.web.ts` (or `.web.tsx`) file beside the
  native one, with the same extension.
