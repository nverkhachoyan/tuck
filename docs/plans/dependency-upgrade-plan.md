# Dependency upgrade

Researched October 28, 2026. This plan moves the app from Expo SDK 57 to SDK 58, then React Native Skia to its new package name, and later to Skia 3. It covers what changes, what in this code it touches, and the order to do it in.

**Status:** section 3 was built on October 28, 2026, on the `expo-sdk-58` branch. Section 4 (Skia 3) is blocked on an upstream issue, and section 5 (Gesture Handler's hooks) comes after SDK 58 settles.

What building it found:
* Biome 2.6 formats Markdown (its formatter is off in `biome.json`) and adds a React Native raw-text rule, which skips the info pages' text components and the DOM-rendered files.
* The layer list keeps Gesture Handler's `LegacyScrollView`, so a row's builder `Pan` can still block it.
* An Android Release build with R8 broke Find (a `NullPointerException` in ML Kit) and Pick (ONNX Runtime's JNI aborted). Neither library ships R8 rules; `modules/image-analysis/android/consumer-rules.pro` keeps them.
* SDK 58's precompiled modules build with Xcode 27.1.
* Skia 2.15's web build looks for `react-native/asset-registry`, which `docs/interactive` stubs.
* Once, on a cold Vite cache, the interactive docs threw "Cannot pass deleted object as a pointer of type sk_sp<Picture>" switching to the Export lesson; it didn't happen again. Skia 2.14 deletes a canvas's last picture on unmount, so watch for it in the app: Expo Router 58 hides a stack screen in React `Activity` once two screens are above it, which cleans up and reruns a canvas's effects.

Checked: web at 390, 1024, and 1440 points (editor, strokes, Layers sheet and row drag, export preview, Find's 28 faces, Pick, the CSP check); the iPhone simulator (projects, highlighter, strokes, redaction, layer row drag); Android Release on the emulator (Find faces, Pick, Subjects). Not checked yet from section 6: the iPad simulator and a narrow iPad window, the share extension, saving to Photos, the rest of the gesture checklist, offline web, and comparing renders against SDK 57 screenshots.

## 1. Where things stand

Expo SDK 58 came out on October 15, 2026 (`expo@58.0.21` is `latest`). Its `bundledNativeModules.json` pins `@shopify/react-native-skia` 2.14.0, which is the last release under that name. Skia 2.14 also needs `react-native-worklets` 0.7 or later and Reanimated 4, which SDK 58 pins too.

React Native Skia moved to `react-native-skia` (the `wcandillon/react-native-skia` repository). Under the new name it has two lines:

* **2.x** (`react-native-skia@2`, tag `release-2.x`, now 2.15.2). The same renderer as 2.14: Skia milestone 154 on Metal and OpenGL. 2.15 adds only `SkiaGraphiteView` and backports fixes.
* **3.x** (`latest`, now 3.8.1). Renders with Skia's Graphite backend on Dawn: Metal on iOS, Vulkan on Android, milestone 157. Web stays on CanvasKit (`canvaskit-wasm` 0.41.1).

Neither is in Expo's `bundledNativeModules.json`, so `expo install` and `expo-doctor` won't manage or check them: pin the version exactly, as `package.json` does today.

| Package | Now (SDK 57) | SDK 58 pin | Latest on npm |
| --- | --- | --- | --- |
| `expo` and `expo-*` | 57.0.x | 58.0.x | 58.0.x |
| `react-native` | 0.86.3 | 0.88.1 | 0.88.1 |
| `react`, `react-dom` | 19.2.3 | 19.3.0 | 19.3.1 |
| `@shopify/react-native-skia` | 2.6.2 | 2.14.0 | 2.14.0 (final) |
| `react-native-skia` | | | 2.15.2 and 3.8.1 |
| `react-native-reanimated` | 4.5.1 | 4.7.1 | 4.7.1 |
| `react-native-worklets` | 0.10.1 | 0.13.0 | 0.13.1 |
| `react-native-gesture-handler` | ~2.32.0 | ~3.3.0 | 3.4.0 |
| `react-native-safe-area-context` | ~5.7.0 | ~5.10.1 | 5.11.0 |
| `react-native-screens` | ~4.26.0 | ~4.30.0 | 4.30.1 |
| `react-native-web` | 0.21.2 | ~0.21.4 | 0.21.4 |
| `@types/react` (template) | ~19.2 | ~19.3.0 | |
| `typescript` (template) | ~6.0.3 | ~6.0.3 | 7.0.2 |

Outside Expo's set: `@biomejs/biome` 2.5.14 → 2.6.3, `zustand` 5.0.15 → 5.0.16, `@mediapipe/tasks-vision` 1.0.1 → 1.2.0, `onnxruntime-web` 1.30.0 → 1.31.1, `@types/react-dom` 19.2 → 19.3. `tesseract.js` (7.0.0) and the `@expo-google-fonts/*` packages are already current.

Take Expo's pins rather than npm's latest for every native package: `npx expo install --fix` and `expo-doctor` hold them there, and only those versions are built and tested against SDK 58's React Native.

## 2. What changes

### Expo SDK 58 and React Native 0.88

* **iOS 27 scene life cycle.** SDK 58's template has `SceneDelegate.swift` and a `UIApplicationSceneManifest`, and creates the window in the scene delegate. `plugins/withSceneLifecycle.js` backports exactly that to SDK 57; its own comment says to remove it then. With the template's `AppDelegate.swift` its `CLASS_LINE` already carries the provider, so it would skip, but it's dead code: remove it and its `app.json` entry. `share-target`'s plugin only edits the Xcode project, so it's unaffected, but check the share extension still opens the app.
* **iOS builds resizable** with the iOS 27 SDK. The app sets `"orientation": "portrait"`, and `requireFullScreen` no longer opts out, so on iPad the window can now be resized. The wide layouts handle widths already; check the editor at narrow iPad window sizes.
* **`expo-file-system`: `File.write()` is now async.** Five calls rely on it finishing synchronously: `platform/temporaryFile.ts`, `platform/preferenceStore.ts`, `projects/projectStorage.ts`, `photos/clipboardImage.ts`, `screens/export/saveImage.ts`. Switch each to `writeSync()` (the old behavior), or `await write()` where the caller is already async. `File.md5` is deprecated for `File.digest()` (unused here).
* **Strict TypeScript API is the default** (from React Native 0.87). Deep imports from `react-native/Libraries/*` become type errors (none here), and refs use instance types (`ViewInstance`, `TextInputInstance`): about 17 `useRef<View>` and `useRef<TextInput>` sites and the `RefObject<View | null>` parameters may need retyping. `customConditions: ["react-native-legacy-deep-imports"]` in `tsconfig.json` defers this, until React Native 0.89; prefer fixing the types.
* **Removed from React Native:** `InteractionManager`, the `Touchable` root export, `NativeMethods` types, `Modal`'s `animated`, and `StatusBar`'s `backgroundColor`, `translucent`, and `networkActivityIndicatorVisible`. None are used here (`_layout.tsx` sets only `barStyle`). `ImageBackground` is deprecated (unused).
* **Expo Router.**
  * With `web.output` unset, SDK 58 renders on a server. `app.json` already sets `"static"`, so the export stays static; confirm `build:web` still writes `dist/+not-found.html` and the routes `vercel.json` rewrites.
  * Async routes are on by default on web. `index.web.ts` already imports the router dynamically after CanvasKit loads, but routes that load later each need their own chunk under the CSP and in the service worker's cache. Check `check-csp.mjs` and `write-service-worker.mjs` against the new `dist/`, and set `asyncRoutes: { web: false }` on the `expo-router` plugin if it gets in the way.
  * Router no longer supplies safe-area insets on web. `_layout.tsx` mounts its own `SafeAreaProvider`, so the seven `useSafeAreaInsets` users should keep working; check the bottom padding on a phone-width web window.
  * Navigation state handling was reworked and some of the forked React Navigation surface moved. Check `useRenderedDocument`'s recovery when a closing editor reopens (an AGENTS.md learning), and the back gesture between screens.
  * The static export renders without hydration through `__EXPO_ROUTER_HYDRATE__`. Make sure SDK 58 still reads it.
* **Android release builds run R8.** ONNX Runtime and ML Kit reach Java through JNI, which R8 can strip. Build a Release APK and run Find, Cut out, and Pick on the emulator. If anything fails, add keep rules through the module's `consumerProguardFiles`, or set `android.enableMinifyInReleaseBuilds: false` in `expo-build-properties` while looking.
* **Precompiled modules.** `docs/development.md` has a workaround for Xcode 27.1's Swift 6.4 rejecting SDK 57's prebuilt xcframeworks. Try SDK 58's without `EXPO_USE_PRECOMPILED_MODULES=0` first, and drop or update that note by the result. Android now ships `expo-modules-core` precompiled, which should halve clean builds.
* **`expo-media-library`:** `Asset.getUri()` returns the current Photos version of a video. The app saves only photos, so `Asset.create` is unaffected.
* **`NODE_ENV`** is set by the command now. Nothing here reads it.
* **Node** needs 22.13+, 24.3+, or 26+. Local Node is 24.14 and CI uses 24.
* **Expo Modules 2.0** (plain Swift and Kotlin classes) is a beta. `modules/image-analysis` and `modules/share-target` keep the current DSL, which still works.

### React Native Skia 2.6.2 → 2.14.0

Native Skia moves from milestone 147 to 154. Web stays on `canvaskit-wasm` 0.41.0, so `copy-web-assets.mjs`'s path and `LoadSkiaWeb` from `lib/module/web` are unchanged (both checked in the 2.14.0 package).

* **The mutable `SkPath` API is removed (2.14).** `moveTo`, `addRect`, and the like are gone from `SkPath`. The code already builds paths with `Skia.PathBuilder` and has no `Skia.Path.Make`, so `typecheck` should find nothing; anything it does find moves to `PathBuilder`. The same goes for `docs/interactive`, which compiles `render/`.
* **The legacy architecture is gone (2.13).** The app runs on the new one.
* **Host objects became native state (2.10)**, and the declarative renderer no longer needs garbage collection to free objects (2.14). This is where the AGENTS.md learnings about freed images live: `decodedImages`, the image cache keyed by decoded image, `SkPicture`s that outlive their holder. Watch for "Cannot pass deleted object" on web, and for memory on iOS, while switching photos and projects.
* **Drawing fixes that can change what's drawn (2.11.1):** a `Mask`'s `srcIn` composite is applied once per group instead of per draw (`DrawingLayerView`, `ImageLayerView`, `RedactionLayerView`), paint antialiasing has a new default (2.11.2), `SavePaint`'s opacity stack is balanced, and an inner shadow comes from the outline. Compare redactions, masked image layers, and strokes against SDK 57 screenshots of the same project.
* **Web:**
  * The canvas's WebGL context survives a layout-effect cleanup (2.12), RN Web's frame rate is fixed (2.11.2), the reconciler's WASM memory use is fixed (2.8), and Skia's `<View>` on web was rewritten (2.7). These touch the workarounds `EditorCanvas`, `CropCanvas`, and `drawOffscreen` were built around: keep them, and check that blank first frames, dropped redraws, and lost contexts don't come back.
  * `Font.measureText` now works on web (2.9).
* **Text (2.9):** `matchFont` and `Paragraph` share one font style type, and paragraph styles accept `undefined` values. Expect type fallout in `render/fonts.ts` and `model/textEditing.ts`'s callers, not behavior changes.
* **Color (2.7):** the canvas supports high color depth onscreen. Check that `colorSpace="srgb"` on `EditorCanvas` and `CropCanvas` still matches offscreen renders on iOS (draw a saturated red, export it, compare).
* **Types (2.11.2):** the types now need the `esnext.disposable` lib. Expo's base tsconfig with TypeScript 6 should include it; if `typecheck` reports `Disposable`, add the lib.
* **New, unused for now:** Swift Package Manager on iOS (2.12), `android.surfaceType` to choose Android's backing view (2.13), `Surface.flush({ sync })` (2.7), `Paragraph.getPath()` (2.8).

### The new package name

Moving from `@shopify/react-native-skia` 2.14.0 to `react-native-skia` 2.15.x changes the name and nothing else that this app uses. Installing both at once isn't supported.

* 50 files in `src/`, `modules/`, and `docs/interactive/src/` import `@shopify/react-native-skia`. The migration guide gives a one-line `git grep` and `perl` rewrite.
* The deep import of `lib/module/web` in `index.web.ts` and `docs/interactive`'s `loadSkia.ts` becomes `react-native-skia/lib/module/web`. `LoadSkiaWeb` is still exported there, in 3.8.1 too.
* `copy-web-assets.mjs` resolves `canvaskit-wasm` through `require.resolve("@shopify/react-native-skia")`.
* 2.15.1 fixes resolving the asset registry on React Native 0.87+ web, which SDK 58's 0.88 needs if Skia loads fonts or images through it.

### React Native Skia 3

3.0.0 came out on October 2, 2026. Its peers (React Native 0.79+, Reanimated 4, worklets 0.7+) fit SDK 57 and 58. It has moved fast: about 35 releases to 3.8.1 on October 27. Minor versions renamed APIs twice (the CPU surface and image APIs in 3.4.2, then factory names in 3.8.0) and removed APIs twice (the snapshot view API in 3.6.0, `SkiaPictureView` in 3.8.0). Read each release's notes before a bump.

What it changes here:

* **The canvas's color space can't be set.** `colorSpace` is removed. The canvas picks Display P3 on wide-gamut Apple displays and sRGB elsewhere. The editor depends on that prop: `EditorCanvas`, `CropCanvas`, and `docs/interactive`'s `SkiaStage` set `colorSpace="srgb"` so the preview draws as the export does (`docs/architecture.md`, AGENTS.md). The October 28 test (section 4) found that on 3.8.1 the highlighter's multiply blend and blurs preview differently from the export on an iPhone. That blocks 3.x for now.
* **Android requires Vulkan 1.1 and API 26.**
  * `minSdkVersion` goes from 24 (React Native's default) to 26, through `expo-build-properties`.
  * The manifest requires Vulkan 1.1, so Google Play hides the app from phones without it. Where Vulkan is missing, `Skia.gpu.isAvailable` is false and canvases stay blank.
  * The Android emulator needs a host GPU with Vulkan.
  * Choosing which Android phones to drop is a product decision.
* **iOS needs 15.1.** The app targets 16.4, so nothing changes.
* **Renamed APIs.**
  * `cutMask.tsx`'s `Skia.Image.MakeImage` (the `Gray_8` mask) becomes `Skia.Image.MakeRaster`.
  * `drawOffscreen.web.ts`'s `makeNonTextureImage()` becomes `makeRasterImageSync()`, which throws on failure instead of returning `null`, so its fallback needs a `try`.
  * `Skia.Surface.MakeOffscreen` keeps its name.
  * `readPixels` on a GPU image blocks; 3.x offers `makeRasterImage()` to read without blocking. Check `photoImport.ts`, `cutMask.tsx`, and `renderDocument.tsx`, and the learning that `readPixels` returns null for `Gray_8` from a GPU surface.
* **Rendering moves off the UI thread.** A `Canvas` records its scene once per React commit, and a native thread pool replays it. The UI thread only applies animated values, read when the frame draws rather than when it records (3.7.3). This touches the live transform, the live stroke overlay, and image lifetimes (each recorder owns its image provider from 3.7.3, and recorders are pooled from 3.7.4). Recheck the learnings on `decodedImages` releasing images and on `SkPicture`s that outlive their holder.
* **Web.** CanvasKit 0.41.1 makes `PathBuilder` add shapes in linear time (3.5.0). Surfaces share one WebGL context (3.4.3), which may remove why `drawOffscreen` exists (each `drawAsImage` made its own context and the browser dropped the oldest): keep it until a check shows otherwise.
* **Graphite draws slightly differently.** Compare rendering screenshots against 2.x. `Atlas` is slower, but unused.
* **Unused here:** video, native buffers, view snapshots, `useCanvasSize`, `onSize`, `opaque`, and `debug` were removed or changed; none are used.
* **Gains:** smoother canvases on large photos from off-thread rendering, ProMotion's full frame rate (3.7.1), GPU textures shared across worklet runtimes, and 10-bit rendering on Android (`highBitDepth`).

### Reanimated 4.7 and worklets 0.13

* **New layout animations engine** is the default. `FadeIn`/`FadeOut` `entering`/`exiting` in `PanelViews`, `ShortcutsOverlay`, and `Dock` run on it: check they still play and that `Dock`'s panel swap doesn't jump. The `BottomSheet` learning (a nested `entering` animation lands misplaced) may change.
* `AnimatedRef` changes shape and `measure` on an unmounted ref returns `null`. The app has no `useAnimatedRef` or `measure`.
* Worklets 0.12 enables Hermes' microtask queue on worklet runtimes, 0.13 drops the Serializable handle and changes the Babel plugin's output, and 0.12 fixes web `scheduleOnUI` on errors. Check the worklet learnings still hold: `syncLiveTransform` calling worklets directly on web, `scheduleOnUI` atomicity on native, and the module still loading with worklet helpers declared above their callers.

### Gesture Handler 3

SDK 58 pins `~3.3.0`, a major version. The `Gesture.*` builders and `GestureDetector` still work in 3.x but are marked deprecated, in favor of hooks (`usePanGesture`, `useSimultaneousGestures`, and so on). Upgrade on the builders first, and move to hooks as its own later step (section 5).

What changes even on the builders:

* **`GestureDetector` is now a host view.** Moving it in the tree detaches it and cancels its gesture. Check the canvas gestures while tools open and close, which re-composes the gestures above the canvas.
* **`ScrollView` and the other components were rewritten with hooks**, keeping their names. `LayerRow`'s pan uses `.blocksExternalGesture(scrollRef)` against `LayersPanel`'s Gesture Handler `ScrollView`, and relations can't be set between hook gestures and the older API. If dragging a layer row starts scrolling the list again, import `LegacyScrollView` until the hooks migration.
* Types moved under `Legacy*` names (`LegacyPanGesture`, `LegacyTapGesture`). `useDialDrag.ts` imports `TapGesture` as a type; follow the compiler.
* Check the Pan learnings (iOS activates only on movement, `onFinalize` commits, a second finger cancels through `numberOfPointers`/`onTouchesDown`) and `Gesture.Simultaneous`'s leaves, on iOS and on web.

### Outside Expo

* **`@mediapipe/tasks-vision` 1.0.1 → 1.2.0.** `copy-web-assets.mjs` copies its `vision_bundle.js` and WASM files by name, and the CSP hashes and blocks its telemetry. Run `build:web` and Find's faces on web, and check the face count on the Solvay photo still matches.
* **`onnxruntime-web` 1.30.0 → 1.31.1** matches `onnxruntime-android` 1.31.0 in `modules/image-analysis`. Check Pick on web, with WebGPU and on the WASM fallback.
* **`@biomejs/biome` 2.6.3:** run `npm run check`; a new recommended rule may flag things.
* **Hold back:**
  * TypeScript 7 (the Go compiler). SDK 58's template still pins `~6.0.3`, and `docs/interactive` runs `tsc` too. Revisit once Expo moves.
  * `@types/node` 26. It should follow the Node that runs the tests (24).
  * Gesture Handler 3.4 and safe-area-context 5.11, which are past SDK 58's pins.

## 3. Steps

These steps are safe to do now, in this order. None of them needs Skia 3, and each keeps the editor's sRGB preview:
* Skia stays on 2.x throughout: `@shopify/react-native-skia` 2.14.0 under SDK 58, then `react-native-skia` 2.15.x.
* 2.15.2 still has `Canvas`'s `colorSpace` prop and the 2.x API names (`MakeImageFromEncoded`, `makeNonTextureImage`, `Skia.Image.MakeImage`), checked in the published package.

Rules for the whole upgrade:
* Don't install `react-native-skia@3` or take `latest` for it. Pin an exact 2.x version of `react-native-skia` (its `release-2.x` tag).
* Keep `colorSpace="srgb"` on `EditorCanvas` and `CropCanvas`.
* Skia 3 waits for [wcandillon/react-native-skia#4355](https://github.com/wcandillon/react-native-skia/issues/4355) (section 4).

Each step ends with `npm run check`, `npm run typecheck`, `npm test`, and `npm run build:web`, and is its own commit.

1. **Small packages.** Bump `zustand`, `@biomejs/biome`, and `@types/react-dom`. Run `npm run format`. The risk is a new Biome lint rule.
2. **MediaPipe and ONNX Runtime web.** Do this together with step 1, as a warm-up before SDK 58. Bump `@mediapipe/tasks-vision` to 1.2.0 and `onnxruntime-web` to 1.31.1, and rerun `npm install` so `postinstall` copies the new assets. `build:web`'s CSP check and `copy-web-assets.mjs`'s file names are where it breaks. Then check Find's faces and Pick on web.
3. **Expo SDK 58.** The largest step: do it on its own branch, and run the full verification (section 6) before merging it. Its risks are unrelated to Skia's color space (section 2): Gesture Handler 3, the async `File.write()`, strict TypeScript ref types, R8 in Android release builds, and Expo Router's async routes on web.
   1. `npx expo install expo@^58.0.0 --fix`, then `npx expo-doctor@latest`. Check that it pinned Skia to `2.14.0` exactly (the app pins Skia exactly today), and that `react-native-safe-area-context` came along (the release notes call it out). Run `npm run format` and check the lockfile with `git diff -w`, per AGENTS.md.
   2. Make `typecheck` pass: the `File.write` calls, ref types, Gesture Handler's renamed types, and anything from Skia's `SkPath` and font types.
   3. Remove `plugins/withSceneLifecycle.js`.
   4. Regenerate `ios/` and `android/` (`npx expo prebuild --clean`), with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for CocoaPods. Try precompiled modules first.
   5. Bump `react`, `react-dom`, and `@types/react` in `docs/interactive` to match, and build it: its lessons compile `render/` against the root's Skia.
   6. Verify (section 6).
4. **Skia's new name**, right after SDK 58.
   * Why now: `@shopify/react-native-skia` gets no more releases, so fixes reach only the new name, and 2.15.1 fixes web assets on React Native 0.87 and later.
   * `npm uninstall @shopify/react-native-skia`, then `npm install --save-exact react-native-skia@2.15.2` (or the latest 2.15.x). Check that `package.json` doesn't pick up a 3.x version.
   * Rewrite the imports (about 50 files: `git grep -l "@shopify/react-native-skia" -- . ":!docs/plans" ":!package-lock.json" | xargs perl -pi -e 's#\@shopify/react-native-skia#react-native-skia#g'`), plus `index.web.ts`, `docs/interactive`'s `loadSkia.ts`, and `copy-web-assets.mjs`.
   * Rerun `npm install` so `postinstall` copies `canvaskit.wasm` from the new path, and rerun `pod install`: Skia's podspec copies its iOS libraries into `node_modules` then, and a fresh `npm install` deletes them.
   * Build `docs/interactive`, and smoke-test the editor on web and the iOS simulator.
5. **Update the docs.** In AGENTS.md, the learnings that name "SDK 57" (`expo-image-manipulator`, `expo-media-library`, `expo-file-system`), and any learning this upgrade made untrue. In `docs/development.md`, the precompiled modules note. In `docs/architecture.md`, nothing unless a file moved.

## 4. Later: React Native Skia 3

**Blocked: don't start until [wcandillon/react-native-skia#4355](https://github.com/wcandillon/react-native-skia/issues/4355) gives a canvas a way to render in sRGB.** Then repeat the color-space test (step 1) on that release before anything else. It's a separate change, after SDK 58 and the rename have settled.

1. **The color space: tested October 28, 2026, and it blocks.**
   * **Setup.** A test screen drew each operation onto a `Canvas` with `colorSpace="srgb"`, onto one without it, and offscreen with `drawAsImage` (the export's path). It ran once on 2.6.2 (SDK 57's build) and once on 3.8.1 (a development build of SDK 57 with `react-native-skia@3.8.1`).
     * On the iPhone 17 Pro simulator (iOS 26.5), pixels were read from `xcrun simctl io` screenshots.
     * The 3.8.1 run was repeated on an iPhone 17 Pro Max (iOS 27), read from an on-device screenshot (a Display P3 PNG, converted to sRGB). Every value matched the simulator's to within one unit.
   * **Results.** Values are sRGB, as the screenshot reads them.

     | Operation | Offscreen (export) | 2.6.2, `srgb` canvas | 2.6.2, P3 canvas | 3.8.1 canvas |
     | --- | --- | --- | --- | --- |
     | `rgb(255,0,0)` fill | 255, 0, 0 | 255, 0, 0 | 255, 0, 0 | 255, 0, 0 |
     | Red through a `ColorMatrix` that averages R and G | 128 gray | 128 | 143 | 128 |
     | Displacement map from an `rgb(128,0,0)` shader, scale 200 | no shift | no shift | 8.3 pt | 8.3 pt |
     | Highlighter yellow `rgb(255,221,0)` multiplied over `rgb(0,160,255)` | 0, 139, 0 | 0, 139, 0 | 34, 140, 64 | 34, 140, 64 |
     | Middle of a 12-point blur across a red and blue edge | 124, 0, 132 | 125, 0, 130 | 125, 10, 147 | 126, 10, 147 |

     On 3.8.1, `colorSpace` is ignored and the canvas is P3. Color filters now run in sRGB, so Adjust's `ColorMatrix` previews as it exports. Blending, blurs, and displacement-map shaders still run in P3, as on a 2.x P3 canvas.
   * **What it means for the app.**
     * The highlighter (`DrawingLayerView`'s multiply layer) previews visibly greener over saturated colors than it exports.
     * Blur redactions and the blurred brush preview slightly off at saturated edges.
     * Redaction's pixelate is unaffected: `samplePixels` draws its displacement ramps in gray, which P3 leaves unchanged.
     * Offscreen renders (export, thumbnails, the eyedropper) are still sRGB, so exported files are right; only the on-screen preview disagrees with them.
   * **Ways forward:**
     * Ask upstream for a way to set a canvas's color space, as 2.x had. This is the simplest. Asked in [wcandillon/react-native-skia#4355](https://github.com/wcandillon/react-native-skia/issues/4355) (October 28, 2026); check it before starting this phase.
     * Preview the document as an sRGB offscreen image. This costs a frame of latency and memory on large photos, and live strokes and gestures would need an onscreen overlay.
     * Accept the mismatch, which goes against what the editor promises (what you see is what you export).
   * **Repeating the test.** The test screen was a throwaway route that drew the table's five operations as 100-point swatches. Rebuild it from the table, and run it again with each Skia 3 release that touches color spaces.
2. **Decide on Android's Vulkan and API 26 floor.** Check how many installs would be cut off in Play Console's device catalog.
3. **Upgrade.** Pin the version exactly, set `minSdkVersion` 26 with `expo-build-properties`, make the API renames, and run `pod install` and a clean Android build.
4. **Verify** as in section 6, plus a Release build on a real Android phone (Vulkan), a long editing session on iOS watching memory, and live strokes and pinches on a large photo for frame rate.
5. **Update the docs.** The color-space paragraph in `docs/architecture.md`, and the AGENTS.md learnings on `colorSpace`, `drawAsImage`'s WebGL contexts, `readPixels`, and image lifetimes, whichever no longer hold.

## 5. Later: Gesture Handler's hooks API

A separate change once SDK 58 has settled. Software Mansion publishes a migration skill (`gesture-handler-3-migration`) for this.

* Builders become hooks with a config object: `Gesture.Pan().minDistance(0)` becomes `usePanGesture({ minDistance: 0, ... })`.
* Callbacks are renamed: `onStart` → `onActivate`, `onEnd` → `onDeactivate`. `onChange` is gone (use `onUpdate`'s `change*` fields), and `onEnd`'s `success` becomes `event.canceled`, inverted.
* Composition: `Gesture.Race` → `useCompetingGestures`, `Gesture.Simultaneous` → `useSimultaneousGestures`. Relations: `blocksExternalGesture` → `block`, `requireExternalGestureToFail` → `requireToFail`, `simultaneousWithExternalGesture` → `simultaneousWith`.
* Hook gestures and builder gestures can't have relations with each other, so migrate the canvas's composed gestures (`useViewGesture`, `useLayerTransformGesture`, `usePaintGesture`, `useEditTextGesture`, `useCropGesture`, and their composition in the editor) in one change. `Dial`, `ColorPicker`, `BottomSheet`, and `LayerRow` can go one at a time.
* Since hooks run in a component's body, check this fits how tool hooks build gestures through `ToolEnv` (the hooks run above the `EditorContext` provider).
* Recheck the AGENTS.md learnings on `Gesture.Simultaneous` nesting and `minDistance(0)` Pans, which may no longer apply.

## 6. Verification

As the follow-ups plan does, on web at 390, 1024, and 1440 points wide, on the iPhone and iPad Pro 13-inch simulators, and on the Android emulator:

* **Rendering:** open a project with every layer kind (photo, drawing with highlighter, shapes, text in each font, redaction boxes and brushed redaction, a sticker, a cut-out mask), compare against SDK 57 screenshots, and export it as PNG and JPEG. Check the export's colors on iOS.
* **Gestures:** the canvas tool checklist in `follow-ups-plan.md` §1 (every tool's stroke, tap, and drag; pinch and rotate the view; the dial; the color picker; layer row drag in a long layer list; the bottom sheet).
* **Detection:** Find (faces and text), Cut out's Subjects, and Pick on each platform, and Pick in an Android **Release** build for R8.
* **Web:** a cold load with the service worker cleared, then offline; the CSP check; the photo picker, drop, and paste; and memory after switching projects a dozen times.
* **iOS:** the share extension, saving to Photos, and an iPad window resized narrow.
* **The interactive docs:** `npm run build` in `docs/interactive`, then click through the rendering lessons.

## Sources

* [Expo SDK 58 release notes](https://expo.dev/changelog/sdk-58)
* [React Native Skia releases](https://github.com/wcandillon/react-native-skia/releases), 2.6.3 to 2.15.2 and 3.0.0 to 3.8.1
* [Migrating to React Native Skia 3](https://wcandillon.github.io/react-native-skia/docs/getting-started/migration)
* The `react-native-skia@3.8.1` package's type definitions, for the factory names after 3.8.0
* [Reanimated and worklets releases](https://github.com/software-mansion/react-native-reanimated/releases) (4.6.0, 4.7.0, worklets 0.11.0 to 0.13.0)
* [Upgrading to Gesture Handler 3](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3/)
* `bundledNativeModules.json` in the `expo@58.0.21` and `expo@57.0.31` packages, and `npm view` of each package's peer dependencies
