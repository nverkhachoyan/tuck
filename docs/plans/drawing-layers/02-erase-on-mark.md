# 2. Erase on a selected mark

The direction's "Erase on a selected mark", moved up from fourth (see the
README). Size S.

Settle first: nothing.

## What the person sees

- A selected drawing's actions (the phone's dock, the wide header's selection bar) offer **Erase** again, after Pen. Shapes, text, stickers, photos, and locked drawings don't.
- Erase opens the Eraser on that drawing alone. It keeps its blue outline; every other drawing and shape dims to about a third. The photo, text, stickers, and redactions stay as they are. The dimming is on screen only.
- The swath shows over that drawing only. Shapes it crosses don't dim and don't go.
- **✓** returns to the drawing, still selected, with its actions. **✕** takes back what was erased.
- Erasing the drawing away removes it, closes the Eraser, and shows "Drawing erased · Undo".
- The rail's Eraser, the dock's toolbar, or `X` still erase everything, and let go of the selection first (step 1).

## The edits

### Starting a tool from a layer's actions

`editorMode.ts`: `ToolStart` and `ToolMode` gain `on: string | null`, the layer
whose actions opened the tool. `toolMode` keeps it; every existing
`startTool` dispatch passes `null`.

`useEditorTools.ts`:

- New `layerStarters: ToolStarters`, one per tool: `prepare`, then dispatch `startTool` with `on` set to the selected layer's id, without `startsUnselected`'s deselect.
- `finishTool` skips `deselectOnDone` when `mode.on` is set.
- Returned beside `startTool`.

`Editor.tsx`: `layerActions.startTool` is `layerStarters`, so
`LayerActionsPanel` and `LayerBar` open tools from the layer. Nothing else
changes there.

`defineTool.ts`'s `ToolEnv` gains `on: Layer | null`: the layer the open tool
was started from, while it's open and still in the document. (The hook runs
above the context, so it comes through `ToolEnv`.)

### The Eraser

`tools/eraser/eraserSpec.ts`: `actsOn` is back to
`(layer) => layer.type === "drawing" && !layer.locked`.

`tools/eraser/useEraserTool.ts`:

- `scope` in its canvas input is `on?.id ?? null`.
- When `scope` was set and `on` turns null (erased away), it calls `close()` after `notify`. The notice outlives the tool: it's the editor's.

### The scene

`canvasInputFor.ts`'s `outlinedLayerFor`: for an `erase` input with a scope,
the scoped layer.

`EditorScene.tsx`: new prop `protectedDim: string | null`, the scope. While
set, every drawing and shape but that one draws at about a third
(`DIMMED_OPACITY`, 0.33). `EditorCanvas.tsx` passes the scope of an `erase`
input.

`layers/drawing/DrawingLayerView.tsx`: new optional prop `opacity`, applied
on the drawing's own layer paint (`<Paint blendMode="multiply" opacity={…} />`,
or `<Paint opacity={…} />` for ink). Not a `Group` around it: a saved layer
around a multiplying drawing would multiply onto that layer alone, so a
dimmed highlight would stop darkening the photo. The `docs/interactive`
lessons draw this view without the prop.

`layers/LayerContent.tsx`: passes `opacity` through to the drawing view.

## Tests

- `layers/drawing/__tests__/drawingEdits.test.ts`: `eraseStroke` with a scope adds nothing to a second drawing it crosses and removes no shape (written in step 1; check it covers this).
- `store/__tests__/editorSlice.test.ts`: "erasing a selected drawing leaves others, and it stays selected"; "erasing it away clears the selection".
- `__tests__/editorMode.test.ts`: `startTool` keeps `on`; a start without it has `on: null`.
- `__tests__/editorChrome.test.ts` (`layerActionsFor`): a drawing offers Pen and Eraser; a locked drawing, a shape, text, and a redaction don't offer Eraser.
- `__tests__/canvasInputFor.test.ts`: `outlinedLayerFor` outlines the scoped drawing for a scoped `erase` input, and nothing for an unscoped one.

## Docs and lessons

- docs/architecture.md: `editorMode.ts`'s `on`; `useEditorTools`'s layer starters ("A tool opened from a layer's actions keeps the selection and skips `deselectOnDone`"); `ToolEnv`'s `on` in the tool definition bullet.
- DESIGN.md: other marks dimmed to a third during Erase on a mark.
- No lesson draws the dimmed scene; `pnpm --dir docs/interactive build` confirms `DrawingLayerView`'s prop stays optional.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Draw a highlight, then a pen circle over it in another session. Select the highlight, Erase: the circle dims, the highlight keeps its outline and still multiplies onto the photo. Erase its overhang across the circle: the circle is untouched. ✓: the highlight is selected again.
- ✕ after erasing: nothing changed, no undo step.
- Erase a selected drawing away: the tool closes, the toast's Undo brings it back.
- A shape crossed during Erase on a mark stays, and doesn't dim further.
- With a drawing selected on a wide window, the rail's Eraser lets go of it and erases everything.
- Lock a drawing: its actions show no Erase.

Only a phone: whether a third reads as "out of reach" over a busy photo in daylight.
