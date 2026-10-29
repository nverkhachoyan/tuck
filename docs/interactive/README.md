# Inside Tuck

Interactive lessons on the codebase, read from the bottom up: the model, then
the store, then rendering. Each lesson runs the app's real code and quotes it
from the source as it is now.

```bash
pnpm install
pnpm --dir docs/interactive dev
```

It opens at http://localhost:5180 (the `docs` launch configuration in
`.claude/launch.json` starts the same server).

## Adding a lesson

1. Write a component in `src/lessons/<chapter>/` and give it to its entry in
   `src/lessons.ts` (an entry without a component shows as "soon").
2. Import what it explains from `@model/…` rather than copying it, and quote
   code with `<SourceView file="src/model/geometry.ts" name="toLayerSpace" />`,
   which reads the declaration by name from the file. A file a lesson quotes
   needs an entry in `src/source/sources.ts`.
3. Steps the reader works through go in a `<Flow>`: each step says what to try
   and checks the lesson's live state for when it's done.

`pnpm build` type-checks the lessons against `src/` and bundles them. CI runs
it, so a change to something a lesson covers fails until the lesson is updated.

## The rendering lessons

The rendering chapter draws with the app's real `src/render/` code, on
React Native Skia's web build (CanvasKit) and React Native Web, taken from the
repo root's `node_modules` at the versions the app runs (the root's
`pnpm install` installs both). `vite.config.ts` makes that work outside Metro: it maps
`react-native` to `react-native-web`, prefers Metro's `.web` files, and stands
in for what only Metro or a phone has (`src/platform/`: Reanimated, React
Native's asset registry, `expo-asset`, `expo-font`, and the font packages'
`require` of a `.ttf`). A lesson that imports Skia must load through
`withSkia` (`src/lessons/render/loadSkia.ts`), so CanvasKit is ready first.
