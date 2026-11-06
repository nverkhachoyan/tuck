# 5. Restyle a mark

A selected mark's Pen shows its tip, color, and size, and changing any of them
restyles it live, as Shape does a selected shape. Size S.

Settle first: open question 2, answered before step 4 (whether a mark can
hold several sizes, which decides what a size change restyles).

## What the person sees

- Select a mark, then Pen from its actions: Pen's tip, color, and size show the mark's, and the mark keeps its blue outline.
- Changing the color, the tip, or the size changes the whole mark at once. Each change is one undo step.
- A highlight changed to Pen stops multiplying, and back again it multiplies.
- Strokes drawn then join the mark in its new style.
- Erased parts stay erased.
- The toolbar's Pen, with nothing selected (it lets go, step 4), shows the remembered style as today.

## The edits

### Model (plain TypeScript)

`layers/drawing/drawing.ts`: `markStyle(layer): Brush & { type: "pen" } | null`,
its last pen stroke's tip, color, and width (in the layer's space).

`layers/drawing/drawingEdits.ts`: `restyleDrawing(document, id, patch)`,
`patch` any of `color`, `tip` (`PenTip | null`, null for the round pen), and
`width` in document units:

- Sets the field on every pen stroke; `width` divided by the layer's `scaleX` (drawings scale uniformly).
- Sets `blend` from `strokeBlend` when `tip` changes.
- Leaves eraser strokes alone, so what was erased stays erased (a wider stroke can show a sliver past an old eraser's edge; that's accepted, as in any partial erase).
- Recenters (`recenterDrawing`), since widths move the box.
- Returns the same document when nothing changes, or the layer is locked or missing.

### Store

`store/editorSlice.ts`: `restyleDrawing(id, patch)` through `setDocument`.

### Pen

`tools/pen/penSettings.ts`, beside `withPenColor`:

- `withSelectedMark(settings, layer, size)`: the settings with the mark's tip, its color (in `color` or `highlightColor` by tip), and the size index nearest its width share, as `withSelectedShape` does for shapes.
- `markPatch(before, after, size)`: the fields that changed, as a `restyleDrawing` patch.

`tools/pen/usePenTool.ts`: while open from a mark (`on`), `settings` is
`withSelectedMark(...)`, and `change` writes the preference (as Shape does)
and calls `restyleDrawing` with `markPatch`. Step 4's `sameStyle` then always
holds for strokes into the mark.

`canvas/canvasTool.ts`: `CANVAS_TOOLS.draw.restyles` becomes `"drawing"`.
Only Pen uses `draw` since step 1, so the Eraser isn't affected.
`outlinedLayerFor` then outlines the selected mark while Pen is open, and
`drags` stays false (`dragsOut: false`).

## Tests

- `layers/drawing/__tests__/drawingEdits.test.ts`: `restyleDrawing` recolors every pen stroke and no eraser; a tip change to `marker` sets `blend`, and back clears it; a width on a scaled drawing is divided by `scaleX`; a locked drawing and an unchanged patch return the same document; the drawing recenters.
- `layers/drawing/__tests__/drawing.test.ts`: `markStyle` reads the last pen stroke, and is null for a drawing with none.
- `tools/pen/__tests__/penSettings.test.ts`: `withSelectedMark` picks the highlighter color for a highlight and the nearest size; `markPatch` lists only what changed.
- `store/__tests__/editorSlice.test.ts`: "restyling a drawing is one undo step, and the same style isn't one" (as for shapes and redactions).
- `canvas/__tests__/canvasTool.test.ts`: `restyles` is true for a drawing with `draw`, false with `erase`.
- `__tests__/canvasInputFor.test.ts`: Pen with a selected drawing outlines it.

## Docs and lessons

- docs/architecture.md: the tool settings bullet names `withSelectedMark` beside Shape's rule; `pen/` restyles a selected mark.
- No lesson covers restyling.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Draw a red circle, select it, Pen: red, Pen tip, its size. Pick blue: the circle turns blue. Undo: red again, Pen still open.
- Change it to Highlighter: it multiplies over the photo; to Neon: it glows.
- Restyle a mark that was partly erased: the gap stays.
- On wide, the context bar's chips and the ◢ flyout show the mark's style.
- An old project's drawing with several colors: picking a color makes them all that color.

Only a phone: nothing beyond the simulator's checks.
