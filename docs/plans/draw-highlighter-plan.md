# A highlighter in Draw

A plan for marking up screenshots with a highlighter, written October 2026 after a critique of the whole app (snapshot in `.impeccable/critique/`). It's the last of five plans from that critique, and the only one of its "bigger ideas" chosen for this round. It begins with a spike, because the look it needs depends on how Skia blends layers on every platform.

## What's there already

Draw's Marker tip is most of a highlighter. In `render/layers/DrawingLayerView.tsx` it draws at 45% opacity (`MARKER_OPACITY`), with square ends "like a highlighter's chisel tip", as one path per stroke so it doesn't darken where it crosses itself, and its sizes in `brushSettings.ts` run wide "to cover a line of text". What it lacks, for marking up a screenshot:

* **It washes out what it marks.** At 45% over black text on white, the text turns gray and the paper takes the color. A real highlighter leaves the ink black and tints only the paper.
* **It draws in the shared color, red by default.** `BrushSettings.color` is one color for every pen and shape ("Every pen and shape draws in it"), so picking yellow for a highlight makes the next arrow yellow too.
* **Lines come out wobbly.** Highlighting a line of text by finger, or even by mouse, leaves a wavy band. Draw has no way to draw a straight one.
* **It's called Marker.** The word people use for this is highlighter.

A scratch branch (not committed) drew marker-only layers with `Group layer={<Paint blendMode="multiply" />}` at full strength, instead of 45% opacity. On web, by day and at night, at 1440 and at 390:

* CanvasKit accepts the blend. Nothing threw.
* Over white, yellow `#FFD60A` stays that yellow, and black text under it stays black. A plain pen in the same yellow covers the text.
* A second multiplying layer over the first darkens the overlap to `#FFB400`. Strokes in one layer composite first and multiply once, so the darkening only happens between layers.
* Over a blue sticker the yellow becomes a dark olive (`58, 103, 8`); the blue beside it stays. A solid redaction above the highlight covers it (`34, 34, 34`), with no yellow through it.
* On a near-black canvas the band disappears and white text turns the highlight color. That is the dark-screenshot problem below.
* The export preview's pixels match the editor, by day and at night. The night chrome goes graphite and the print does not. The redaction is a neutral gray and stays `34, 34, 34`, so on web, where the editor and the export are both sRGB, the blend doesn't shift.
* Home's thumbnail shows the same yellow and the black text under it.

Not checked: the iOS simulator, Android, or a stroke drawn live. On each, draw a marker across black text on white and across white text on black, export JPEG and PNG, and compare the file with the editor, including a gray. The thumbnail should match. A highlight under a redaction, over a sticker, and over another highlight should match the web results above.

## Decisions

* **Marker becomes Highlighter.** The label in Draw's tip choices (`DrawPanel.tsx`) and its chip read "Highlighter". The saved id stays `"marker"` (`penTips` in `model/layers/drawing.ts`), so saved projects and settings don't change. Text's "Marker" font style (`TextStylePanel.tsx`) is a different thing and keeps its name.
* **A highlight multiplies.** The highlighter's strokes are composited onto the photo with the multiply blend: over white they show their full color, over black text they leave it black. That is how a highlighter works, and it's what makes a highlighted line readable. Pen and Neon stay as they are.
* **Highlights live in a drawing layer of their own.** A drawing layer is drawn inside a saved layer (`<Group layer>`), so its eraser clears only its own strokes. A blend inside it only reaches the layer's other strokes, never the photo, so multiply has to apply to the whole layer as it's composited. A drawing layer therefore gets `blend?: "multiply"`, set when a highlighter stroke starts it. A highlighter stroke joins the selected drawing layer only if that layer multiplies, and starts a new one otherwise; a pen stroke likewise never joins a multiplying layer. The eraser works on whichever layer is selected, as now. This follows the AGENTS.md rule for backdrop filters: the editor and export draw layers straight onto the canvas, so a layer's blend reaches what's under it in both.
* **The highlighter keeps its own color, yellow to start.** `BrushSettings` gains `highlightColor`, defaulting to the swatches' yellow (`#FFD60A`), and the color chip shows and sets it while the highlighter is chosen. `parseBrushSettings` fills it from the default for settings saved before it existed. A yellow stroke is document content, not chrome, so the One Marker Rule doesn't apply (`polish-and-copy-plan.md` writes that into DESIGN.md).
* **Hold to straighten.** Holding still at the end of a highlighter stroke for half a second turns it into a straight line from its start to where it stopped, snapped level when it's within 5° of horizontal, as Apple's Markup does. On web, holding Shift while drawing does the same from the first move. Both apply to the highlighter only for now; Pen could follow if it's wanted.

## Open question

**Highlights on dark screenshots.** Multiply shows nothing over black: a yellow highlight over white text on a dark screenshot (a phone in dark mode, a terminal) disappears, while today's 45% marker at least tints it. Options:

1. Multiply always, as a highlighter on paper does. Simple, and right for most screenshots, but useless on dark ones.
2. A second tip, "Marker", kept as today's see-through ink, beside the new highlighter. One more choice in Draw (four tips), but nothing is lost.
3. Pick the blend from what's under the stroke (screen over dark, multiply over light). Clever, but a stroke crossing both would change character halfway, and it's hard to predict.

The plan assumes option 2 until the spike shows how both look; settle it before step 3.

Settled: option 2. Multiply looks right on a light screenshot, and on a dark one the band vanishes, which is what the kept Marker is for. The spike showed no problem with keeping both.

## Steps

Each step passes `npm run check` and `npm run typecheck` (and `npm test` where it touches pure modules), and ends with a commit message handed over. Check on web at 390 and 1440 points wide, by day and at night, and on the iOS simulator; the spike covers Android too.

### 1. Spike: multiply on every platform

Not committed. In a scratch branch, give `DrawingLayerView`'s group a `layer={<Paint blendMode="multiply" />}` for drawings that hold only marker strokes, then check, on a screenshot with black text on white and a dark-mode one:

* the editor on web, iOS, and Android;
* export (`drawAsImage`) on each, comparing the file with the editor;
* a thumbnail on home;
* the editor's sRGB canvas against the export (AGENTS.md: iOS canvases default to P3; a blend should match once both are sRGB, but check a gray);
* a highlight under a redaction, over a sticker, and over another highlight (multiply darkens where two highlights overlap, as real ink does).

Write what was found into this plan's "What's there already", and settle the open question.

Checked on web, by day and by night, at 1440 and 390, with saved marker layers (a light canvas and a near-black one). The blend works, as written above. iOS and Android still need the same scenes drawn and exported there.

### 2. Marker becomes Highlighter

* `DrawPanel.tsx`: the tip's title and label. Its icon stays `marker`.
* Text's font style keeps "Marker".

Check the dock's tip row on a phone and the tip chip's popover on a wide window.

Checked on web, by day and by night. At 1440 the tip chip reads Highlighter and its popover offers Pen, Highlighter, and Neon. At 390 the brush options row is Pen, Highlighter, Neon. Text's font style is still Marker.

Commit: `feat: call Draw's marker a highlighter`

### 3. Its own color

* `brushSettings.ts`: `highlightColor` with its default and parsing; a helper that gives the color for the chosen tool. Tests in `__tests__/brushSettings.test.ts` for a saved setting without it, a damaged value, and switching tools (the pen's color survives a highlight).
* The color chip and the phone's color row read and set that color while the highlighter is chosen.
* If option 2 was chosen, the kept see-through Marker uses the shared color, as today.

Check: pick yellow for the highlighter and red for the pen, draw with each, reload, and both colors come back.

Commit: `feat: give the highlighter its own color`

### 4. Highlights that multiply

* `model/layers/drawing.ts`: `blend?: "multiply"` on `DrawingLayer`, kept by its check for a saved layer (an unknown value drops to none), and `createDrawingLayer` sets it for a highlighter stroke.
* `model/edits/draw.ts`: `drawStroke` joins the selected layer only when the stroke's blend matches the layer's, and otherwise starts a layer on top. Tests in `model/edits/__tests__/draw.test.ts` for each pairing, and for the eraser on both kinds; the saved-layer check's in `model/layers/__tests__`.
* `DrawingLayerView`: a multiplying layer's group composites with multiply. Highlighter strokes in it draw at full strength (the multiply does the see-through), so `MARKER_OPACITY` applies only to the kept Marker, if any.
* `projects/`: the project version, only if a saved project with `blend` must not open in an older build (an older build ignoring the field would draw highlights at full strength, which is wrong but not broken; decide with the release checklist).
* The interactive docs' rendering lessons run `render/` on CanvasKit; run `npm run build --prefix docs/interactive`.

Check: highlight a line of text on a light screenshot (the text stays black), then switch to the pen and draw (a new layer), erase across both, undo each step, export as JPEG and PNG, and compare a thumbnail. Check at night, where the canvas's table changes but the photo and highlight must not.

Commit: `feat: draw highlights that multiply onto the photo`

### 5. Hold to straighten

* `canvas/usePaintGesture.ts`: while the highlighter is drawing, a stillness timer on the UI thread (no move past a few screen pixels for 500 ms) marks the stroke straight; the live stroke redraws as a line from its first point to the current one, snapped level within 5°, and keeps following the finger as a line until it lifts. On web, Shift held (`useShiftHeld`) at the first move draws straight from the start.
* The straightening itself (points to a line, the level snap) is a pure function in `model/strokes.ts`, marked `"worklet"` (AGENTS.md: geometry gestures use lives there), with tests.
* A haptic tick when it straightens, on native.

Check by finger on the iOS simulator (hold, then drag on: the line follows), by mouse with Shift on web, a quick stroke that ends without holding (stays freehand), and that Pen and Neon don't straighten.

Commit: `feat: straighten a highlight by holding at its end`

### 6. Docs

* DESIGN.md: nothing (tips are document content).
* AGENTS.md: the multiplying layer, why it must be its own layer (the saved layer around a drawing), and anything the spike found about blends on a platform.
* The interactive lessons, if one covers drawing layers or `drawStroke`.

Commit: `docs: describe the highlighter's layers`

## Not doing

* **Snapping highlights to lines of text.** Find's text detection could fit a highlight to each line it finds. It's close to the "tap to hide" screenshot mode, which wasn't chosen for this round; worth revisiting together.
* **Straightening for every pen.** Start with the highlighter, where straight lines are the point.

## Risks

* **The blend on web.** CanvasKit supports multiply, but React Native Skia's web build throws for some filters (AGENTS.md). A blend mode on a layer's paint isn't a filter, so it should work; the spike confirms it before anything is built.
* **Layer count.** Switching between pen and highlighter starts a new layer each time. A layers list of alternating drawings is the cost of a correct blend; merging adjacent drawings of the same kind on the way in keeps it down.
