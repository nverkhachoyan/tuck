# Follow-ups

What's left from the plans in `docs/plans/`, gathered October 26, 2026, when the finished plans were removed. Every step those plans listed has landed. What remains is checks only a device can make, a few changes the plans set aside, and smart selection's later stages. The removed plans are in git history, as of `7afc71a`: the context bar and its refinement, Crop and Stickers on wide windows, redaction trust, the export sheet, polish and copy, the Draw highlighter, the editor screen refactor, the tool views registry, tool options, tool code out of `canvas/`, smart selection, and its spike.

Each section stands alone, so they can go in any order.

## 1. Checks only a device can make

The October 24 critique work and the refactors after it (October 25 and 26) were checked on web, at 390, 1024, and 1440 points wide. The tool options refactor (`bdb2805`) and the move of tool code out of `canvas/` (`703fddf` to `7afc71a`) weren't run on a simulator, and the `canvas/` move's web check isn't recorded either.

* **The editor on iPhone and iPad, after the refactors.** On the iOS simulator and the iPad Pro 13-inch simulator: open every tool, then Cancel and Done it; type text and tap the canvas while typing (the caret moves and the keyboard stays); double-tap a text layer; run Find, choose and unchoose a region, and step through Review; drag sideways on the photo in Adjust; draw a stroke; crop.
* **The context bar on iPad.** Touch on the bar's chips and their popovers, Dynamic Type at larger sizes, and 1133 and 1180-point windows. Check on the iPad mini simulator too.
* **Crop and Stickers on iPad.** Crop's options in the header, the straighten dial by finger, and the sticker popover's touch and long-press delete. When Crop's header was built, the iPad still showed the phone's Crop. It now gets the same `wide` as the rest of the editor, so check whether that's still true.
* **The phone's trays.** The bar's chips share `SizeChoices`, `ColorChip`, and `AlignPicker` with the phone's trays. Look at each tray on the iPhone simulator for anything that moved.
* **Find on native.** Vision and ML Kit find different faces than MediaPipe. Run Find on the Solvay photo on the iOS simulator and the Android emulator, and check that the tray's words ("28 found", "26 of 28 chosen", "No faces found") fit what they find.
* **Screen readers.** The iOS Simulator has no VoiceOver, so these wait for a device. With VoiceOver on an iPhone, check Find's Review row as one adjustable control, and swipe through the export sheet to check that it never reaches the editor behind it. Do the same with TalkBack on an Android phone.

## 2. Selection state on web

`RingChoice`, `Chip`, and Redact's `EffectChoice` mark the chosen option only with `accessibilityState.selected`, which React Native Web ignores. So on web a screen reader isn't told which tray choice, aspect ratio, or font is chosen. Choose between `aria-pressed` and `aria-selected` for a button, set it on each, and check `ToolButton`'s `aria-selected` against the same choice.

`fix: tell screen readers on web which option is chosen`

## 3. Refactors

* **The bar's fade geometry.** `rowEdges`, `leafEdges`, `fadeCut`, and `fadeCutLeft` in `shell/ContextBar.tsx` are pure and untested. Move them to `shell/barFade.ts`, with tests.
* **`TextStylePanel`'s `ScrollRow`.** A simpler fade than the bar's, for the dock's font and swatch rows. Once the bar's geometry has its own file, the row can share it.
* **Each tool's canvas input.** `canvasInput.ts`'s `inputRules` and `outlinedLayerFor` switch over every mode, and `EditorCanvas` calls each tool's gesture hook by name. Each tool could export its own rules and gesture, as `TOOL_VIEWS` does for its views. Tools can import `canvas/` now, so their types are in reach. Planned in [canvas-input-plan.md](canvas-input-plan.md).
* **Small ones.** Crop's straighten dial has its props written out twice, in `CropTool` and `DialStrip`; tidy that when Crop next changes. `EditorDock.tsx` holds `TOOL_VIEWS` and could be named for it. The wide window's `EyedropperHint` could move to an overlay both layouts share.

## 4. Smart selection

Cut out's Subjects, Pick (MobileSAM on every platform), Keep and Erase, Invert, Redact, and keeping a cut as a sticker are built. What's open:

* **App size.** The models add 44 MB to each app, and ONNX Runtime 34 MB to Android's (its arm64 library, before the store compresses it). iOS's Release size isn't measured. An int8 encoder might bring the models to about 12 MB, if the masks hold up. On-demand resources and Play Asset Delivery could fetch them the first time Pick opens, from Apple's and Google's servers.
* **Android on a phone.** Only the emulator has run Pick: about 2 seconds to read a photo, and taps from 0.15 seconds back to back to over a second spaced out. If a phone is slow, look at ONNX Runtime's NNAPI or QNN providers, or LiteRT on the GPU.
* **The first Pick after launch on iOS** takes about 3 seconds while Core ML loads the model, against a quarter of a second after that.
* **WebAssembly threads.** Where WebGPU isn't available, web encodes on one thread in about 3 seconds. Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `vercel.json`) would allow threads, likely about 1 second. Everything the site loads is its own, but check the share target and file handlers first.
* **Pick without Vision or ML Kit.** Segment Anything needs neither, so Pick could show on iOS 16 and on Android without Play services, where Cut out offers only the brushes.
* **Edges.** SAM's masks come out at 256×256 and are scaled up, so hair and fur come out soft and blocky. Refine the mask against the photo (a guided filter), or run the decoder again on a crop around the object.
* **Gestures.** A second mode or a long press for points that subtract, and a drag for a box, which `strokeIntent` already tells from a tap.
* **Memory in browsers.** Not measured with MobileSAM alone in its worker. With all three models loaded, the page held about 130 MB of JavaScript heap.
* **Copy a cut to a new layer**, the cut-out image with its mask applied, beside keeping it as a sticker.
* **Adjust only the selection.**
* **Remove an object.** Fill the hole a selection leaves with an inpainting model: MI-GAN (MIT, made for phones, about 30 MB) or LaMa (Apache 2.0, about 200 MB). It's the biggest piece here, so research it first.

## 5. Release

The iPad store screenshots come from a Release build (see `docs/store-listing/listing.md`). The wide editor now shows a tool's options in the header, so retake them if the listing shows the editor with a tool open.

## 6. Later

Ideas carried over from the roadmap that VISION.md held, not yet planned. Weigh each on its own before starting one.

* More adjustments: highlights, shadows, exposure, vignette, and sharpen. Add them one at a time, only where they feel as good as the four there are.
* PDF redaction, researched in [docs/pdf-redaction.md](../pdf-redaction.md): flatten each page to an image, redact it in the editor, and write a new PDF.
* Blurring license plates automatically, as Find does faces.
* Redacting several photos at once.
* Collages.
* Better HEIC and RAW import.

## Considered and left

These were weighed in the removed plans and set aside. Don't add them unless use shows they're missed.

* Snapping highlights to lines of text, and straightening for every pen, not only the highlighter.
* A long press or ⌘↩ on Find's ✓ that finishes Redact too.
* Pinch to zoom in the export preview.
* One props type for a tool's panel, bar, and tray, and splitting `FindPanel.tsx`'s views.
* A done state for Share, since the share sheet can't say whether anything was sent.
