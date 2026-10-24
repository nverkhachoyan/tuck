# Architecture

The editor keeps the original photo and represents edits as an
`EditorDocument`. Layer transforms use document-space coordinates, independent
of the preview size. The canvas fits that document into the available screen
space, while gesture state is held outside React during an interaction and
committed to the document when the gesture ends. Export and project thumbnails
render the same document offscreen with Skia.

## Modules

- `src/app/` holds thin Expo Router route files. A project's editor is at `/projects/[id]` and its export at `/projects/[id]/export`, so a link or a reload opens the project from storage (`useProjectSession`); `vercel.json` serves those routes from the static export.
- `src/screens/` owns the home, create, editor, export, and info screens (Settings, support, privacy, licenses, and the 404 page). The home screen starts from a photo, a pasted or dropped image, a photo shared from another app, or, through Create, an empty canvas at a preset or custom size.
- `src/screens/editor/` is the interactive editor, in a folder per part:
  - `canvas/` draws the document (`EditorScene`, `EditedTextView`, `LiveStrokeOverlay`, `SelectionOverlay`) and handles gestures, selection handles and cursors, hit-testing, and snapping.
  - `tools/crop/` holds `CropTool`, which crops, turns, flips, and straightens the photo (the lowest locked one, or just the canvas without one) and expands the canvas around it; its geometry is in `cropGeometry.ts` and its box dragging in `cropDrag.ts`.
  - `tools/text/` holds the text panel and the full-screen `TextEditor`.
  - `tools/draw/` holds the drawing panel and brush settings.
  - `tools/redact/` holds the redaction panel and settings.
  - `tools/find/` holds face and text detection (`useImageDetection`, `FindPanel`).
  - `tools/cutout/` holds subject and object selection, mask refinement brushes, invert, and mask-shaped redactions.
  - `tools/adjust/` holds color adjustments.
  - `tools/layers/` holds the layers panel, where any layer is hidden, locked, deleted, or reordered.
  - `tools/stickers/` holds the sticker sheet, bundled stickers, and the ones people save.
  - `shell/` holds the dock, the toolbar, the header's actions, layer actions, the selection bar, and the controls every tool's panel is built from.
  - `detection/` is the editor's only bridge to `image-analysis`: `imageDetection.ts` finds faces and text for Find, and `subjectDetection.ts` selects subjects and objects for Cut out.
  - `session/` holds the project session: `useProjectSession` opens the project, `useAutosave` saves it, and `SaveErrorBanner` shows a failed save.
  - The editor root holds `EditorScreen` and `EditorDock`, which compose the parts, and what spans the whole editor: adding images (`useAddImage`), its mode, how its tools open and close (`useToolLifecycle`), keyboard shortcuts, and the delete notice. The background picker is in `src/ui/` because Create also uses it.
- `src/model/` defines the document, layers, cutout masks, and geometry as plain data: no React. The document is the canvas (its size, and a background fill or transparency) and its layers, which may be none. A photo is an image layer like any other: a document's own photo starts locked, and can be unlocked, reordered, hidden, or deleted; photos added later start unlocked. `framing.ts` moves the framing's anchor (the lowest visible locked image, or with none, the canvas itself) to a new place on a new canvas and keeps every other layer over the same spot, which is all cropping, turning, and flipping are.
- `src/store/` is the Zustand store shared across screens: `index.ts` combines the slices into `useStore`, and `editorSlice.ts` owns the document, selection, undo history, tool sessions, and every edit that mutates them.
- `src/photos/` picks, pastes, drops, or receives a shared photo and re-encodes it as JPEG (iPhone photos are commonly HEIC, which Skia cannot decode).
- `src/projects/` keeps every editing session as a local project: its photos move into it, each as a file of its own, edits autosave, and the home screen lists projects to reopen, rename, duplicate, or delete, each with a thumbnail rendered when its editor closes. `projectFile.ts` is the saved format (versioned, with image layers naming their file in the project); `projectLifecycle.ts` opens, saves, and closes projects, removing files no layer uses once one closes, with storage passed in so Node can test it.
- `src/render/` is how a document draws: a view for each layer type in document space (in `layers/`), `LayerContent` and `useDecodedImage` (which the editor's canvas and crop use too), the decoded-image cache, `fonts.ts` (which bundles the text fonts so text renders identically on iOS, Android, and web), and `DocumentRenderScene`, which renders offscreen for export and project thumbnails. `src/screens/export/` chooses output sizes and format, then saves the image to Photos, copies it, or shares it: as JPEG, or as PNG when some of the canvas is transparent.
- `src/ui/` holds reusable controls and `theme.ts` shared across screens.
- `src/platform/` holds the OS ports any caller can use: haptics, preferences (`preferenceStore`, `usePreference`), temporary files, and the service worker, each with a `.web.ts` version where the web differs.
- `src/lib/` holds small language helpers and the site's address (`site.ts`).
- `modules/image-analysis/` is a local Expo module for on-device face, text, subject, and object detection (Apple Vision, Google ML Kit, MediaPipe, Tesseract, and MobileSAM with ONNX Runtime; see [on-device-detection.md](./on-device-detection.md)).
- `modules/share-target/` is the native share extension on iOS and share activity on Android.
- `index.ts` / `index.web.ts` are the app entry. On web, it loads Skia's WASM build before any app code runs.

## Boundaries and Platform Files

Imports flow one way: `app` → `screens` → `photos` / `projects` / `render` /
`store` → `model`, with `ui`, `platform`, and `lib` beneath. Lint rules in
`biome.json` enforce these boundaries. Adding a layer type means a file in
`model/layers/` for its type and factory, a case in the `Layer` union
(`model/layers/layer.ts`), a view in `render/layers/`, and a case in
`LayerContent` and `DocumentRenderScene` (`assertNever` flags any you miss).

Platform differences live in `.web.ts` files next to their native versions
(`saveImage.web.ts` downloads instead of saving to Photos;
`projectStorage.web.ts` keeps projects in IndexedDB instead of files;
`showAlert.web.tsx` draws its own dialog because React Native Web's `Alert`
does nothing). See [AGENTS.md](../AGENTS.md) for implementation-specific
lessons.
