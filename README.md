# Tuck

A local-first Expo photo editor for quick edits such as adding captions, making
memes, blurring or redacting sensitive details, cropping, and cutting out
subjects.

- Product vision, positioning, and principles: [PRODUCT.md](./PRODUCT.md)
- Design system: [DESIGN.md](./DESIGN.md)
- Codebase architecture: [docs/architecture.md](./docs/architecture.md)
- What's left to do: [docs/plans/follow-ups-plan.md](./docs/plans/follow-ups-plan.md)

## Getting started

The app includes local native modules (`modules/`), so it runs in a development
build rather than Expo Go. Install dependencies, then build and launch on the
iOS simulator or an Android emulator (this generates the ignored `ios/` and
`android/` folders and starts Metro):

```sh
npm install
npm run ios
npm run android
```

Once a build is installed, `npm start` serves JavaScript changes to it, and
`npm run web` runs the web version.

## Checks

CI runs all four checks on every push to `main` and on pull requests:

```sh
npm run check       # Biome formatting and lint rules (npm run format to fix)
npm run typecheck   # TypeScript
npm test            # Node unit tests across src/ and modules/
npm run build:web   # Static web export, service worker, and CSP check
```
