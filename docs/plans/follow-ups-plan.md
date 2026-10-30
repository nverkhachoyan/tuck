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
