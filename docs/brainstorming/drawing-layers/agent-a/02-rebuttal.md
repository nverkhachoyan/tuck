# Cross-Rebuttal — Position A

## Rebuttal to Position B

### 1. Critiques of Specific Claims
- **Against `B2` & `B3` (25% Criterion 2 sacrifice for a rare power feature):** Position B sacrifices visual fidelity on *every* partial erase across all four pen tips (`DrawingLayerView.tsx` L15, L20–24, L147–165) just to shrink partially erased boxes (`B2`) and merge partially erased ink layers (`B3`). Every partial erase under `B2` jumps visibly on release when the `blendMode: "clear"` preview (`LiveStrokeOverlay.tsx` L231) swaps to cut polylines with over-erased round caps (`~(width/2)/sin(θ)`), protruding square-cap corners on Highlighter/Marker (`~0.2×width`), double-darkened Marker self-crossings (`MARKER_OPACITY = 0.45` compounding to `69.75%`), and Neon `BlurMask` (`NEON_GLOW = 0.55`) bleeding back into the gap (`ideas.md` L108–116). Moreover, `mergeDrawings` (`B3`) is *not* unconditional under Position B: two Highlighter (`blend: "multiply"`) layers cannot merge without losing cross-layer darkening (`docs/architecture.md` L153), and Idea 5 (`B1`) already stops ink rows from piling up.
- **Against `B4` & `B5` (Unchanged `hitTestDrawing` breaks v5 projects and brush redactions; dense polylines bloat runtime):** `B4` claims leaving `hitTestDrawing` (`src/editor/layers/strokes.ts` L202–213) "unchanged" is simpler and faster. That fails twice:
  1. `strokes.ts` is shared with brush `RedactionLayer`s (`layer.shape === "strokes"`, `src/editor/canvas/layerTargets.ts` L55–57), and `B5` keeps legacy `type: "eraser"` strokes in v5 projects (`src/projects/projectFile.ts` L31). Leaving `hitTestDrawing` unchanged leaves erased regions tappable in every opened v5 project and brush redaction.
  2. Flattening quadratic curves (`strokePath`, `DrawingLayerView.tsx` L32–50) into dense polylines multiplies `stroke.points` by 5–20×. Every pointer move in `findLayerAt` (`src/editor/canvas/hitTest.ts` L41–62) must test hundreds of segments in `nearLine` (`strokes.ts` L158–173), while re-feeding dense points into `strokePath`'s `quadTo` loop and bloating saved JSON. Position A's Idea 2 prunes covered strokes and orphaned erasers on commit, keeping `strokes` sparse. And contrary to `B4`, `StrokesLesson.tsx` (L195–205, L259–260) still needs updating because it counts `eraser` strokes.

### 2. Rival's Strongest Point
Position B's strongest argument is **`B2`**: when 90% of a stroke is erased, whole-stroke pruning (Idea 2) keeps the surviving 10%, leaving `drawingBox` (`strokes.ts` L71–84) and `recenterDrawing` (L91–108) oversized.

### 3. Concessions
We concede that under Position A, partially erased strokes keep their original `drawingBox` and `type: "eraser"` strokes, preventing an upper drawing with partial erasers from merging into a lower drawing (`B3`).

### 4. Conditions Under Which Position B Should Win
Position B should win only if: (a) Tuck drops Marker (`tip: "ink"`), Neon (`tip: "neon"`), and square-capped tips so polyline cutting matches `blendMode: "clear"`, or (b) Select (Idea 10) requires splitting single strokes into sub-strokes immediately.

---

## Rebuttal to Position C

### 1. Critiques of Specific Claims
- **Against `C1` (Factual error on `outlinedLayerFor` and hidden modal state):** `C1` claims opening Eraser from a selected drawing's layer actions outlines that drawing via `outlinedLayerFor` (`src/editor/canvasInputFor.ts` L139–166). In fact, `outlinedLayerFor` (L153–156) checks `restyles(input.tool, selectedLayer)` (`src/editor/canvas/canvasTool.ts` L91–96), and `CANVAS_TOOLS.draw.restyles` is `null` (`canvasTool.ts` L71)—so `outlinedLayerFor` returns `null` for drawings! Furthermore, `useEditorTools.ts` (`starters`, L224–229) binds toolbar, rail, shortcut `X`, and layer-action buttons (`src/editor/Editor.tsx` L470–477) to the same `() => startTool(next)` callback. Implementing `C1` requires threading caller-origin state into `startTool` to create a hidden two-mode eraser where identical drags erase either one layer or all layers—violating `PRODUCT.md` L13 ("won't learn it, set it up, or read about it first").
- **Against `C4` (Factual error on `WeakMap` worklets and broken point-only pruning):**
  1. `C4` claims live fading requires turning `shapeOutline` (`src/editor/layers/shape/shapeGeometry.ts` L69–76, which uses a JS `WeakMap`) into a per-frame UI worklet. Actually, `layerTargets` (`src/editor/canvas/layerTargets.ts` L31, L58) *already* calls `shapeOutline(layer)` on the JS thread and passes `strokes: MaskStroke[]` on `LayerTarget` to the UI thread (`review.md` L20, `recommendation.md` L84). Testing only the new eraser segment against `target.strokes` uses zero `WeakMap`s on the UI thread.
  2. `C4` deletes a `DrawingLayer` when "no uncovered pen points left" (testing only raw vertices `stroke.points`) without Idea 2's curve check. Because `strokePath` (`DrawingLayerView.tsx` L32–50) draws segments/curves *between* vertices, erasing just the two endpoints of a long line covers 100% of its `points` while the middle remains visible—causing Position C to delete visible ink!
- **Against `C3` & `C4` (Unfixed layer spam and missing Stroke Eraser):** Rejecting Idea 5 leaves `LayerRow.tsx` (L270) accumulating rows on every Pen Done (`penTool.ts` L13), and omitting Idea 3 (`Stroke eraser`) plus shape-fade previews leaves whole-shape deletion (`drawingEdits.ts` L38–45) unpreviewed.

### 2. Rival's Strongest Point
Position C's strongest argument is **`C3`**: keeping one `DrawingLayer` per Pen session lets users move marks from separate sessions independently before Select (Idea 10) exists.

### 3. Concessions
We concede that Idea 5 merges consecutive same-blend Pen sessions (with no intervening layer) into one `DrawingLayer`, and that Position C avoids adding a fade prop to `DrawingLayerView.tsx` and `LayerContent.tsx`.

### 4. Conditions Under Which Position C Should Win
Position C should win only if scope is restricted to an emergency `<1 day` patch where `S`-sized work (Stroke Eraser, curve-safe pruning, and live fade previews) cannot fit.
