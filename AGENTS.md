# AGENTS.md

## Learnings

- Skia (`@shopify/react-native-skia`) cannot decode HEIC, the default capture format on iPhone. Always re-encode picked photos to JPEG (via `expo-image-manipulator`) before handing the URI to `useImage`/Skia, or real device photos will silently fail to render.
- `expo-image-manipulator`'s API changed in SDK 57: the old `manipulateAsync(uri, actions, options)` is deprecated. Use the chainable context API instead: `ImageManipulator.manipulate(uri)...renderAsync()` → `ImageRef.saveAsync(options)`. Check the package's own `.d.ts` files rather than assume the old signature still works.
- `expo-media-library` (SDK 57) moved to a new API: the classic top-level functions like `saveToLibraryAsync` still type-check but throw at runtime. Save with `MediaLibrary.Asset.create(uri)`, and call `requestPermissionsAsync(true, ["photo"])` first — on iOS `Asset.create` only checks write permission, it never prompts for it.
- `useImage()` fails silently — a decode error just resolves to `null` with no thrown error or console output. Always pass its `onError` callback (at least temporarily) when an image isn't rendering; it's the fastest way to get an actual error message instead of guessing.
- A flex container with `alignItems`/`justifyContent: "center"` collapses a `flex: 1` child's cross-axis size to 0 (no stretch). Don't wrap a Skia `<Canvas>` (or anything else that needs `onLayout` to report real dimensions) in a centering container — let it stretch and center its own contents instead.
- In Expo Go, opening `exp://127.0.0.1:8081` while the app is already foregrounded just refocuses it — it does not fetch a fresh JS bundle after installing new dependencies. Force a real reload with `xcrun simctl terminate <udid> host.exp.Exponent` then reopen the `exp://` URL.
- The iOS Simulator MCP tool's taps can silently go nowhere after repeated terminate/reload cycles — the RN JS thread can hang while the simulator itself stays fully responsive. If a tap at coordinates that worked before suddenly does nothing, don't assume your coordinate math is wrong: press the hardware HOME button first. If HOME works instantly but in-app taps still do nothing, the JS thread is hung — do a real `simctl terminate` + relaunch, not just another `open_url`/foreground refocus. Also give buttons real `hitSlop` (RN's default is the raw layout box, no forgiveness); it fixes real touch-target UX and takes tap-coordinate guessing out of your own testing.
- `TextInput`'s `selectTextOnFocus` doesn't apply when focus comes from `autoFocus` on iOS. Select from `onFocus` with `ref.setSelection(0, length)` instead, which covers both tap and autofocus.
- The iOS simulator here runs headless (no Simulator.app), with a hardware keyboard attached, so the software keyboard never appears and keyboard-overlap bugs can't be reproduced on it. Verify keyboard layout on a real device.
- A flaky `expo start --tunnel` can leave the app running a stale or half-updated bundle with no error in the app: a button from the new code can call a handler the old code never wired up. If behavior contradicts the code, check the Metro output for "Tunnel connection has been closed" before debugging, and prefer LAN mode (`npx expo start`) for simulator work.
- `npm install` copies `package.json`'s indentation into `package-lock.json`, and `npx expo install` rewrites `package.json` with 2 spaces. Biome is set to format both files with 2 spaces to match; if a dependency change shows a lockfile diff in the thousands of lines, check `git diff -w` before committing — it's indentation, not content.
- Tests import the module under test with an explicit `.ts` extension and start with `/// <reference types="node" />`: Node's type stripping needs the extension, and TypeScript 6 no longer includes installed `@types` packages by default. Only modules whose imports are all type-only (like `model/`) can be tested this way, since Node can't resolve the `@/` alias.

## Project Structure

- Keep imports flowing one way: `app` → `editor` / `import` / `export` → `layers` → `model`. `model/` stays plain TypeScript (no React, React Native, or Skia); `ui/`, `theme.ts`, and `lib/` never import app code.
- Only routes go in `src/app/` — expo-router turns every file there into a screen.
- Name component files in PascalCase and other modules in camelCase. Prefer growing an existing file over adding a single-use one; split a file when it gains a second responsibility.
- Name the editor document `document` (not `doc`). TypeScript's DOM lib declares a global `document`, so a missing parameter or destructure still type-checks against the browser global; watch for that when renaming.

## Git Commits

- Use Conventional Commits format for commit messages, such as `feat: add text editing` or `fix: handle invalid image input`.

## Code Checks

- After code changes, run `npm run check` to verify formatting and linting, and `npm test` when touching `model/`, the reducer, or other pure modules. Use `npm run format` to apply formatting fixes, and run `npm run lint` when checking lint rules only.
