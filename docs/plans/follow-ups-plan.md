# Follow-ups

What's left from the plans in `docs/plans/`, gathered October 26, 2026, when the finished plans were removed. Every step those plans listed has landed. What remains is checks only a device can make, smart selection's later stages, and a few bugs and ideas. The removed plans are in git history, as of `7afc71a`: the context bar and its refinement, Crop and Stickers on wide windows, redaction trust, the export sheet, polish and copy, the Draw highlighter, the editor screen refactor, the tool views registry, tool options, tool code out of `canvas/`, smart selection, and its spike. Each tool's canvas input was planned and built after that, and its plan removed as of `b87e7f6`; so were Crop's UI, as of `3bbc0d8`, and how the tools open and close, as of `c5a2a23`. Tools that stand alone and each tool's spec and definition were removed as of `737ebdb`, and the plan that gave each folder clear edges (the editor's store, host, and tool list, Crop and Stickers as tools), with the debate over Crop that led to step 8d, as of `aaed202`.

Each section stands alone, so they can go in any order.

## 1. Checks only a device can make

The October 24 critique work and the refactors after it (October 25 and 26) were checked on web, at 390, 1024, and 1440 points wide. The tool options refactor (`bdb2805`) and the move of tool code out of `canvas/` (`703fddf` to `7afc71a`) weren't run on a simulator, and the `canvas/` move's web check isn't recorded either. Nor is either check recorded for each tool's canvas input (`eb0e554` to `b87e7f6`), which changed what every canvas gesture calls, though not the gestures themselves. The tool lifecycle refactor (`2e5c184` to `9294a2f`) was checked on web at 390 and 1440 points wide, but not on a simulator. The folder refactor (October 27 and 28, through `8b11bbb`) was smoke-run in the browser pane after each step; its closing iOS simulator pass isn't recorded.

* **Every canvas tool kind, after the canvas input refactor.** In the web editor at 390 and 1440 points wide, and on the iOS simulator: a pen, highlighter (it joins only a highlighter layer), and eraser stroke; a dragged rectangle and arrow, a tap that selects a shape, and a drag that moves the selected one; a Redact box, a brushed redaction that joins the selected one, and a tap that selects a box; a Cut out brush stroke and a Pick tap; the eyedropper from Draw's color, from text's color while typing (the text keeps drawing), and from Find's redaction style (the found regions hide while it picks); a Find region chosen and unchosen, and a tap off the image that puts Find down; a sideways drag in Adjust; and a tap off the document while painting that puts the tool down.

* **The editor on iPhone and iPad, after the refactors.** On the iOS simulator and the iPad Pro 13-inch simulator: open every tool, then Cancel and Done it (Crop: Cancel leaves no undo step, Done leaves one; Stickers opens as a sheet on iPhone and a popover on iPad); type text and tap the canvas while typing (the caret moves and the keyboard stays); double-tap a text layer; run Find, choose and unchoose a region, and step through Review; drag sideways on the photo in Adjust; draw a stroke; crop.
* **The context bar on iPad.** Touch on the bar's chips and their popovers, Dynamic Type at larger sizes, and 1133 and 1180-point windows. Check on the iPad mini simulator too.
* **Crop and Stickers on iPad.** Crop's UI refactor (`77e25c1` to `3bbc0d8`) moved its options into `CropPanel` and its fill into shell's `SwatchChip`. On the iPad Pro 13-inch simulator, Crop now shows the wide header: the ratio menu, Rotate's actions and its switch, the straighten dial by finger, and the background chip all worked by touch. Still to check on an iPad: the same by hand, and the sticker popover's touch and long-press delete.
* **The phone's trays.** The bar's chips share `SizeChoices`, `ColorChip`, and `AlignPicker` with the phone's trays. Look at each tray on the iPhone simulator for anything that moved.
* **Find on native.** Vision and ML Kit find different faces than MediaPipe. Run Find on the Solvay photo on the iOS simulator and the Android emulator, and check that the tray's words ("28 found", "26 of 28 chosen", "No faces found") fit what they find.
* **Screen readers.** The iOS Simulator has no VoiceOver, so these wait for a device. With VoiceOver on an iPhone, check Find's Review row as one adjustable control, and swipe through the export sheet to check that it never reaches the editor behind it. Do the same with TalkBack on an Android phone.

## 2. Smart selection

Cut out's Subjects, Pick (MobileSAM on every platform), Keep and Erase, Invert, Redact, and keeping a cut as a sticker are built. What's open:

* **App size.** The models add 44 MB to each app, and ONNX Runtime 34 MB to Android's (its arm64 library, before the store compresses it). iOS's Release size isn't measured. An int8 encoder might bring the models to about 12 MB, if the masks hold up. On-demand resources and Play Asset Delivery could fetch them the first time Pick opens, from Apple's and Google's servers.
* **Android on a phone.** Only the emulator has run Pick: about 2 seconds to read a photo, and taps from 0.15 seconds back to back to over a second spaced out. If a phone is slow, look at ONNX Runtime's NNAPI or QNN providers, or LiteRT on the GPU.
* **The first Pick after launch on iOS** takes about 3 seconds while Core ML loads the model, against a quarter of a second after that.
* **WebAssembly threads.** Where WebGPU isn't available, web encodes on one thread in about 3 seconds. Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `vercel.json`) would allow threads, likely about 1 second. Everything the site loads is its own, but check the share target and file handlers first.
* **Pick without Vision or ML Kit.** Segment Anything needs neither, so Pick could show on iOS 16 and on Android without Play services, where Cut out offers only the brushes.
* **Edges.** SAM's masks come out at 256×256 and are scaled up, so hair and fur come out soft and blocky. Refine the mask against the photo (a guided filter), or run the decoder again on a crop around the object.
* **Gestures.** A second mode or a long press for points that subtract, and a drag for a box, which `strokeIntent` already tells from a tap. Each is a new `CanvasTool` kind: its union member and `ToolStroke` member, its row in `CANVAS_TOOLS` (`canvas/canvasTool.ts`), its builder in `cutOutSettings.ts`, its case in `useCanvasInput`'s `finishStroke`, and its live drawing in `LiveStrokeOverlay`.
* **Memory in browsers.** Not measured with MobileSAM alone in its worker. With all three models loaded, the page held about 130 MB of JavaScript heap.
* **Copy a cut to a new layer**, the cut-out image with its mask applied, beside keeping it as a sticker.
* **Adjust only the selection.**
* **Remove an object.** Fill the hole a selection leaves with an inpainting model: MI-GAN (MIT, made for phones, about 30 MB) or LaMa (Apache 2.0, about 200 MB). It's the biggest piece here, so research it first.

## 3. Bugs to look into

Seen while checking other work, recorded October 27, 2026. The first two were also seen on `main` before the change being checked, so neither comes from it. The last was recorded October 29 on the Cut branch, and comes from its bar.

### A rail click right after a header ✓ or ✕ is lost

Seen in the browser pane on a wide window, while smoke-testing the folder refactor (`ba24ea7`), and again on `56cfe06` with that step's changes stashed.

* **Steps:** open a tool (Find, or Cut out), press ✕ or ✓ in the header, then at once click a tool in the rail (Find).
* **Seen:** the editor goes back to idle and the rail's tool doesn't open. A second click on it opens it.
* **Expected:** the first click opens the tool.
* **Unknown:** the pane was hidden, so its page ran about two frames a second (see docs/development.md), and the lost click may be that alone. Try it in headless Chrome at 60 frames a second, and by hand in a browser, before looking at the code. If it holds there, look at what the header's ✓ and ✕ leave behind as the context bar gives way to the title (a hover or pointer state, or a press that the rail's `Pressable` sees as its own).

### A photo dropped just after a reload lands off the canvas

Seen in the browser pane on a wide window, in the same smoke run.

* **Steps:** reload the editor on a project, and drop a photo onto the canvas within a few seconds, before the canvas has drawn.
* **Seen:** the photo joins the layers and is selected, but sits outside the document: the canvas doesn't show it, and Find on it says "Nothing in the visible crop". The same drop a few seconds later lands in the middle of the view.
* **Expected:** the photo lands in the visible area, or the middle of the document while there's no view yet.
* **Unknown:** the drop was a synthetic `DragEvent`, sent from a script, so check with a real drag too. The likely cause is `useAddImage`'s `onImage` in `Editor.tsx`, which places the image in `canvasRef.current?.visibleArea()`: before the canvas has its size or its view, that area may be empty or at the wrong place, rather than undefined (which would place it in the middle). Look at what `visibleArea()` returns before the first layout.

### Cut's header runs out of room once something is selected

Seen in headless Chrome at 1280 by 800 on October 29, 2026, while fixing a freed mask on Cut's second tap, with New layer joining the Apply menu (that fix, and how it was found, is in docs/GOTCHAS.md).

* **Steps:** on a wide window, open Cut with Tap, and tap an object.
* **Seen:** before the tap the header shows Tap, Add, Subtract, Adds, Subtracts, Subjects, and Invert. After it, Smaller, Larger, and Reset join them, Invert is pushed off or clipped at the right edge, and Apply doesn't show at all.
* **Expected:** Invert and Apply stay in reach while anything is selected, since Apply is the only way to act on the selection now that ✓ only puts Cut down.
* **Unknown:** whether the bar scrolls to Apply or clips it, and at which width it starts. The phone dock has the same squeeze (docs/plans/cut-tool-plan.md, step 3): moving the tap mode, or Smaller and Larger, out of the bar may answer both.

## 4. Release

The iPad store screenshots come from a Release build (see `docs/store-listing/listing.md`). The wide editor now shows a tool's options in the header, so retake them if the listing shows the editor with a tool open.

## 5. Later

Ideas carried over from the roadmap that VISION.md held, not yet planned. Weigh each on its own before starting one.

* More adjustments: highlights, shadows, exposure, vignette, and sharpen. Add them one at a time, only where they feel as good as the four there are.
* PDF redaction, researched in [docs/pdf-redaction.md](../pdf-redaction.md): flatten each page to an image, redact it in the editor, and write a new PDF.
* Blurring license plates automatically, as Find does faces.
* Redacting several photos at once.
* Collages.
* Better HEIC and RAW import.
* Packages, once something outside this repo needs a part on its own (another app embedding the editor, or a tool reading the document format). Then one `packages/editor` with subpath exports (`@tuck/editor`, `/render`, `/document` for today's `model/`), starting with a spike: Metro resolving `.web.ts` through `exports`, tsc, Biome, Vite, the Node tests, and Expo autolinking `modules/image-analysis` once it has a `package.json`. Keep `biome.json`'s bans, since hoisting lets a package import what it never declared. The full plan is in git history as of `aaed202` (`docs/plans/composition-plan.md`).

## Considered and left

These were weighed in the removed plans and set aside. Don't add them unless use shows they're missed.

* Snapping highlights to lines of text, and straightening for every pen, not only the highlighter.
* Pinch to zoom in the export preview.
* One props type for a tool's panel, bar, and tray, and splitting `FindPanel.tsx`'s views.
* A done state for Share, since the share sheet can't say whether anything was sent.
