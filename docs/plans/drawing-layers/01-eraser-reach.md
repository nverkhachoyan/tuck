# 1. The Eraser reaches every mark

Ideas 1 and 2 from the brainstorm, with the shape fade and the ring on web.
Size M: S for reaching and honest erasing, as the direction says, plus the
fade, the notice, the ring, and the new canvas tool kind.

Settle first: open questions 5 (ink under a photo is erased) and 6 (an
Eraser with nothing to erase stays enabled).

## What the person sees

- Opening the Eraser from the toolbar (dock, rail, `X`) lets go of any selection, on a wide window too.
- The swath clears ink live in every unlocked, visible drawing it passes over, from any session, with nothing selected. Locked drawings draw no swath.
- On release, the ink stays cleared: nothing comes back.
- Erased ink can't be tapped; a tap there reaches what's under it.
- A shape dims as the swath crosses it and goes when the finger lifts.
- When a whole drawing or shape goes, the toast says "Drawing erased · Undo" or "Rectangle erased · Undo" (the shape's name), and screen readers hear "Drawing removed" or "Rectangle removed". Its row leaves the Layers panel in the same step.
- A selection box shrinks once whole strokes are erased away.
- On web, a ring at the eraser's size follows the pointer over the canvas.
- Photos, text, stickers, and redactions, brushed ones included, are never touched.
- A selected drawing's actions offer Pen only, until step 2.

## The edits

### Model (plain TypeScript)

`layers/strokes.ts`:

- Export `nearLine`, and add `segmentsNear(points, transform, reach, test)`: the stepping loop now in `erasesShape` (steps no longer than `reach`, in layer space), taking a test per point. Worklet, so the canvas can use it per segment too.
- `hitTestDrawing(layer, point, padding)`: a pen stroke hits only where no later eraser stroke in the layer covers the point (within the eraser's half width less `padding`). Still a worklet.
- `visibleReach(stroke)`: how far a pen stroke's ink reaches from its centerline. Half its width for a round pen; about 0.71 of the width for a Marker or Highlighter's square caps; about 0.8 for neon's blurred glow (`NEON_GLOW` 0.55 plus three sigmas of `NEON_GLOW_BLUR`). The neon numbers live in `DrawingLayerView.tsx`; move the two constants to `drawing.ts` so the plain file can read them.
- `pruneErased(strokes)`: drops each pen stroke whose drawn line every later eraser covers (each sample along it, at steps of a quarter of its width, within the eraser's half width less `visibleReach`), then each eraser stroke that overlaps no pen stroke before it. Errs toward keeping.

`layers/shape/shapeGeometry.ts`: `erasesShape` uses `segmentsNear`.

`layers/drawing/drawingEdits.ts`:

- `drawStroke(document, selectedLayerId, stroke)` takes pen strokes only (`Stroke & { type: "pen" }`); its eraser branch moves out.
- New `eraseStroke(document, stroke, scope)`, `scope` a drawing's id or `null` for everything:
  - Finds every unlocked, visible drawing (`scope` alone when given) the stroke crosses: skip one whose `drawingBox`, padded, the stroke's box misses, then `segmentsNear` with reach = the eraser's half width plus the largest `visibleReach` among its pens, in the layer's space.
  - Adds the stroke to each with `addStroke`, then `pruneErased`; removes a drawing left with no pen strokes.
  - Removes each unlocked, visible shape `erasesShape` says it crosses, only when `scope` is `null` (step 2 relies on this).
  - Never looks at another layer type.
  - Returns the same document when nothing changed.
- New `removedLayers(before, after)`: the layers in `before` not in `after`, for the notice.

### Store

`store/editorSlice.ts`: `drawStroke(stroke)` stays for pens; new
`eraseStroke(stroke, scope)` calls the edit through `setDocument`, so each
swipe is one step and `selectionAfter` clears a removed selection.

### Canvas

`canvas/canvasTool.ts`:

- New kind `{ type: "erase"; width: number; scope: string | null }` in `CanvasTool`, its `ToolStroke` member with `points`, and its row in `CANVAS_TOOLS` (`dragsOut: false`, `restyles: null`).
- `canAddTo` drops the eraser case from `draw`.
- New `strokeReaches(tool, layer)`: for `erase`, an unlocked drawing (the scope's alone when set); for the others, what `canAddTo` says today.

`canvas/strokeIntent.ts`: `erase` finishes like `draw`.

`canvas/useToolStroke.ts`: `LiveStroke.targetId` becomes `reaches: (layer) => boolean`, from `strokeReaches` (or the cut's image). For `erase`, also `crossed: SharedValue<string[]>`: on each new segment, the paint gesture tests unlocked shape targets with `segmentsNear` against their `strokes` (already sent to the UI thread by `layerTargets`) and adds the hits. Cleared when the stroke lands.

`canvas/usePaintGesture.ts`: an optional per-segment worklet callback, which `useToolStroke` gives for `erase`.

`canvas/LiveStrokeOverlay.tsx`:

- `StrokeTarget` draws the live eraser into a drawing when `stroke.reaches(layer)`.
- The eraser's path is built once per frame (one derived `SkPath` in `useToolStroke`) and handed to each drawing's `LivePath`, rather than each rebuilding it.
- `NewLayerStroke` no longer sees an eraser.

`EditorScene.tsx`: passes `stroke` to `StrokeTarget` when `stroke.reaches(layer)`; a shape in `stroke.crossed` draws at about a third (`LiveShape` takes an `opacity`; shapes have no blend, so a `Group opacity` is safe).

`canvas/useCanvasCursor.ts` and `EditorCanvas.tsx`: on web, while the tool is `erase`, a ring at the eraser's width in screen pixels follows the pointer (`colors.selection`, 1.5px); hidden off the canvas and during a drag.

### The tool

`tools/eraser/useEraserTool.ts`:

- `canvasInput` is `{ type: "erase", width, scope: null }`.
- `finishStroke` calls `eraseStroke`, compares the documents with `removedLayers`, and calls `notify` with "Drawing erased" or "<shape name> erased" (`layerKindName`) for the topmost layer that went. The direction's wording has no line for several at once; the topmost stands for them, and Undo brings back the whole swipe.
- `announcement` returns "Drawing removed" or "<shape name> removed" for that change.

`tools/eraser/eraserTool.ts`: `announcement` wired; new definition field
`startsUnselected: true`.

`tools/eraser/eraserSpec.ts`: `actsOn` returns false for now (step 2 restores it).

`defineTool.ts`: `startsUnselected?: boolean`, documented in its list. `useEditorTools.ts`'s `startTool` calls `selectLayer(null)` first for such a tool.

## Tests

- `layers/__tests__/strokes.test.ts`: a tap on erased ink misses and reaches nothing; on ink an earlier eraser cleared before a later pen stroke, it hits; `pruneErased` drops a fully covered pen and its now useless eraser, keeps a partly covered one, and keeps a neon stroke whose glow pokes past the eraser; `visibleReach` per tip.
- `layers/drawing/__tests__/drawingEdits.test.ts`:
  - `eraseStroke` crosses two drawings from two sessions and adds the stroke to both; misses one whose box it misses; leaves a locked and a hidden one.
  - A neon stroke just outside the eraser's half width, but inside its glow, still gets the eraser stroke (the generous test).
  - An emptied drawing is removed with the shapes in one edit; `removedLayers` names both.
  - **Never reaches a redaction:** a document with a brushed redaction (`shape: "strokes"`), a box redaction, a photo, a sticker, and text under the swath comes back with each of those layers the same object, with `scope` null and with `scope` set to the redaction's id.
  - With `scope` set, shapes the stroke crosses stay.
  - The existing "an eraser joins a multiplying drawing and a plain one" and "an eraser removes each shape it crosses, whole" move to `eraseStroke`.
- `layers/shape/__tests__`: `erasesShape` unchanged by the refactor (existing tests pass).
- `store/__tests__/editorSlice.test.ts`: replace "an eraser only erases the selected drawing" with "an eraser erases every drawing it crosses, with nothing selected", "an eraser leaves locked and hidden drawings", "erasing a selected drawing away clears the selection", and "an eraser never reaches a brushed redaction". "an eraser erases in the selected drawing and removes shapes together" becomes one swipe across a drawing and a shape, unselected.
- `canvas/__tests__/canvasTool.test.ts`: `strokeReaches` for `erase` takes unlocked drawings only, never a redaction, shape, image, or text, and only the scope when set.
- `canvas/__tests__/hitTest.test.ts`: `findLayerAt` passes through erased ink to the layer under it, and through an uncovered part of a brushed redaction.
- `projects/__tests__/projectFile.test.ts`: a version 5 project with a drawing holding pen and eraser strokes (from two "sessions") reads back unchanged; nothing is pruned on open.

## Docs and lessons

- docs/architecture.md: the Highlighter paragraph ("while an eraser joins either" becomes the Eraser reaching every unlocked drawing); `tools/` (`pen/`, `shape/`, and `eraser/`: the Eraser's own `erase` input); `defineTool`'s `startsUnselected`; the canvas bullet's list of strokes.
- DESIGN.md: the eraser ring, and shapes dimmed to a third as the Eraser crosses them.
- `docs/interactive/src/lessons/model/StrokesLesson.tsx`: "Erase across it" says erasing a stroke away shrinks the box and that erased ink can't be tapped; a stroke erased in part keeps its box. The probe step shows a tap on erased ink missing.
- docs/brainstorming/drawing-layers/current-model.md is a record of `e0b07fb`; leave it.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`. No `.web` files change.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Draw in three Pen sessions, overlapping, add a rectangle and an arrow, then open the Eraser with a drawing selected: the selection goes. One swipe across everything clears ink from all three live, dims the shapes, and on release nothing comes back; the shapes go with the toast.
- Lock one drawing: no swath over it, untouched after.
- Erase one drawing away: its row goes, the toast and Undo bring it back.
- Tap where ink was erased: whatever is under it is selected.
- Brush a redaction, add a box redaction, text, and a sticker, and erase across all of them: none change.
- On web only: the ring follows the pointer at each size, and hides off the canvas.
- A selected drawing offers Pen, not Erase.

Only a phone: the swath keeping up with a fast swipe across a page of ink, and the notice's announcement with VoiceOver.
