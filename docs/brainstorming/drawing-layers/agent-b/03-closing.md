# Position B Closing Statement

### Crux 1: `blendMode: "clear"` Pruning (A) vs. Polyline Splicing (B)
We concede (`A2`, `B4` critique) `hitTestDrawing` (`src/editor/layers/strokes.ts` L202–213) must check later `type: "eraser"` strokes for brush `RedactionLayer`s (`src/editor/canvas/layerTargets.ts` L55–57) and v5 files (`src/projects/projectFile.ts` L31), and `StrokesLesson.tsx` (L194–204) needs updating. Still, A's pruning (`ideas.md` L56) already runs quadratic-curve (`strokePath`, `DrawingLayerView.tsx` L32–50) coverage math on commit yet leaves 90%-erased strokes with bloated `drawingBox` bounds, off-center `recenterDrawing` pivots (`strokes.ts` L71–108), and unmergeable `clear` paths (`DrawingLayerView.tsx` L79). Post-cut Ramer–Douglas–Peucker (RDP) simplification prevents polyline bloat while keeping bounds exact and ink layers mergeable.

### Crux 2: Unscoped Erasing (A & B) vs. Action-Scoped Narrowing (C)
`eraserSpec.actsOn` (`src/editor/tools/eraser/eraserSpec.ts` L11) is a relic of single-layer erasing. Deleting `actsOn` removes the misleading layer-action button (`src/editor/editorChrome.ts` L36–46), preserving one `startTool` path (`src/editor/useEditorTools.ts` L224–229) and one rule (`PRODUCT.md` L13).

### Crux 3: Top-Drawing Continuation (A & B) vs. Session Isolation (C)
Strict top-layer continuation (`drawStroke` in `src/editor/layers/drawing/drawingEdits.ts` joining only when `document.layers.at(-1)` is an unlocked `DrawingLayer` with matching `layerBlend`, `drawing.ts` L50–52—never skipping shapes) stops consecutive Pen sessions from spamming rows while preserving paint order around shapes.

### Crux 4: `Stroke eraser` + Live Fade (A & B) vs. Deferring (C)
`Stroke eraser` (`Idea 3`) and UI-thread **shape fade** (using `LayerTarget.strokes` from `shapeOutline` in `layerTargets.ts` L58) need zero new props on `DrawingLayerView.tsx`. Per-stroke fade in `DrawingLayerView.tsx` can decouple if view churn is a concern.

## Final Revised Position
1. **Update `hitTestDrawing` & `StrokesLesson.tsx`:** Check later `eraser` strokes in `hitTestDrawing` (`strokes.ts` L202) for brush redactions and v5 files; update `StrokesLesson.tsx`.
2. **Simplify Cut Polylines (or Cut on Merge):** Run RDP simplification after splicing `strokePath` curves—or apply Idea 4 inside `mergeDrawings` (`Idea 7b`) if `blendMode: "clear"` parity on `marker`/`neon` tips takes priority.
3. **Remove `eraserSpec.actsOn` (`eraserSpec.ts` L11)** and ship **strict top-layer Idea 5** plus **`Stroke eraser` (Idea 3)**.
