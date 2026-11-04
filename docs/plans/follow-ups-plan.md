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

* [#19: A rail click right after a header ✓ or ✕ is lost](https://github.com/nverkhachoyan/tuck/issues/19)
* [#20: A photo dropped just after a reload lands off the canvas](https://github.com/nverkhachoyan/tuck/issues/20)
* [#21: iOS shows selection handles at the hidden text input](https://github.com/nverkhachoyan/tuck/issues/21)

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

* [#18: Upgrade to React Native Skia 3](https://github.com/nverkhachoyan/tuck/issues/18) (unblocked upstream by [wcandillon/react-native-skia#4367](https://github.com/wcandillon/react-native-skia/pull/4367), closing [wcandillon/react-native-skia#4355](https://github.com/wcandillon/react-native-skia/issues/4355))
* [#22: Migrate gestures to Gesture Handler 3's hooks API](https://github.com/nverkhachoyan/tuck/issues/22)

## 5. Later

Not yet planned. Weigh each on its own before starting one.

* **Labelled arrows** for marking up screenshots, editing their label in place with `@tuck/skia-text-input` and Text's tool slots (`draft`, `edit.owns`, `views.Input`). The label sits along the arrow, not in a box, so it's the test that `createCaretLayout` and the slots don't assume a text layer; if they don't fit, change them with both tools on them.
* **Preview photos.** Editing draws a display preview of each photo at up to 4,096 pixels on its long side (`PREVIEW_LONG_SIDE`, [#40](https://github.com/nverkhachoyan/tuck/issues/40)), about 45 MB per 24MP layer, and export decodes the stored file at full size. A 2,048-pixel preview would cut editing by four again. [#39](https://github.com/nverkhachoyan/tuck/issues/39) measured three 24MP photos on an iPhone 17 Pro Max: memory levels off, and export is the highest point. The open question was whether a 4–6 GB iPhone, a mid-range Android phone, or a Chrome tab runs out or comes close with one, three, and five photos then an export. Only if one does, prototype the smaller preview with the full photo swapped in past its zoom, since a soft preview over small text would mislead a redaction.

  Measured 2026-11-02 at `a8e04d5` (previews at 4,096 pixels) with five 6000×4000 noisy JPEGs (about 10 MB each): open one, add a pen stroke, add photos to three then five layers, export at full size as JPEG, back to the projects; three passes. Numbers are MB, read about 25 seconds after each step settled; a range is a reading 8 seconds after the step, then the settled one.

  | Step | Android: app PSS (native heap) | Android: emulator GPU | Chrome: renderer PSS | Chrome: GPU memory |
  | --- | --- | --- | --- | --- |
  | Launch, home | 115 (22) | 770 | 577 | 329 |
  | Pass 1: 1 photo | 281 → 146 (52) | 836 | 622 | 586 |
  | 3 photos | 179 (81) | 1,000 | 623 | 776 |
  | 5 photos | 342 (240) | 1,281 → 995 | 703 | 907 |
  | Export | 364 (249) | 1,225 | 1,210 | 1,038 |
  | Home | 385 (281) | 1,288 | 1,319 | 1,011 |
  | Pass 2: 1 photo | 545 (431) | 1,200 | 1,361 | 1,202 |
  | 3 photos | 933 → 837 (729) | 1,625 → 1,371 | 1,334 | 1,448 |
  | 5 photos | 964 → 427 (322) | 1,637 | 1,333 | 1,571 |
  | Export | 440 (313) | 1,247 | 1,225 | 1,705 |
  | Home | 419 (293) | 1,238 | 1,336 | 1,680 |
  | Pass 3: 1 photo | 545 (439) | | 536 * | 390 * |
  | 3 photos | 830 (740) | | 600 * | 592 * |
  | 5 photos | 1,128 (1,036) | | 718 * | 679 * |
  | Export | 377 (276) | | 1,314 * | 844 * |

  * **Android:** a Release build on a 4 GB Pixel-sized AVD (Android 36.1, Google Play image), memory from `dumpsys meminfo`. The emulator reports no Graphics row (gfxstream keeps GPU memory on the host), so "emulator GPU" is the qemu process's VRAM and GTT on the host, which includes the emulator's own surfaces. No low-memory kill or trim reached the app; the device kept at least 1.3 GB available (of 3.9 GB), at the 1.1 GB peak in pass 3. Opening or adding each photo took about 3 seconds, and saving the 6000×4000 export about 3 seconds. Native heap swings by hundreds of MB and falls back after collection, and the app settles near 400 MB between passes (385, 419) instead of the 115 it launched at: a cache, not a leak. The emulator itself crashed once in its GL translator (a host segfault, not the app) and the pass was rerun.
  * **Chrome:** the production web export in Chromium 154 on Linux, 1440×900, ANGLE on OpenGL on an AMD Radeon 890M (integrated, shared memory); renderer PSS from `/proc`, GPU memory as the GPU process's VRAM and GTT from `fdinfo`. JS heap stayed between 13 and 25 MB. Passes 1 and 2 ran in one tab; * marks pass 3, after a reload. The first export adds about 500 MB to the renderer, which stays until the tab reloads, and GPU memory back at the projects grew from 1.0 to 1.7 GB across two passes without levelling off (still 1.67 GB after a minute idle). Headless Chromium couldn't draw the Skia canvas on this machine, so this ran in a desktop window over CDP. The test blocked downloads, so the export's timing isn't recorded.
  * **iOS:** not measured here. #39's iPhone 17 Pro Max has a Jetsam limit of about 3.4 GB; a 4–6 GB iPhone with five photos still needs the real phone (the Dev HUD's footprint, see docs/development.md).

  Verdict: nothing ran out on Android at 4 GB or in Chrome, and the decoded photos alone don't come close; what does is Chrome holding GPU memory and the export's buffers across projects in one tab, which on an 8 GB laptop with an integrated GPU would. The smaller preview isn't needed yet. The GPU memory was offscreen WebGL contexts left alive after each export, fixed in [#60](https://github.com/nverkhachoyan/tuck/issues/60); the renderer's share is CanvasKit's WASM heap keeping the export's peak ([#74](https://github.com/nverkhachoyan/tuck/issues/74)). Still to do: measure a 4–6 GB iPhone.
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
