# Closing Statement — Position A

## Crux 1: `blendMode: "clear"` + Curve Pruning vs. Polyline Splicing
`PRODUCT.md` L17 is decisive: *"the image matters more than the tools."* Users export pixels, not `drawingBox` bounds. Position B concedes (`02-rebuttal.md` L11) polyline splicing causes five visual defects across all four tips (`DrawingLayerView.tsx` L15–24, L108–165) and jumps on release. Because `strokes.ts` serves brush `RedactionLayer`s (`layerTargets.ts` L55–57) and v5 projects (`projectFile.ts` L31), `hitTestDrawing` (`strokes.ts` L202–213) *must* check later erasers regardless. Position A's `clear` eraser plus curve pruning (`Idea 2`) keeps ink pixel-exact, shrinks boxes when whole strokes go, and keeps `stroke.points` sparse.

## Crux 2: Unscoped Erasing + Removing `eraserSpec.actsOn`
Position C identified a UX trap if `eraserSpec.actsOn` (`src/editor/tools/eraser/eraserSpec.ts` L11) stays while Eraser erases globally. Removing `actsOn` from `eraserSpec.ts` and clearing selection in `eraserTool.prepare` fixes `C1`'s trap without caller-origin state in `useEditorTools.ts` (`starters`, L224–229) or a hidden two-mode rule (`PRODUCT.md` L13).

## Crux 3: Gating Top-Drawing Continuation (`Idea 5`)
Position C (`C3`) notes auto-joining consecutive Pen sessions trades per-session transforms (`recenterDrawing`, `strokes.ts` L91–108) for fewer rows and interacts with `ShapeLayer`s (`ideas.md` L134–137). Position A (`recommendation.md` L36–41) isolates `Idea 5` (checking `document.layers.at(-1)`, never skipping shapes) in **Step 3**, gated on phone testing.

## Crux 4: `Stroke eraser` (`Idea 3`) + Live Fades
`layerTargets.ts` (L31, L58) precomputes `shapeOutline` on the JS thread, so UI-thread shape fading needs no worklet `WeakMap`. An optional fade `SharedValue` in `DrawingLayerView.tsx` leaves `DocumentRenderScene.tsx` and `docs/interactive` untouched while enabling one-swipe stroke removal.

## Final Revised Position
1. **Step 1 (Ideas 1+2):** Unscoped `clear` eraser, eraser-aware `hitTestDrawing`, curve-based stroke/eraser pruning, empty-layer deletion, live `ShapeLayer` fade, **removing `eraserSpec.actsOn` (`eraserSpec.ts` L11)**, and clearing selection on open.
2. **Step 2 (Idea 3):** `Stroke eraser` variant (`eraserTool.ts`) with optional `SharedValue` fade (`DrawingLayerView.tsx`).
3. **Step 3 (Ideas 7a+5):** `LayerRow.tsx` swatches/labels (`Idea 7a`); trial strict top-layer `Idea 5`.
