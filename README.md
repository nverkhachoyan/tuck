<img src="./assets/icon.svg" alt="" width="96" height="96">

# Tuck

**The last touch for photos and screenshots.** Private, on your device. No
account. Try it at [tuck.tools](https://www.tuck.tools).

A local-first Expo photo editor for quick edits such as adding captions, making
memes, blurring or redacting sensitive details, cropping, and cutting out
subjects.

- Product vision, positioning, and principles: [PRODUCT.md](./PRODUCT.md)
- Design system: [DESIGN.md](./DESIGN.md)
- Codebase architecture: [docs/architecture.md](./docs/architecture.md)
- Building, running, and testing: [docs/development.md](./docs/development.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- What's left to do: [docs/plans/follow-ups-plan.md](./docs/plans/follow-ups-plan.md)

## Getting started

The app includes local native modules (`modules/`), so it runs in a development
build rather than Expo Go. Install dependencies, then build and launch on the
iOS simulator or an Android emulator (this generates the ignored `ios/` and
`android/` folders and starts Metro):

```sh
pnpm install
pnpm ios
pnpm android
```

Once a build is installed, `pnpm start` serves JavaScript changes to it, and
`pnpm web` runs the web version.

## The code

Imports flow down this list; [docs/architecture.md](./docs/architecture.md)
has the rules, which `biome.json` enforces.

```text
src/
  app/        routes only (Expo Router)
  screens/    home, create, export, info, and the editor's route
  editor/     the editor, entered through index.ts (core.ts for plain TypeScript);
              document/ holds the document, layers/ one folder per layer type,
              render/ draws a document with Skia, and tools/ one folder per tool
  photos/     picking and importing photos
  projects/   saving projects on the device
  site/       the web site's pages and metadata
  ui/         shared controls and the theme
  platform/   preferences, haptics, files, and other OS ports
modules/
  image-analysis/   on-device detection (native)
  share-target/     receiving shared photos (native)
```

New to the code? The interactive lessons in
[docs/interactive](./docs/interactive/README.md) ("Inside Tuck") run the real
document and renderer, from the bottom up.

## Checks

CI runs all four checks on every push to `main` and on pull requests:

```sh
pnpm check       # Biome formatting and lint rules (pnpm format to fix)
pnpm typecheck   # TypeScript
pnpm test        # Node unit tests across src/ and modules/
pnpm build:web   # Static web export, service worker, and CSP check
```

## License

[MIT](./LICENSE). The stickers in `assets/stickers/` and the fonts keep their
own licenses, listed in the app's Licenses page.
