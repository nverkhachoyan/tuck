# 7. The Stroke eraser

The Eraser gets two options, Eraser and Stroke eraser, offered the way Pen
offers its tips. Size M: the direction's S to M, at its upper end for the
dimming on the UI thread.

Settle first: nothing (open question 9 is decided: the choice is
remembered). Question 8, Canva by hand, can be looked at first if wanted.

## What the person sees

- **Eraser** (the default) works as after step 1.
- **Stroke eraser**: each stroke dims as the finger crosses it, with a light haptic tick on iOS and Android, and goes when the finger lifts. Nothing is removed mid-drag. A tap removes the stroke under the finger.
- A stroke the plain Eraser cut in two dims as a whole, both halves, when either is touched. Ink already erased can't be touched.
- Shapes dim as they're crossed and go whole on release, with either option.
- Removing a mark's last stroke removes the mark, with the toast and announcement from step 1.
- On web, hovering with the Stroke eraser lights up the stroke a click would remove. The plan shows it with the same dimming as a drag, so hover and drag say the same thing; if that doesn't read as lit up, tint it `colors.selection` instead (the same shared value drives either).
- Phone: the dock shows two buttons, Eraser and Stroke eraser; Eraser keeps its size row beside them, Stroke eraser has none. Wide window and web: the context bar shows the two, the rail's ◢ flyout lists them, and the rail's tile shows which is active.
- The choice is remembered between sessions, like Pen's tip.
- In Erase on a mark (step 2), both options work, on that mark alone.

## The edits

### Model (plain TypeScript)

`layers/strokes.ts`: `strokesHitBy(strokes, transform, points, reach): number[]`,
the indexes of the pen strokes the path (document space) passes within
`reach` of, counting only ink no later eraser covers (step 1's eraser-aware
test), stepped by `segmentsNear`. A worklet, so the canvas and the edit agree
on what goes.

`layers/drawing/drawingEdits.ts`: `eraseWholeStrokes(document, points, reach, scope, removes = () => true)`:

- For each unlocked, visible drawing `eraseStroke` would reach (same box skip), drops the pen strokes `strokesHitBy` names and `removes` allows, then `pruneErased`, and removes a drawing left with none. `removes` is the filter idea 3 asked for (a highlighter-only eraser would be one condition later).
- Removes crossed shapes whole when `scope` is null, as `eraseStroke` does.
- Writes no eraser stroke. Never looks at another layer type.

`reach` is the touch's: `HIT_PADDING_PX` (14 screen pixels) at the view's
scale, passed in from the canvas, so a fine line is still easy to hit.

### Settings and tool

`tools/eraser/eraserSettings.ts`: `EraserSettings` gains
`mode: "eraser" | "stroke"`; `parseEraserSettings` keeps any saved size and
defaults the mode to `"eraser"`; `eraserBrushFor` is unchanged.

`tools/eraser/eraserTool.ts`: `variants` (Eraser, Stroke eraser, each with an
icon), `activeVariant`, `selectVariant`, and `variantEntry`, as
`penTool.ts` declares them.

`tools/eraser/EraserPanel.tsx`: `EraserPanel` (dock) shows the two as
`ToolButton`s, then `SizeChoices` only for Eraser; `EraserBar` shows them as
segments, then `SizeChip` only for Eraser.

`tools/eraser/useEraserTool.ts`: `canvasInput`'s `erase` gains `mode`;
`finishStroke` calls `eraseWholeStrokes` for `"stroke"`, with the notice as
in step 1. `stepSize` does nothing in Stroke eraser.

### Canvas

`canvas/canvasTool.ts`: `erase` gains `mode`; its `ToolStroke` carries the
touch's reach for `"stroke"`.

`canvas/useToolStroke.ts`: for `erase` with `"stroke"`:

- No live swath (`strokeReaches` stays as it is; `StrokeTarget` draws no `LivePath` for this mode).
- `crossedStrokes: SharedValue<Record<string, number[]>>`, by drawing id, grown from the per-segment worklet (step 1's) with `strokesHitBy` against each reachable drawing target's `strokes`, from the segment alone. On new hits off web, `scheduleOnRN(hapticTick)` (`platform/haptics.ts`). Cleared when the stroke lands.
- On web, while no button is down, a hover over the canvas sets `crossedStrokes` to the stroke under the pointer (`useCanvasCursor` gives the point).

`layers/drawing/DrawingLayerView.tsx`: optional `dimmedStrokes?: DerivedValue<readonly number[]>`.
When given, each stroke draws through a small `DimmedStroke` with an
opacity derived from it (about a third when listed). Without it, nothing
changes, which keeps the `docs/interactive` lessons (`layerViews.tsx`,
`LayersLesson.tsx`) drawing as they do. Dimming a stroke inside the
drawing's own layer keeps the multiply and the eraser's clear working.

`EditorScene.tsx`: hands each reachable drawing its slice of
`crossedStrokes`.

## Tests

- `layers/__tests__/strokes.test.ts`: `strokesHitBy` names a crossed stroke, both halves of a stroke an eraser cut (it's one index), not a stroke touched only where it's erased, and a dot under a one-point tap.
- `layers/drawing/__tests__/drawingEdits.test.ts`:
  - `eraseWholeStrokes` removes touched strokes whole and leaves the rest; prunes eraser strokes left over nothing; removes an emptied drawing; removes crossed shapes; with a scope, touches only that drawing and no shape; `removes` filters.
  - **Never reaches a redaction:** a brushed redaction, a box redaction, a photo, a sticker, and text under the path come back the same objects, with and without a scope.
  - Leaves locked and hidden drawings.
- `tools/eraser/__tests__/eraserSettings.test.ts`: the mode round-trips; a saved size without a mode parses as Eraser with that size; anything else falls back.
- `store/__tests__/editorSlice.test.ts`: "a stroke eraser swipe is one undo step"; "a stroke eraser never reaches a brushed redaction".
- `canvas/__tests__/strokeIntent.test.ts`: a tap with the Stroke eraser finishes with its one point.

## Docs and lessons

- docs/architecture.md: `eraser/` joins `pen/`, `shape/`, and `cut/` among the tools with variants; `eraserSettings` holds the mode.
- DESIGN.md: the Eraser's options in the dock and the bar, strokes dimmed to a third before they go, the haptic tick.
- `docs/interactive`: no lesson teaches the Stroke eraser; the build confirms `DrawingLayerView`'s new prop is optional.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Write a word badly, Stroke eraser, swipe once through it: each stroke dims as it's crossed and goes on release; the rest of the page stays.
- Tap a dot: it goes.
- Cut a line in two with Eraser, then touch one half with Stroke eraser: both dim and go.
- Swipe over a rectangle: it dims, then goes with the toast.
- Close and reopen the Eraser, and reload: Stroke eraser is still chosen; the rail's tile and ◢ flyout show it.
- On web: hovering a stroke dims it; moving off undims.
- Erase on a selected mark with Stroke eraser: only its strokes dim and go.
- Over a brushed redaction: nothing dims.

Only a phone: the haptic tick per stroke crossed (not per frame), and dimming keeping up with a fast swipe over many strokes.
