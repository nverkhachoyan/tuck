# Closing Statement — Position C

## Crux 1: `blendMode: "clear"` + Curve Pruning vs. Polyline Splicing
We side with **`blendMode: "clear"` + Idea 2 curve pruning**. Position B concedes (`02-rebuttal.md` L11) that polyline cutting causes five pixel defects (`DrawingLayerView.tsx` L15–24, L108–165) and jumps on release. Because `strokes.ts` serves brush `RedactionLayer`s (`layerTargets.ts` L55–57) and v5 files (`projectFile.ts` L31), `hitTestDrawing` (`strokes.ts` L202–213) must check later erasers regardless. Idea 2's curve check (`ideas.md` L56) prunes covered strokes and erasers safely.

## Crux 2: Unconditional Unscoped Erasing vs. Action-Scoped Narrowing
`eraserSpec.actsOn` (`src/editor/tools/eraser/eraserSpec.ts` L11) puts **Eraser** in a selected drawing's action bar (`editorChrome.ts` L36–46). Keeping `actsOn` while clearing selection turns that button into a trap:
1. Keep `actsOn`, pass a layer-action origin to `startTool` (`useEditorTools.ts` L224), and outline the target in `outlinedLayerFor` (`canvasInputFor.ts` L153); or
2. If one global rule wins (`PRODUCT.md` L13), **remove `actsOn` from `eraserSpec.ts`** and clear selection on open.

## Crux 3: Top-Drawing Continuation (`Idea 5`) vs. Per-Session Isolation
Before `Select` (`Idea 10`) exists, `Idea 5` fuses separate sessions into one `DrawingLayer`, shifting pivots (`recenterDrawing`, `strokes.ts` L91–108), violating *"Nothing is final until export"* (`PRODUCT.md` L58), and failing when shapes interleave (`ideas.md` L134–137). Per-session layers + `LayerRow.tsx` swatches (`Idea 7a`) preserve independent transforms.

## Crux 4: `Stroke eraser` & Live Fade Plumbing (`Idea 3`)
We concede `layerTargets.ts` (`L31, L58`) sends `shapeOutline` strokes to the UI thread, making **whole-shape fade** (`LiveShape`, `LiveStrokeOverlay.tsx` L102) cheap. We still defer `Stroke eraser` and **per-stroke fade**, which threads shared values into `DrawingLayerView.tsx` (`L70–92`).

## Final Revised Position
1. **Adopt Idea 2 curve pruning** with `blendMode: "clear"` and eraser-aware `hitTestDrawing`.
2. **Adopt UI-thread whole-shape fade** via `layerTargets.strokes`, deferring `Stroke eraser` (Idea 3) and per-stroke fade.
3. **Keep per-session `DrawingLayer`s** + `LayerRow.tsx` swatches (Idea 7a), rejecting Idea 5.
4. **Make `eraserSpec.actsOn` coherent:** pair with `outlinedLayerFor` narrowing, or remove `actsOn`.
