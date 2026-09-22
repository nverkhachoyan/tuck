# Photo Editor

A local-first Expo photo editor for quick edits such as adding text, making
memes, and eventually blurring or redacting parts of an image. The product
direction and staged feature plan live in [VISION.md](./VISION.md).

## Getting started

Install dependencies and start the Expo development server:

```sh
npm install
npm start
```

Platform-specific shortcuts are also available:

```sh
npm run ios
npm run android
npm run web
```

## Checks

Run the repository's formatting and lint checks before committing:

```sh
npm run check
```

Unit tests for the plain-TypeScript modules (model, reducer, viewport) run on
Node's built-in test runner, with no extra framework:

```sh
npm test
```

TypeScript can be checked separately with:

```sh
npx tsc --noEmit
```

Use `npm run format` to apply Biome formatting fixes.

## Architecture

The editor keeps the original photo and represents edits as an
`EditorDocument`. Layer transforms use document-space coordinates, independent
of the preview size. The canvas fits that document into the available screen
space, while gesture state is held outside React during an interaction and
committed to the document when the gesture ends.

Key areas:

- `src/app/` holds the routes only (expo-router treats every file here as a route).
- `src/model/` defines the document, layers, and geometry as plain data: no React.
- `src/layers/` draws each layer type in document space; shared by editor and export.
- `src/editor/` is the interactive canvas: `EditorScene`, gestures, hit-testing, the text panel, and the full-screen `TextEditor`.
- `src/editor/state/` owns the document, selection, and every command that mutates them.
- `src/import/` picks a photo and turns it into a document.
- `src/export/` renders the document offscreen with `ExportScene`, then saves it to Photos or shares it.
- `src/layers/fonts.ts` bundles the one text font (Anton) so text renders identically on iOS, Android, and web.
- `src/ui/` and `src/theme.ts` hold controls and colors shared across screens.
- `src/lib/` holds platform shims and small language helpers.
- `index.ts` / `index.web.ts` are the app entry. On web, it loads Skia's WASM build before any app code runs.

Imports flow one way: `app` → `editor` / `import` / `export` → `layers` →
`model`. `ui`, `theme`, and `lib` import nothing from the app. Adding a layer
type means a type in `model/document.ts`, a view in `layers/`, and a case in
both `EditorScene` and `ExportScene` (`assertNever` flags any you miss).

Platform differences live in `.web.ts` files next to their native versions
(`saveImage.web.ts` downloads instead of saving to Photos; `showAlert.web.ts`
uses the browser's dialogs because React Native Web's `Alert` does nothing).

Picked images are normalized to JPEG before reaching Skia because iPhone
photos are commonly HEIC, which Skia cannot decode. See `AGENTS.md` for this
and other implementation-specific lessons.
