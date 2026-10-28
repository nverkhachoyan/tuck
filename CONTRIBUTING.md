# Contributing

## Getting running

Tuck has local native modules (`modules/`), so it runs in a development build,
not Expo Go. After `npm install`, `npm run ios` or `npm run android` builds
and launches it, and `npm run web` runs the web version.
[docs/development.md](./docs/development.md) covers simulators, devices, and
the quirks of each.

## Before you push

CI runs all four on every pull request. Run the first two after any change,
and the others when they apply:

```sh
npm run check       # formatting and lint, including the import rules (npm run format fixes formatting)
npm run typecheck
npm test            # after touching model/, store slices, or other pure modules
npm run build:web   # after changing .web files, the entry files, or untyped imports
```

Changing `render/`'s imports, or something an "Inside Tuck" lesson quotes,
can break `npm run build --prefix docs/interactive`; update the lesson in the
same change.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat: add text editing`, `fix: handle invalid image input`,
`refactor: make Crop a tool`.

## What you'll meet first

The full list of conventions and hard-won lessons is
[AGENTS.md](./AGENTS.md); [docs/architecture.md](./docs/architecture.md)
explains the layout. The ones that come up first:

- Imports flow one way, from `app/` down to `model/` (see the README's map),
  and `biome.json` fails `npm run check` on an import that goes the wrong way.
  Outside `src/editor/`, import the editor only from `@/editor`.
- `model/` is plain TypeScript: no React, React Native, or Skia.
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
