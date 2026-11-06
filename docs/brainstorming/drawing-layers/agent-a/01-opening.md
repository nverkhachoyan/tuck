# Opening Statement — Position A: Honest Clear Eraser, Stroke Eraser, and Top-Drawing Continuation

Position A (`recommendation.md`: Ideas 1+2+3+5+7a) delivers the markup experience of Apple Markup and Goodnotes while preserving Tuck's non-destructive layer architecture, pixel-exact rendering, and plain-TypeScript model boundary.

## Core Claims

### A1. Unscoped erasing with zero selection narrowing eliminates modal friction (Criterion 1: Immediate Utility & Mental Model — 30%)
Today, `drawStroke` (`src/editor/layers/drawing/drawingEdits.ts` L28–47) scopes an eraser to `selectedLayerId`, whereas `erasesShape` (`src/editor/layers/shape/shapeGeometry.ts` L121–146) deletes any unlocked, visible `ShapeLayer`. With no drawing selected, `LiveStroke.targetId` is `null` (`src/editor/canvas/useToolStroke.ts` L118–123), `EditorScene` (`src/editor/EditorScene.tsx` L129, L151) and `NewLayerStroke` (`src/editor/canvas/LiveStrokeOverlay.tsx` L168) draw nothing, and dragging is a no-op. Position A makes `drawStroke` add an eraser stroke to every unlocked, visible `DrawingLayer` whose padded strokes it crosses, shares one live `strokePath` (`LiveStrokeOverlay.tsx` L231) across unlocked visible drawings, and clears selection on open.
- **Why Position C's narrowing fails:** Switching from Pen to Eraser (`startTool`, `src/editor/useEditorTools.ts` L139–161) commits Pen's session without running `finishTool`'s `deselectOnDone` (L116), leaving the new drawing selected (`outlinedLayer`, `EditorScene.tsx` L200–202). Even narrowed only from layer actions (Position C), scoping creates a hidden two-mode rule violating `PRODUCT.md` L13 ("won't learn it, set it up, or read about it first"). Clearing selection guarantees one rule; `undo` (`src/editor/store/editorSlice.ts` L496–509) is the safety net.

### A2. Pixel-exact `blendMode: "clear"` plus whole-stroke pruning preserves visual fidelity (Criterion 2: Visual & Geometric Fidelity — 25%)
Each `DrawingLayer` renders in `<Group layer={multiply ? <Paint blendMode="multiply" /> : true}>` (`src/editor/layers/drawing/DrawingLayerView.tsx` L79), where `brushPaint` (L147–154) draws erasers with `blendMode: "clear"`, guaranteeing zero visual shift on release.
- **Why Position B's path cutting (Idea 4) fails Criterion 2:** `strokePath` (`DrawingLayerView.tsx` L32–50) builds quadratic midpoint curves (`quadTo`). Flattening and splicing polylines in `src/editor/layers/strokes.ts` causes five visual defects (`ideas.md` L108–116, `review.md` L12):
  1. **Round-cap over-erasing:** Keeping round caps outside the swath removes `~(strokeWidth/2)/sin(θ)` extra ink at shallow angles `θ`.
  2. **Square-cap protrusion:** Highlighter (`tip: "marker"`) and Marker (`tip: "ink"`) use `strokeCap: "square"` (`DrawingLayerView.tsx` L155–159), poking corners `~0.2×width` into the swath.
  3. **Self-overlap darkening:** Marker draws as one path at `MARKER_OPACITY = 0.45` (`DrawingLayerView.tsx` L15, L145, L164). Cutting a loop into two `Stroke`s double-composites overlaps at `69.75%` opacity far from the eraser.
  4. **Neon glow bleed:** `BrushStroke` (`DrawingLayerView.tsx` L108–134) blurs `NEON_GLOW = 0.55` (`NEON_GLOW_BLUR = 0.16`); cut ends bleed glow into the gap.
  5. **Lift-off jump:** The live `clear` swath jumps into deformed cut geometry on release.
- **Why Idea 2 beats Position C:** In `strokes.ts`, `penExtent` (L48–64), `drawingBox` (L71–84), `recenterDrawing` (L91–108), and `hitTestDrawing` (L202–213) ignore `type: "eraser"`. Position A makes `hitTestDrawing` check later erasers *and* prunes whole pen strokes covered by later erasers (plus orphaned erasers and empty `DrawingLayer`s), shrinking boxes when strokes are erased away instead of keeping bloated bounds.

### A3. Stroke Eraser + Top-Drawing Continuation complete the workflow (Criterion 1 — 30% & Criterion 3: Non-Destructive Layer & Editing Flexibility — 20%)
- **Stroke eraser (Idea 3):** Adding `Stroke eraser` alongside `Eraser` in `src/editor/tools/eraser/eraserTool.ts` (matching `variants` in `src/editor/tools/pen/penTool.ts` L15–23) removes touched pen strokes whole without storing `type: "eraser"`, with UI-thread fade in `DrawingLayerView.tsx` and `ShapeLayer` fade via workletized `shapeOutline`/`erasesShape` (`shapeGeometry.ts` L69, L121). Position C omits both, leaving whole-shape deletion (`drawingEdits.ts` L38–45) unpreviewed.
- **Top-drawing continuation (Idea 5) + Row polish (Idea 7a):** Because `penTool` sets `deselectOnDone: true` (`penTool.ts` L13), every Done + re-entry creates a new `DrawingLayer` (`drawingEdits.ts` L59), flooding `LayerRow.tsx` (L270) with `"Drawing"` rows. Joining an unlocked topmost `DrawingLayer` with matching `layerBlend` (`drawing.ts` L50–52) when unselected stops row spam upfront while preserving stacking (`PRODUCT.md` L58).

### A4. Clean module boundaries and v5 compatibility (Criterion 4: Architectural & Runtime Simplicity — 15% & Criterion 5: Backward Compatibility — 10%)
Crossing, pruning, and hit-testing stay plain TypeScript and `"worklet"` helpers in `strokes.ts` and `shapeGeometry.ts`, keeping `pnpm test` and `docs/interactive/src/lessons/model/StrokesLesson.tsx` green (`docs/architecture.md` L54, L182) with zero changes to v5 `src/projects/projectFile.ts`. Position B's `mergeDrawings` (Idea 7b) breaks cross-layer Highlighter (`blend: "multiply"`) darkening (`docs/architecture.md` L153).

## Known Weaknesses

1. **Partly erased bounds:** Partially erased strokes aren't pruned, so `drawingBox` (`strokes.ts` L71) keeps their extent and stores `type: "eraser"`.
2. **Shared top drawing:** Consecutive ink sessions without an intervening layer share one `DrawingLayer` until Select (Idea 10) separates strokes.
3. **Conditional merge:** Upper drawings with partial `type: "eraser"` strokes cannot merge down without clearing lower ink.
