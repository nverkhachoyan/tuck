# Tuck

A local-first Expo photo editor for quick edits such as adding text, making
memes, and eventually blurring or redacting parts of an image. The product
direction and staged feature plan live in [VISION.md](./VISION.md).

## Getting started

The app has its own native code (`modules/image-analysis/`), so it runs in a
development build rather than Expo Go. Install dependencies, then build and
launch it on the iOS simulator or an Android emulator (this generates the
ignored `ios/` and `android/` folders and starts Metro):

```sh
npm install
npm run ios
npm run android
```

Once a build is installed, `npm start` serves JavaScript changes to it, and
`npm run web` runs the web version.

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

- `src/app/` holds thin Expo Router route files. A project's editor is at `/projects/[id]` and its export at `/projects/[id]/export`, so a link or a reload opens the project from storage (`useProjectSession`); `vercel.json` serves those routes from the static export. `src/screens/` owns the home, create, editor, export, settings, and info screens (support, privacy, licenses, and the 404 page). The home screen starts from a photo or, through Create, an empty canvas at a preset size. The editor's Photo tool adds more photos as layers, wiring the picker in `src/photos/` to projects' storage.
- `src/model/` defines the document, layers, and geometry as plain data: no React. The document is the canvas (its size, and a background fill or transparency) and its layers, which may be none. A photo is an image layer like any other: a document's own photo starts locked, and can be unlocked, reordered, hidden, or deleted; photos added later start unlocked. `framing.ts` moves the framing's anchor (the lowest visible locked image, or with none, the canvas itself) to a new place on a new canvas and keeps every other layer over the same spot, which is all cropping, turning, and flipping are.
- `src/screens/editor/` is the interactive editor, in a folder per part. `canvas/` draws the document (`EditorScene`) and handles gestures, hit-testing, and snapping. `crop/` holds `CropTool`, which crops, turns, flips, and straightens the photo (the lowest locked one, or just the canvas without one) and expands the canvas around it; its geometry is in `cropGeometry.ts` and its box dragging in `cropDrag.ts`. `text/` holds the text panel and the full-screen `TextEditor`, and `draw/` the drawing panel and brush settings. `panels/` holds the toolbar and the layers panel, where any layer is hidden, locked, deleted, or reordered. `handles/` holds the selection handles' geometry, which the canvas and crop share, and `controls/` the dock and the controls every tool's panel is built from. `detection/` finds faces, text, and subjects with the native `image-analysis` module, and `stickers/` holds the bundled stickers and the ones people save. The editor root holds `EditorScreen`, which composes the parts, and what spans the whole editor: its mode, its actions, and keyboard shortcuts on web. The background picker is in `src/ui/` because Create also uses it.
- `src/store/` is the Zustand store shared across screens: `index.ts` combines the slices into `useStore`, and `editorSlice.ts` owns the document, selection, undo history, and every edit that mutates them.
- `src/photos/` picks a photo and re-encodes it as JPEG.
- `src/projects/` keeps every editing session as a local project: its photos move into it, each as a file of its own, edits autosave, and the welcome screen lists projects to reopen or delete, each with a thumbnail rendered when its editor closes. `projectFile.ts` is the saved format (versioned, with image layers naming their file in the project); `projectLifecycle.ts` opens, saves, and closes projects, removing files no layer uses once one closes, with storage passed in so Node can test it.
- `src/render/` is how a document draws: a view for each layer type, in document space, which the editor's canvas uses too, the decoded-image cache, and `DocumentRenderScene`, which renders offscreen for export and project thumbnails. `src/screens/export/` chooses output sizes and format, then saves the image to Photos or shares it: as JPEG, or as PNG when some of the canvas is transparent.
- `src/render/fonts.ts` bundles the text fonts so text renders identically on iOS, Android, and web.
- `src/ui/` and `src/theme.ts` hold controls and colors shared across screens.
- `src/lib/` holds platform shims, small language helpers, and the site's address (`site.ts`).
- `index.ts` / `index.web.ts` are the app entry. On web, it loads Skia's WASM build before any app code runs.

Imports flow one way: `app` → `screens` → `photos` / `render` / `projects` →
`store` → `model`. `ui`, `theme`, and `lib` import nothing from the screens.
Lint rules in `biome.json` enforce these boundaries. Adding a layer
type means a type in `model/document.ts`, a view in `render/`, and a case in
both `EditorScene` and `DocumentRenderScene` (`assertNever` flags any you miss).

Platform differences live in `.web.ts` files next to their native versions
(`saveImage.web.ts` downloads instead of saving to Photos; `projectStorage.web.ts`
keeps projects in IndexedDB instead of files; `showAlert.web.tsx` draws its
own dialog because React Native Web's `Alert` does nothing).

Picked images are normalized to JPEG before reaching Skia because iPhone
photos are commonly HEIC, which Skia cannot decode. See `AGENTS.md` for this
and other implementation-specific lessons.
