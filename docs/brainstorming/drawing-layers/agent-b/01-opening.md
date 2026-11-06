# Position B Opening: Geometric Vector Erasing & Mergeable Ink Architecture

Position B (**Ideas 1 + 3 + 4 + 5 + 7**) eliminates the root defect in Tuck's drawing model: storing erasures as `blendMode: "clear"` paths (`type: "eraser"`) in `DrawingLayer.strokes` (`src/editor/layers/drawing/drawing.ts` L18, `src/editor/layers/drawing/DrawingLayerView.tsx` L147–153). Flattening `strokePath`'s quadratic curves in `src/editor/layers/strokes.ts` and splicing crossed pen strokes into surviving polyline intervals—paired with **Stroke eraser**, top-drawing continuation, and unconditional **Merge down**—outperforms Position A's clear-stroke proliferation and Position C's half-measures across all five criteria.

## Core Claims

### B1. Unscoped Dual-Mode Erasing & Top-Drawing Continuation Match User Mental Models
**Criterion 1: Immediate Utility & Mental Model (`PRODUCT.md`, 30%)**
Today, `drawStroke` (`src/editor/layers/drawing/drawingEdits.ts` L27–57) scopes erasers to `selectedLayerId`, `NewLayerStroke` (`src/editor/canvas/LiveStrokeOverlay.tsx` L168) renders `null` when unselected after `deselectOnDone: true` (`src/editor/tools/eraser/eraserTool.ts` L13), and each Pen session spawns an identical `"Drawing"` row (`src/editor/layers/panel/LayerRow.tsx` L270). Position B erases across all unlocked, visible `DrawingLayer`s and `ShapeLayer`s (Idea 1), adds **Stroke eraser** in `EraserPanel`/`EraserBar` alongside partial erasing (Idea 3, `prior-art.md` L37–38), continues the top unlocked `DrawingLayer` when blends match (`strokeBlend(stroke) === layerBlend(target)`, `drawingEdits.ts` L34, Idea 5), and adds row swatches/labels (`LayerRow.tsx`, Idea 7a). Unlike Position C—which omits Stroke eraser, keeps session clutter, and hides a modal rule scoping Eraser to one layer when opened from layer actions (`outlinedLayer`, `src/editor/EditorScene.tsx` L58)—Position B enforces one transparent rule (`PRODUCT.md` L55–59).

### B2. Vector Splicing Guarantees Exact Bounds, Centers, and Hit-Testing
**Criterion 2: Visual & Geometric Fidelity (25%)**
`penExtent` (`src/editor/layers/strokes.ts` L48–64) notes `"Erasing never shrinks it"` (L46), checking only `stroke.type === "pen"` (L54); `drawingBox` (L71–84), `recenterDrawing` (L91–108), and `hitTestDrawing` (L202–213) ignore erasers. Positions A and C keep `type: "eraser"` strokes and prune only *wholly* covered strokes (`ideas.md` L56–65): erasing 90% of a stroke leaves `drawingBox` spanning the erased 90% and `recenterDrawing` placing handles in empty air (`docs/interactive/src/lessons/model/StrokesLesson.tsx` L198–202). Position B flattens `strokePath` (`DrawingLayerView.tsx` L32–50) into a dense polyline and splices out intervals inside the eraser's capsule reach (`ideas.md` L104–106), making `penExtent`, `drawingBox`, `recenterDrawing`, and `hitTestDrawing` exact on partly and wholly erased strokes.

### B3. Eraser-Free Layers Unlock Unconditional `mergeDrawings`
**Criterion 3: Non-Destructive Layer & Editing Flexibility (20%)**
Each `DrawingLayer` composites in `<Group layer={multiply ? <Paint blendMode="multiply" /> : true}>` (`DrawingLayerView.tsx` L79) so `blendMode: "clear"` clears only that layer (`docs/architecture.md` L153). Position A injects `type: "eraser"` strokes into every crossed `DrawingLayer`, blocking `mergeDrawings` whenever an upper drawing has erasers that would punch holes through lower ink (`ideas.md` L173, `review.md` L16). Eliminating stored erasers lets `mergeDrawings` (`drawingEdits.ts`, Idea 7b) work unconditionally on adjacent ink drawings—pairing top-layer continuation (Idea 5) with manual merging (`PRODUCT.md` L58).

### B4. Commit-Time Geometry Beats Render & UI-Thread Worklet Loops
**Criterion 4: Architectural & Runtime Simplicity (15%)**
`findLayerAt` (`src/editor/canvas/hitTest.ts` L41–62) calls UI-thread `"worklet"` `hitTestDrawing` (`strokes.ts` L202–213); `DrawingLayerView` (L80–88) renders a `<BrushStroke>` per stroke; `StrokesLesson.tsx` (L16–20, L220–256) imports `addStroke`, `recenterDrawing`, `drawingBox`, `hitTestDrawing`, and `drawStroke`. Positions A and C accumulate `type: "eraser"` paths in `layer.strokes`, re-rendering `blendMode: "clear"` paths every frame and adding a nested loop over later erasers in UI-thread `hitTestDrawing` (`ideas.md` L55). Position B cuts intervals once at commit in pure TypeScript (`strokes.ts`), keeping `hitTestDrawing`, `penExtent`, `drawingBox`, and `recenterDrawing` fast, unchanged, and `docs/interactive`-compatible.

### B5. Seamless v5 Compatibility & Direct Path to Stroke Selection
**Criterion 5: Backward Compatibility & Evolution Path (10%)**
`PROJECT_VERSION = 5` (`src/projects/projectFile.ts` L31) validates strokes via `isStroke` (`drawing.ts` L23–31). Stopping `drawStroke` from writing `type: "eraser"` strokes needs no version bump (`current-model.md` L53) while `isStroke` and `DrawingLayerView` still read v5 erasers. Splicing strokes into discrete `Stroke` objects builds the geometry needed for **Select** (Idea 10, `ideas.md` L119–121, L224–236), whereas A and C leave entangled pen-plus-clear stacks.

## Known Weaknesses

1. **Cut-End Artifacts (Criterion 2):** Vector cutting alters stroke ends on release (`ideas.md` L108–116, `review.md` L12): round caps over-erase by $\sim\frac{\text{width}}{2\sin\theta}$ at shallow angle $\theta$; square-capped Marker/Highlighter corners (`DrawingLayerView.tsx` L159) poke in by $\sim 0.2\times\text{width}$; cut self-overlapping Marker loops (`MARKER_OPACITY = 0.45`, L15) double-darken at overlaps; and Neon's `BlurMask` (`NEON_GLOW = 0.55`, L20, L118) blooms into the swath, jumping after the live clear preview.
2. **Polyline Density & Effort (Criterion 4):** Flattening curves costs **M** effort (`ideas.md` L105–107, L117) and grows `points` arrays on cut strokes.
3. **Session Coupling (Criterion 3):** Top-drawing continuation (Idea 5, `ideas.md` L140–141) couples consecutive Pen sessions until Idea 10 ships.
