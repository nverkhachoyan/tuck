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

- `src/app/` wires the current editor state to the application screens.
- `src/features/editor/model/` defines the persistent document, layers, and geometry.
- `src/features/editor/state/` owns document mutations, selection, and commands.
- `src/features/editor/canvas/` handles viewport mapping and gestures.
- `src/features/editor/layers/` groups rendering and controls by layer type.
- `src/features/editor/photo/` imports and normalizes source images.
- `src/components/ui/` contains controls shared across features.

Picked images are normalized to JPEG before reaching Skia because iPhone
photos are commonly HEIC, which Skia cannot decode. See `AGENTS.md` for this
and other implementation-specific lessons.
