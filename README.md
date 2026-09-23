# Tuck

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

Unit tests for the plain-TypeScript modules (model, store slices, editor
geometry) run on Node's built-in test runner, with no extra framework:

```sh
npm test
```

TypeScript is checked separately with:

```sh
npm run typecheck
```

A production web build catches imports only Metro resolves, which the checks
above never see, such as the web entry's untyped `import()`:

```sh
npm run build:web
```

Use `npm run format` to apply Biome formatting fixes. CI runs all four on every
push to `main` and on pull requests.

## Architecture

The editor keeps the original photo and represents edits as an
`EditorDocument`. Layer transforms use document-space coordinates, independent
of the preview size. The canvas fits that document into the available screen
space, while gesture state is held outside React during an interaction and
committed to the document when the gesture ends.

Key areas:

- `src/app/` holds the routes only (expo-router treats every file here as a route).
- `src/model/` defines the document, layers, and geometry as plain data: no React. The document is the canvas (its size, and a background fill or transparency); the photo is its bottom layer, locked by default, with a transform of its own. `framing.ts` moves the photo to a new place on a new canvas and keeps every other layer over the same spot, which is all cropping, turning, and flipping are.
- `src/layers/` draws each layer type in document space; shared by editor and export.
- `src/editor/` is the interactive canvas: `EditorScene`, gestures, hit-testing, the selection's scale/rotate handles (`selectionHandles.ts`), the text panel, the full-screen `TextEditor`, the layers panel (where the photo is unlocked and the background picked), and keyboard shortcuts on web. `CropTool` crops, turns, flips, and straightens the photo and expands the canvas around it; its geometry is in `cropGeometry.ts`.
- `src/store/` is the Zustand store shared across screens: `index.ts` combines the slices into `useStore`, and `editorSlice.ts` owns the document, selection, undo history, and every edit that mutates them.
- `src/import/` picks a photo and re-encodes it as JPEG.
- `src/projects/` keeps every editing session as a local project: the photo moves into it, edits autosave, and the welcome screen lists projects to reopen or delete, each with a thumbnail rendered by export's renderer when its editor closes. `projectFile.ts` is the saved format (versioned, with the photo's path relative to the project); `projectLifecycle.ts` opens, saves, and closes projects, with storage passed in so Node can test it.
- `src/export/` renders the document offscreen with `ExportScene`, at full size or a smaller preset, then saves it to Photos or shares it: as JPEG, or as PNG when some of the canvas is transparent.
- `src/layers/fonts.ts` bundles the text fonts so text renders identically on iOS, Android, and web.
- `src/ui/` and `src/theme.ts` hold controls and colors shared across screens.
- `src/lib/` holds platform shims and small language helpers.
- `index.ts` / `index.web.ts` are the app entry. On web, it loads Skia's WASM build before any app code runs.

Imports flow one way: `app` → `editor` / `import` / `export` / `projects` →
`layers` / `store` → `model`. `ui`, `theme`, and `lib` import nothing from the app.
Lint rules in `biome.json` enforce these boundaries. Adding a layer
type means a type in `model/document.ts`, a view in `layers/`, and a case in
both `EditorScene` and `ExportScene` (`assertNever` flags any you miss).

Platform differences live in `.web.ts` files next to their native versions
(`saveImage.web.ts` downloads instead of saving to Photos; `projectStorage.web.ts`
keeps projects in IndexedDB instead of files; `showAlert.web.ts` uses the
browser's dialogs because React Native Web's `Alert` does nothing).

Picked images are normalized to JPEG before reaching Skia because iPhone
photos are commonly HEIC, which Skia cannot decode. See `AGENTS.md` for this
and other implementation-specific lessons.
