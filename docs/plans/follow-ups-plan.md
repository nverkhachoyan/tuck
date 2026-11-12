# Follow-ups

Everything still open from finished plans, gathered October 29, 2026 and brought up to date November 6. Each section stands alone, so they can go in any order. Finished plans are removed once built; what building them found lives in git history (the last ones as of `281f08e`: Cut and Remove BG, the dependency upgrade, the editor's layer folders, and the text input package; then, after `1c2b056`, the editor UI redesign, the Gesture Handler 3 migration, the performance plan, and the UI/UX brainstorm that led to the redesign; then, as of `ab78080`, the drawing-layers plan, `docs/plans/drawing-layers/`, and the brainstorm it came from, `docs/brainstorming/drawing-layers/`, built in PRs #85 to #94).

Open work that has its own issue is linked rather than described here. As other entries become issues, replace them with a link.

## 1. Checks only a device can make

The refactors from October 24 to 29 were checked on web at 390, 1024, and 1440 points wide, and some on the iPhone simulator. These weren't.

* **Every canvas tool kind.** In the web editor at 390 and 1440 points wide, and on the iOS simulator: a pen and a highlighter stroke (a highlight joins only a highlight mark), an Eraser and a Stroke eraser swipe; a dragged rectangle and arrow, a tap that selects a shape, and a drag that moves the selected one; a Redact box, a brushed redaction that joins the selected one, and a tap that selects a box; a Cut brush stroke and a Tap; the eyedropper from Pen's color, from text's color while typing (the text keeps drawing), and from Find's redaction style (the found regions hide while it picks); a Find region chosen and unchosen, and a tap off the image that puts Find down; a sideways drag in Adjust; and a tap off the document while painting that puts the tool down.
* **The editor on iPhone and iPad.** On the iOS simulator and the iPad Pro 13-inch simulator: open every tool and Done it, and Cancel the four that have ✕ (Crop, Cut, Find, Adjust; Crop's Cancel leaves no undo step, its Done leaves one; Stickers opens as a sheet on iPhone and a popover on iPad); type text and tap the canvas while typing (the caret moves and the keyboard stays); double-tap a text layer; run Find, choose and unchoose a region, and step through Review; drag sideways on the photo in Adjust; draw a stroke; crop.
* **iPad specifics.** The context bar's chips and popovers by touch, Dynamic Type at larger sizes, and 1133 and 1180-point windows, on the iPad mini too. Crop's header controls and the sticker popover's long-press delete by hand. Since Expo 58 the iPad window can be resized: check the editor at narrow window sizes.
* **The phone's trays.** The bar's chips share `SizeChoices` and `ColorChip` with the phone's trays. Look at each tray on the iPhone simulator for anything that moved.
* **Find on native.** Vision and ML Kit find different faces than MediaPipe. Run Find on the Solvay photo on the iOS simulator and the Android emulator, and check that the tray's words ("28 found", "26 of 28 chosen", "No faces found") fit what they find.
* **After Expo 58, still unchecked:** the share extension, saving to Photos, the web app offline after a cold load with the service worker cleared, and renders of a project with every layer kind compared against Expo 57 screenshots (Skia 2.11 changed how `Mask`s composite and antialiasing defaults).
* **After Skia 3:** React Native Skia 3.9.0 shipped in `1c2b056` ([#18](https://github.com/nverkhachoyan/tuck/issues/18), closed). Deferred until there's an Android phone: a Release build on it, a long iOS editing session on a phone watching memory, live strokes and pinches on a large photo, and checking Play Console's device catalog for who minSdk 26 / Vulkan 1.1 drops.
* **Drawing and erasing:** the Eraser's swath and its announcement, [#84](https://github.com/nverkhachoyan/tuck/issues/84); 200 marks in an iPhone Release build, [#95](https://github.com/nverkhachoyan/tuck/issues/95); tuning how strokes group into marks, [#96](https://github.com/nverkhachoyan/tuck/issues/96); the Stroke eraser's haptic tick and dimming, [#97](https://github.com/nverkhachoyan/tuck/issues/97); Separate's bar, the mark rows' memory, and their names read aloud, [#98](https://github.com/nverkhachoyan/tuck/issues/98). Not in an issue: whether Erase on a mark, which dims everything else to a third, reads as "out of reach" over a busy photo in daylight.
* **Performance on a phone:** redaction filters and export encoding, [#46](https://github.com/nverkhachoyan/tuck/issues/46), and the rest of the preview/export split, [#40](https://github.com/nverkhachoyan/tuck/issues/40).
* **Screen readers.** The iOS Simulator has no VoiceOver, so these wait for a device. With VoiceOver on an iPhone, check Find's Review row as one adjustable control, and swipe through the export sheet to check that it never reaches the editor behind it. Do the same with TalkBack on an Android phone.

## 2. Bugs to look into

* None open. [#79](https://github.com/nverkhachoyan/tuck/issues/79), the memory each closed project left behind, was a cycle in worklets' serialization cache, patched in `patches/react-native-worklets@0.13.0.patch`.

## 3. Smart selection

Cut's Subject, Tap (MobileSAM on every platform, by a tap or a box), Paint in and Paint out, Invert, and its Apply actions, Adjust included, are built; a box on a phone is [#131](https://github.com/nverkhachoyan/tuck/issues/131). What's open:

* **App size.** The models add 44 MB to each app, and ONNX Runtime 34 MB to Android's (its arm64 library, before the store compresses it). iOS's Release size isn't measured. An int8 encoder might bring the models to about 12 MB, if the masks hold up. On-demand resources and Play Asset Delivery could fetch them the first time Tap is used.
* **Android on a phone.** Only the emulator has run Tap: about 2 seconds to read a photo, and taps from 0.15 seconds back to back to over a second spaced out. If a phone is slow, look at ONNX Runtime's NNAPI or QNN providers, or LiteRT on the GPU.
* **The first Tap after launch on iOS** takes about 3 seconds while Core ML loads the model, against a quarter of a second after that.
* **WebAssembly threads.** Where WebGPU isn't available, web encodes on one thread in about 3 seconds. Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `vercel.json`) would allow threads, likely about 1 second. Check the share target and file handlers first.
* **Tap without Vision or ML Kit.** Segment Anything needs neither, so Tap could show on iOS 16 and on Android without Play services, where Cut offers only the brushes.
* **Edges.** A guided filter didn't beat today's masks on fur (docs/on-device-detection.md, "Sharper edges"); decoding again on a crop for small objects is [#132](https://github.com/nverkhachoyan/tuck/issues/132).
* **Memory in browsers.** Not measured with MobileSAM alone in its worker. With all three models loaded, the page held about 130 MB of JavaScript heap.
* **Remove an object.** Researched in [docs/object-removal.md](../object-removal.md); what it waits on is [#134](https://github.com/nverkhachoyan/tuck/issues/134).

## 4. Later

Not yet planned. Weigh each on its own before starting one.

* **Labelled arrows** for marking up screenshots, editing their label in place with `@tuck/skia-text-input` and Text's tool slots (`draft`, `edit.owns`, `views.Input`). The label sits along the arrow, not in a box, so it's the test that `createCaretLayout` and the slots don't assume a text layer; if they don't fit, change them with both tools on them.
* **Preview photos.** Editing draws a display preview of each photo at up to 4,096 pixels on its long side (`PREVIEW_LONG_SIDE`, [#40](https://github.com/nverkhachoyan/tuck/issues/40)), about 45 MB per 24MP layer, and export decodes the stored file at full size. A 2,048-pixel preview would cut editing by four again, but isn't needed yet. Measured November 2 at `a8e04d5`, with five 6000×4000 photos opened, added to, and exported three times over: a Release build on a 4 GB Android emulator peaked at 1.1 GB, kept at least 1.3 GB free, and saw no low-memory kill; in Chrome, what grew was WebGL contexts left alive after each export and CanvasKit's heap keeping the export's peak, fixed in [#60](https://github.com/nverkhachoyan/tuck/issues/60) and [#74](https://github.com/nverkhachoyan/tuck/issues/74). [#39](https://github.com/nverkhachoyan/tuck/issues/39) found memory levels off on an iPhone 17 Pro Max. Still to do: the same on a 4–6 GB iPhone (the Dev HUD's footprint, docs/development.md). Only if one runs out or comes close, prototype the smaller preview with the full photo swapped in past its zoom, since a soft preview over small text would mislead a redaction. The full table and how it was measured are in git history as of `26e43ef`.
* **A Select tool** that picks layers and objects by finger or cursor (the name was kept free for it). With several marks selected it's where Merge goes, for marks a pause split apart (today: select the mark and draw into it), and it could select strokes across marks to move or separate them.
* **Find and Redact together.** When Find finds nothing, or misses one face or plate, it says "Draw a box over it with Redact instead", and the user has to finish Find and open Redact. Offer Redact from Find's tray instead, and consider opening Find already scanning its last scope. From the UI/UX brainstorm the editor redesign came from (in git history as of `1c2b056`, `docs/brainstorm/`).
* **Layer row polish**, from the same brainstorm: a Duplicate action in `LayerRow` (it's only in the selection bar and ⌘D now), and the Layers toggle staying reachable on wide windows under 960 points tall while a tool is open.
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
* From the drawing-layers brainstorm: real (container) layer groups, a single ink sheet for all drawing, and cutting strokes where the Eraser crosses them, which would change how erased ink looks. So Separate splits a mark only by whole strokes, and a stroke erased through its middle stays one stroke.
* Disabling the Eraser when there's nothing to erase: it stays enabled, with a ring on web and no swath over empty canvas.
