# AGENTS.md

Read [docs/architecture.md](docs/architecture.md) before changing how the code is laid out, and [docs/development.md](docs/development.md) before building native code, running on a simulator, emulator, or device, or testing in the browser pane or headless Chrome. Detection (`modules/image-analysis`) has its own notes in [docs/on-device-detection.md](docs/on-device-detection.md); the design system is [DESIGN.md](DESIGN.md).

## Learnings

### Expo and native APIs

- Skia can't decode HEIC, the iPhone's default capture format: re-encode picked photos to JPEG (`expo-image-manipulator`) before Skia sees them, or device photos silently fail to render.
- `expo-image-manipulator` (SDK 57) deprecated `manipulateAsync`: use `ImageManipulator.manipulate(uri)...renderAsync()` → `ImageRef.saveAsync(options)`. Check a package's own `.d.ts` rather than assume an old signature.
- `expo-media-library` (SDK 57): the classic top-level functions like `saveToLibraryAsync` type-check but throw. Save with `MediaLibrary.Asset.create(uri)`, after `requestPermissionsAsync(true, ["photo"])` (on iOS `Asset.create` never prompts).
- `expo-file-system` (SDK 57) has no web implementation (`File` and `Directory` are empty stubs), so anything stored with it needs a `.web.ts`. On native, `move` and `copy` are async; `moveSync`/`copySync` are synchronous.
- The app runs in a development build, not Expo Go. `ios/` and `android/` are generated: native configuration goes in `app.json` and config plugins.
- Hermes has no `Array.prototype.toSorted` (it throws on iOS and Android, works on web). Sort a copy.
- `npm install` copies `package.json`'s indentation into `package-lock.json`, and `npx expo install` rewrites `package.json` (and `app.json`, when it adds a plugin) with 2 spaces. Run `npm run format` afterward, and if a lockfile diff runs to thousands of lines, check `git diff -w`: it's indentation.

### Layout

- A container with `alignItems`/`justifyContent: "center"` collapses a `flex: 1` child's cross-axis size to 0. Don't wrap a Skia `<Canvas>` (or anything needing a real `onLayout` size) in one; let it stretch and center its own contents.
- `flex: 0` on web is CSS `0 1 0%`: the view starts at zero height and shrinks. To stop a view flexing, leave `flex` off and add `flex: 1` only where it should fill.
- A `flex: N` view in a column sized by its content collapses to zero on native but keeps its content's height on web. Give a view `flex` only where its parent has a size to share.
- The root `SafeAreaView` leaves out the bottom edge. Each screen or full-screen overlay pads its bottom content with `useSafeAreaInsets().bottom` added to its usual padding; don't escape a padded parent with a negative offset (the screen clips it).
- Give buttons real `hitSlop`: React Native's default is the raw layout box.

### Skia

- `useImage()` fails silently (a decode error resolves to `null`, and a failed read rejects unhandled without calling `onError`). Load image layers with `decodeImage` through the `decodedImages` cache (`render/decodedImages.ts`).
- A hook holding an image from `decodedImages` must forget it in the same cleanup that releases it, or a URI that comes back hands Skia a freed image ("Cannot pass deleted object as a pointer of type Image const*" on web). Anything that keeps an image past its holder (an `SkPicture`) must be cached by the decoded image.
- A backdrop filter reads only the layer it's drawn in: inside a `Group layer`, a `Mask`, or anything else that saves a layer, it blurs nothing. The same goes for a blend mode, which blends onto that layer alone. Keep document layers drawn straight onto the canvas. A filter's sigma is mapped through the canvas transform, so document-unit blurs look the same at any zoom.
- Skia's web build throws for runtime-shader, matrix-transform, tile, and picture image filters. Build effects from blur, displacement map, shader, offset, and morphology filters. A displacement map samples nearest-neighbor from 8-bit offsets, and its shader draws in the canvas's color space: on a P3 canvas a red or green offset bleeds into other channels, and only gray passes unchanged.
- On iOS a `Canvas` defaults to Display P3, while offscreen renders and web are sRGB: a canvas that previews the document sets `colorSpace="srgb"`. A `ColorMatrix`'s last column is in 0–1 units, not 0–255.
- CanvasKit's `readPixels` returns null for `Gray_8` from a GPU surface: read `RGBA_8888` and keep one channel. `Skia.Image.MakeImage` with `Gray_8` does work on web.
- On web each `drawAsImage` makes its own WebGL context, and the browser drops the oldest: draw offscreen with `drawOffscreen` (`render/drawOffscreen.ts`). Don't give a Skia canvas that must keep up with quick changes a large `SkImage` something else will dispose.
- Give `beginRecording` explicit bounds: on web it defaults to a rect from (0, 0), culling anything left of or above the origin.
- A `Group`'s `opacity` doesn't fade a paragraph: fade through a layer, `<Group layer={<Paint opacity={…} />}>`.
- Skia paragraphs on web throw without a font provider: build every paragraph with `getFontProvider()` from `render/fonts.ts`.
- `getRectsForRange` gives an empty or whitespace-only line no box, so caret geometry measures a copy with a filler on each empty line (`caretText` in `model/textEditing.ts`).
- On web, Skia can drop redraws asked for while its surface is being set up, so a scene driven only by shared values can stay blank. Mount the drawing once the view has a size, as `EditorCanvas` and `CropCanvas` do.
- On web, Skia binds to CanvasKit when its module is first evaluated, so anything importing Skia before CanvasKit loads gets a dead API that throws only when called. Keep `index.web.ts`'s load order.

### Web and React Native Web

- The static export renders without hydration: server HTML differs from the client's (palette, icon font), so anything that differs between them is safe to render.
- `vercel.json`'s CSP allows only the site itself. Anything new the app loads or connects to, or a new inline script, needs it changed (`build:web` checks inline script hashes). Don't widen `connect-src`: it blocks MediaPipe's telemetry.
- A new dynamic route needs a rewrite in `vercel.json`, naming the page without `.html` (`/projects/[id]`), and a moved route needs a redirect there.
- The service worker's caches hold unhashed files in each version, so look in `CURRENT` before other versions (`caches.match` alone returns the oldest). To remove the worker, deploy a `sw.js` that unregisters itself; deleting the file leaves it running.
- Metro prefers a platform file only over one with the same extension (`.web.ts`, `.ts`, `.web.tsx`, `.tsx` in turn), so `foo.ts` silently beats `foo.web.tsx`: give both the same extension. A `.web` file can import only types from its counterpart, since the path resolves back to itself.
- React Native defines `window` on native too, without `addEventListener`: guard browser-only code with `Platform.OS === "web"`, not `typeof window`.
- React Native Web's `Alert.alert` and `AccessibilityInfo.announceForAccessibility` are no-ops: use `showAlert` and `Announcement` from `ui/`.
- React Native Web ignores `accessibilityState.expanded`, `checked`, and `selected`: also set `aria-expanded`, `aria-checked`, or `aria-selected`. It doesn't pass `inert` through either: set it on the element from a ref (on iOS, use `accessibilityViewIsModal`).
- `Pressable` fires `onPress` from the DOM `click`, which bubbles from any child, including a `TextInput`. Don't wrap an input in a tap-to-dismiss `Pressable`: put an `absoluteFill` `Pressable` behind it as a sibling and give the input `position: "relative"`.
- `Pressable` passes `hovered` to its `style` and `children` callbacks on web: read it with `interaction()` (`ui/interaction.ts`) and ease it with `webTransition`. For hover over a group, use `onPointerEnter`/`onPointerLeave` on a wrapper and count only `pointerType === "mouse"`.
- `Link asChild` hands its child a merged `style` array, so a `Pressable`'s style function never runs: style a view inside from the children callback.
- Reanimated renders an `Animated.View`'s style inline, which drops `pointerEvents: "box-none"`: put `box-none` on a plain `View` around it, keep that mounted, and toggle the animated child.
- A Reanimated `entering` animation inside a parent that's animating in (a `BottomSheet`) can land misplaced. For a small appear animation, drive a shared value from a mount effect (`ui/Highlight.tsx`).
- A `BottomSheet` whose content is taller than its slot shrinks and fights its slide-in: size the content to fit in JavaScript.
- A closing screen opened again before navigation lets go can come back with its state after its effects were cleaned up. Don't trust state a cleanup freed until effects run again (`useRenderedDocument`).
- On web React focuses an `autoFocus` element while its events are off, so `onFocus` never runs: focus from a mount effect instead. The `TextInput` ref is the DOM `<textarea>` (`setSelectionRange`, not `setSelection`). On iOS, `selectTextOnFocus` ignores `autoFocus`: select in `onFocus` with `ref.setSelection(0, length)`.
- Web-only CSS values (`cursor: "nwse-resize"`) need an `as unknown as ViewStyle` cast, inside a `Platform.OS === "web"` branch. A later style's `undefined` doesn't clear an earlier value: leave the key off.
- For a gradient behind a view, use `gradientBackground` (`ui/gradient.ts`). Fade to a color at zero alpha, not `transparent`, which passes through gray.
- A vertical `ScrollView`'s `onLayout` width includes its scrollbar on web: measure a `View` inside it.
- React Native Web's `Image` `onLoad` has no `nativeEvent.source`: read sizes with `Image.getSize`.
- `ui/Popover` stops Escape in the window's capture phase; another window listener still runs and must honor `defaultPrevented`. Its `restoreFocus` runs from the unmount cleanup through a ref, since an effect listing the callback re-runs on each new identity.
- `Children.toArray` doesn't enter a component, and an `onLayout` x is relative to the parent, not the scrolled viewport (both matter in `FadeRow`).
- React Native Web runs `onLayout` from a `ResizeObserver`, so it fires when a view changes size, not when it only moves. To measure again a view that a sibling pushed along, remount it (a `key`).

### Gestures and worklets

- A `Pan` with `minDistance(0)` activates at touch-down on web but only on movement on iOS, so a tap never reaches `onEnd` there. Commit from `onFinalize`, and cancel on a second finger yourself (`numberOfPointers`, `onTouchesDown`) rather than with `maxPointers`.
- `Gesture.Simultaneous` doesn't carry its relations into a nested `Simultaneous`: those gestures race silently. Add them at the top level as leaves (`Gesture.Simultaneous(composed, ...other.toGestureArray())`).
- The worklets plugin turns a `"worklet"` function declaration into a constant, so it isn't hoisted: declare helpers above the worklets that use them, or the module throws as it loads.
- A worklet can only call worklets: a new helper called from UI-thread geometry needs the `"worklet"` directive too.
- `scheduleOnUI` on web runs a frame later, while a JS write to a shared value lands at once: call the worklet directly on web where that matters (`syncLiveTransform`). On native, a worklet that must read and write shared values atomically belongs in `scheduleOnUI`.

### Tooling

- Projects in the simulators, the emulator, and the local web app are test data: edit them freely while checking a change, and don't restore or report them.
- Biome's `noRestrictedImports` matches an import's text, not its resolved file, and reads a `group` like `.gitignore` (the last matching pattern wins). A relative ban needs a pattern per depth, and a negation like `!../../../**` allows everything under it. Only the last matching override in `biome.json` applies to a file, so each repeats the bans it needs.

## Conventions

- Keep imports flowing one way (`app` → `screens` → `editor` → `photos` / `projects` / `render` → `model`, with `ui/` and `platform/` beneath); `biome.json` enforces it, and docs/architecture.md lists the rules. Update both when the structure changes.
- Only routes go in `src/app/`; screens live in `src/screens/` and don't import each other. `model/` stays plain TypeScript (no React, React Native, or Skia), and `render/` never reads the editor's store.
- Take colors from `colors` in `ui/theme.ts`, never literals that assume one palette (day or night is picked at launch and never switches while running). Draw over the photo in `colors.selection`; fade to a palette color with `fadeTo`.
- Take text sizes and weights from `typography`, corners from `radii`, and gaps from `space`; a one-off gap off the scale may stay literal. Literal font sizes only for Anton display text, font previews, and the text editor's 16px hidden input. Circles keep half their size as a radius.
- Name component files in PascalCase, other modules in camelCase. Prefer growing an existing file over adding a single-use one; split a file when it gains a second responsibility.
- A doc comment longer than a short paragraph is a sentence on what it is, then a short list, one line per behavior or parameter.
- Name the editor document `document`, not `doc`. The DOM lib's global `document` means a missing parameter still type-checks.
- Tests live in `__tests__/` beside what they test, start with `/// <reference types="node" />` (TypeScript 6 no longer includes `@types` packages by default), and import with an explicit `.ts` extension (Node's type stripping needs it). A tested module imports its dependencies by relative `.ts` path and nothing React-based (store slices import only types from `zustand`; tests use `createStore` from `zustand/vanilla`).
- A tool's hook (`useController`) runs in `Editor`'s body, above the `EditorContext` provider, so it can't read the context: give it what it needs through `ToolEnv`, the store, or a shared preference. Only a tool's views read `editorContext.ts`.
- Outside `src/editor/`, import the editor only from `@/editor`. Inside it, nothing but `builtInSpecs.ts` and `builtInTools.ts` imports a tool, and tools don't import each other.
- Renaming or retyping something a `docs/interactive` lesson covers, or changing `render/`'s imports, can break that build: update the lesson in the same change.

## Git Commits

- Use Conventional Commits format for commit messages, such as `feat: add text editing` or `fix: handle invalid image input`.

## Code Checks

- After code changes, run `npm run check` (formatting and lint; `npm run format` fixes), `npm run typecheck`, and `npm test` when touching `model/`, store slices, or other pure modules (it covers `modules/` too). Run `npm run build:web` after changing `.web` files, the entry files, or imports TypeScript doesn't check (assets, untyped imports): Metro catches an import that won't resolve. CI runs all four.
