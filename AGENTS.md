# AGENTS.md

## Learnings

- Skia (`@shopify/react-native-skia`) cannot decode HEIC, the default capture format on iPhone. Always re-encode picked photos to JPEG (via `expo-image-manipulator`) before handing the URI to `useImage`/Skia, or real device photos will silently fail to render.
- `expo-image-manipulator`'s API changed in SDK 57: the old `manipulateAsync(uri, actions, options)` is deprecated. Use the chainable context API instead: `ImageManipulator.manipulate(uri)...renderAsync()` → `ImageRef.saveAsync(options)`. Check the package's own `.d.ts` files rather than assume the old signature still works.
- `useImage()` fails silently — a decode error just resolves to `null` with no thrown error or console output. Always pass its `onError` callback (at least temporarily) when an image isn't rendering; it's the fastest way to get an actual error message instead of guessing.
- A flex container with `alignItems`/`justifyContent: "center"` collapses a `flex: 1` child's cross-axis size to 0 (no stretch). Don't wrap a Skia `<Canvas>` (or anything else that needs `onLayout` to report real dimensions) in a centering container — let it stretch and center its own contents instead.
- In Expo Go, opening `exp://127.0.0.1:8081` while the app is already foregrounded just refocuses it — it does not fetch a fresh JS bundle after installing new dependencies. Force a real reload with `xcrun simctl terminate <udid> host.exp.Exponent` then reopen the `exp://` URL.
