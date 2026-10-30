# Follow-ups

Everything still open from finished plans, gathered October 29, 2026. Each section stands alone, so they can go in any order. Finished plans are removed once built; what building them found lives in git history (the last ones as of `281f08e`: Cut and Remove BG, the dependency upgrade, the editor's layer folders, and the text input package).

Cut and Remove BG's open items are issues: [#13](https://github.com/nverkhachoyan/tuck/issues/13), [#14](https://github.com/nverkhachoyan/tuck/issues/14), [#15](https://github.com/nverkhachoyan/tuck/issues/15), [#16](https://github.com/nverkhachoyan/tuck/issues/16), and [#17](https://github.com/nverkhachoyan/tuck/issues/17). As other entries here become issues, replace them with a link.

## 1. Checks only a device can make

The refactors from October 24 to 29 were checked on web at 390, 1024, and 1440 points wide, and some on the iPhone simulator. These weren't.

* **Every canvas tool kind.** In the web editor at 390 and 1440 points wide, and on the iOS simulator: a pen, highlighter (it joins only a highlighter layer), and eraser stroke; a dragged rectangle and arrow, a tap that selects a shape, and a drag that moves the selected one; a Redact box, a brushed redaction that joins the selected one, and a tap that selects a box; a Cut brush stroke and a Tap; the eyedropper from Draw's color, from text's color while typing (the text keeps drawing), and from Find's redaction style (the found regions hide while it picks); a Find region chosen and unchosen, and a tap off the image that puts Find down; a sideways drag in Adjust; and a tap off the document while painting that puts the tool down.
* **The editor on iPhone and iPad.** On the iOS simulator and the iPad Pro 13-inch simulator: open every tool, then Cancel and Done it (Crop: Cancel leaves no undo step, Done leaves one; Stickers opens as a sheet on iPhone and a popover on iPad); type text and tap the canvas while typing (the caret moves and the keyboard stays); double-tap a text layer; run Find, choose and unchoose a region, and step through Review; drag sideways on the photo in Adjust; draw a stroke; crop.
* **iPad specifics.** The context bar's chips and popovers by touch, Dynamic Type at larger sizes, and 1133 and 1180-point windows, on the iPad mini too. Crop's header controls and the sticker popover's long-press delete by hand. Since Expo 58 the iPad window can be resized: check the editor at narrow window sizes.
* **The phone's trays.** The bar's chips share `SizeChoices`, `ColorChip`, and `AlignPicker` with the phone's trays. Look at each tray on the iPhone simulator for anything that moved.
* **Find on native.** Vision and ML Kit find different faces than MediaPipe. Run Find on the Solvay photo on the iOS simulator and the Android emulator, and check that the tray's words ("28 found", "26 of 28 chosen", "No faces found") fit what they find.
* **After Expo 58, still unchecked:** the share extension, saving to Photos, the web app offline after a cold load with the service worker cleared, and renders of a project with every layer kind compared against Expo 57 screenshots (Skia 2.11 changed how `Mask`s composite and antialiasing defaults).
* **Screen readers.** The iOS Simulator has no VoiceOver, so these wait for a device. With VoiceOver on an iPhone, check Find's Review row as one adjustable control, and swipe through the export sheet to check that it never reaches the editor behind it. Do the same with TalkBack on an Android phone.

## 2. Bugs to look into

### A rail click right after a header ✓ or ✕ is lost

Seen in the browser pane on a wide window, on `main` too.

* **Steps:** open a tool (Find, or Cut), press ✕ or ✓ in the header, then at once click a tool in the rail (Find).
* **Seen:** the editor goes back to idle and the rail's tool doesn't open. A second click on it opens it.
* **Unknown:** the pane was hidden, so its page ran about two frames a second (see docs/development.md), and the lost click may be that alone. Try it in headless Chrome at 60 frames a second, and by hand in a browser, before looking at the code. If it holds there, look at what the header's ✓ and ✕ leave behind as the context bar gives way to the title (a hover or pointer state, or a press that the rail's `Pressable` sees as its own).

### A photo dropped just after a reload lands off the canvas

* **Steps:** reload the editor on a project, and drop a photo onto the canvas within a few seconds, before the canvas has drawn.
* **Seen:** the photo joins the layers and is selected, but sits outside the document: the canvas doesn't show it, and Find on it says "Nothing in the visible crop". The same drop a few seconds later lands in the middle of the view.
* **Unknown:** the drop was a synthetic `DragEvent`, so check with a real drag too. The likely cause is `useAddImage`'s `onImage` in `Editor.tsx`, which places the image in `canvasRef.current?.visibleArea()`: before the canvas has its size or its view, that area may be empty or at the wrong place, rather than undefined (which would place it in the middle).

### iOS shows selection handles at the hidden text input

While text is selected on iOS, the system's selection handles show at `HiddenTextInput`, behind the header's top left.

## 3. Smart selection

Cut's Subject, Tap (MobileSAM on every platform), Add and Subtract, Invert, and its Apply actions are built. What's open:

* **App size.** The models add 44 MB to each app, and ONNX Runtime 34 MB to Android's (its arm64 library, before the store compresses it). iOS's Release size isn't measured. An int8 encoder might bring the models to about 12 MB, if the masks hold up. On-demand resources and Play Asset Delivery could fetch them the first time Tap is used.
* **Android on a phone.** Only the emulator has run Tap: about 2 seconds to read a photo, and taps from 0.15 seconds back to back to over a second spaced out. If a phone is slow, look at ONNX Runtime's NNAPI or QNN providers, or LiteRT on the GPU.
* **The first Tap after launch on iOS** takes about 3 seconds while Core ML loads the model, against a quarter of a second after that.
* **WebAssembly threads.** Where WebGPU isn't available, web encodes on one thread in about 3 seconds. Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `vercel.json`) would allow threads, likely about 1 second. Check the share target and file handlers first.
* **Tap without Vision or ML Kit.** Segment Anything needs neither, so Tap could show on iOS 16 and on Android without Play services, where Cut offers only the brushes.
* **Edges.** SAM's masks come out at 256×256 and are scaled up, so hair and fur come out soft and blocky. Refine the mask against the photo (a guided filter), or run the decoder again on a crop around the object.
* **A drag for a box**, which `strokeIntent` already tells from a tap. It's a new `CanvasTool` kind: its union member and `ToolStroke` member, its row in `CANVAS_TOOLS` (`canvas/canvasTool.ts`), its builder in `cutSettings.ts`, its case in `useCanvasInput`'s `finishStroke`, and its live drawing in `LiveStrokeOverlay`.
* **Memory in browsers.** Not measured with MobileSAM alone in its worker. With all three models loaded, the page held about 130 MB of JavaScript heap.
* **Adjust only the selection.**
* **Remove an object.** Fill the hole Remove leaves with an inpainting model: MI-GAN (MIT, made for phones, about 30 MB) or LaMa (Apache 2.0, about 200 MB). It's the biggest piece here, so research it first.

## 4. Upgrades waiting

### React Native Skia 3

**Blocked on [wcandillon/react-native-skia#4355](https://github.com/wcandillon/react-native-skia/issues/4355):** Skia 3 removed `Canvas`'s `colorSpace` prop, and the canvas renders in Display P3 on wide-gamut Apple displays. The editor sets `colorSpace="srgb"` on `EditorCanvas`, `CropCanvas`, and the docs' `SkiaStage` so the preview draws as the export does. Stay on an exact `react-native-skia` 2.x pin until that issue gives a way back.

Tested October 28, 2026 on 3.8.1, against 2.6.2 and an offscreen render (the export's path), on the iPhone 17 Pro simulator and an iPhone 17 Pro Max. Values are sRGB:

| Operation | Offscreen (export) | 2.x, `srgb` canvas | 2.x, P3 canvas | 3.8.1 canvas |
| --- | --- | --- | --- | --- |
| `rgb(255,0,0)` fill | 255, 0, 0 | 255, 0, 0 | 255, 0, 0 | 255, 0, 0 |
| Red through a `ColorMatrix` that averages R and G | 128 gray | 128 | 143 | 128 |
| Displacement map from an `rgb(128,0,0)` shader, scale 200 | no shift | no shift | 8.3 pt | 8.3 pt |
| Highlighter yellow `rgb(255,221,0)` multiplied over `rgb(0,160,255)` | 0, 139, 0 | 0, 139, 0 | 34, 140, 64 | 34, 140, 64 |
| Middle of a 12-point blur across a red and blue edge | 124, 0, 132 | 125, 0, 130 | 125, 10, 147 | 126, 10, 147 |

So on 3.x the highlighter previews visibly greener over saturated colors than it exports, and blurs drift at saturated edges. Color filters and pixelate are unaffected, and exported files stay right. Other ways forward, if upstream says no: preview the document as an sRGB offscreen image (a frame of latency, memory on large photos, and live strokes on an overlay), or accept the mismatch, which breaks "what you see is what you export". Rebuild the test as a throwaway route drawing the table's five operations as swatches, and rerun it on each Skia 3 release that touches color spaces.

Once unblocked:
* Decide on Android's new floor: Vulkan 1.1 and API 26 (`minSdkVersion` through `expo-build-properties`). Google Play hides the app from phones without Vulkan. Check Play Console's device catalog for how many that is.
* Renames: `Skia.Image.MakeImage` → `MakeRaster` (`cutMask.tsx`), `makeNonTextureImage()` → `makeRasterImageSync()`, which throws instead of returning null (`drawOffscreen.web.ts`). `readPixels` on a GPU image blocks; check `photoImport.ts`, `cutMask.tsx`, and `renderDocument.tsx`.
* Rendering moves off the UI thread (a scene records once per commit and replays on a thread pool), and surfaces share one WebGL context on web. Recheck the AGENTS.md learnings on image lifetimes, `SkPicture`s outliving their holder, `drawOffscreen`, and `readPixels`, and drop whichever no longer hold.
* Minor versions have renamed and removed APIs; read each release's notes before a bump.
* Verify with a Release build on a real Android phone, a long editing session on iOS watching memory, and live strokes and pinches on a large photo.

### Gesture Handler's hooks API

Gesture Handler 3 deprecates the `Gesture.*` builders for hooks (`usePanGesture`, `useSimultaneousGestures`). Software Mansion publishes a migration skill (`gesture-handler-3-migration`).
* Callbacks are renamed (`onStart` → `onActivate`, `onEnd` → `onDeactivate`, `success` → `canceled`, inverted), and relations too (`blocksExternalGesture` → `block`).
* Hook and builder gestures can't relate to each other, so the canvas's composed gestures (`useViewGesture`, `useLayerTransformGesture`, `usePaintGesture`, `useEditTextGesture`, `useCropGesture`) move in one change. `Dial`, `ColorPicker`, `BottomSheet`, and `LayerRow` (which keeps `LegacyScrollView` until then) can go one at a time.
* Hooks run in a component's body: check that fits how tool hooks build gestures through `ToolEnv`.
* Recheck the AGENTS.md learnings on `Gesture.Simultaneous` nesting and `minDistance(0)` Pans.

## 5. Later

Not yet planned. Weigh each on its own before starting one.

* **Labelled arrows** for marking up screenshots, editing their label in place with `@tuck/skia-text-input` and Text's tool slots (`draft`, `edit.owns`, `views.Input`). The label sits along the arrow, not in a box, so it's the test that `createCaretLayout` and the slots don't assume a text layer; if they don't fit, change them with both tools on them.
* **Preview photos.** Every render decodes a photo at up to 25 million pixels (`MAX_PHOTO_PIXELS`): about 98 MB on the GPU for a 24MP photo, per layer, while a phone canvas shows about 1,300 pixels across. Editing on a 2,048-pixel copy and keeping the full photo for export, the eyedropper, and Cut's renders would cut that by eight. Measure first: one, three, and five 24MP photos then an export, on a 4–6 GB iPhone, a mid-range Android phone, and a Chrome tab. Only if one runs out or comes close, prototype swapping in the full photo past the preview's zoom, since a soft preview over small text would mislead a redaction.
* **A Select tool** that picks layers and objects by finger or cursor (the name was kept free for it).
* **Publishing `@tuck/skia-text-input`**, once someone asks or Tuck isn't its only user and the API has held still. Remove `"private": true`, create the `tuck` npm organization (or rename), and `pnpm --dir packages/skia-text-input publish --access public`; `prepack` builds `lib/`. Not built until needed: right-to-left text, input method composition on the canvas, grapheme-aware word selection, up and down arrows by wrapped line, touch drag handles and the edit menu, and a screen reader reading the drawn text.
* **Each layer type's bounds in its own folder**, if `canvas/layerBounds.ts`'s switch grows.
* More adjustments: highlights, shadows, exposure, vignette, and sharpen, one at a time, only where they feel as good as the four there are.
* PDF redaction, researched in [docs/pdf-redaction.md](../pdf-redaction.md): flatten each page to an image, redact it in the editor, and write a new PDF.
* Blurring license plates automatically, as Find does faces.
* Redacting several photos at once.
* Collages.
* Better HEIC and RAW import.
* Packages, once something outside this repo needs a part on its own. Then one `packages/editor` with subpath exports (`@tuck/editor`, `/render`, `/core`), starting with a spike: Metro resolving `.web.ts` through `exports`, tsc, Biome, Vite, the Node tests, and Expo autolinking `modules/image-analysis` once it has a `package.json`. The full plan is in git history as of `aaed202` (`docs/plans/composition-plan.md`).

## Considered and left

Weighed in removed plans and set aside. Don't add them unless use shows they're missed.

* Snapping highlights to lines of text, and straightening for every pen, not only the highlighter.
* Pinch to zoom in the export preview.
* One props type for a tool's panel, bar, and tray, and splitting `FindPanel.tsx`'s views.
* A done state for Share, since the share sheet can't say whether anything was sent.
