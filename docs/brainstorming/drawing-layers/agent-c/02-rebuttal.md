# Cross-Rebuttal — Position C

## Rebuttal to Position A

### 1. Critiques of Specific Claims
- **Against `A1` (Unconditional deselection breaks `eraserSpec.actsOn`):** `A1` claims action-scoped narrowing creates a "hidden two-mode rule." Yet `src/editor/tools/eraser/eraserSpec.ts` (L11) declares `actsOn: (layer) => layer.type === "drawing"`, causing `layerActionsFor` (`src/editor/editorChrome.ts` L36–46) to surface an **Eraser** button inside a selected drawing's action bar (`src/editor/Editor.tsx` L470–477). Under `A1`, pressing a selected drawing's contextual **Eraser** action deselects that drawing and erases every layer—turning a layer action into a trap. Keeping selection only when launched from layer actions uses the exact visual contract (`outlinedLayerFor`, `src/editor/canvasInputFor.ts` L139–166 → `<SelectionOutline>`, `src/editor/EditorScene.tsx` L200–202) that `cut`, `adjust`, `editText`, and `redactBrush` already use.
- **Against `A3` & `A4` (`shapeOutline` cannot be trivially workletized, and fade props churn views):** `A3` and `A4` claim live fading is a simple `"worklet"` addition to `shapeOutline`/`erasesShape` (`src/editor/layers/shape/shapeGeometry.ts` L69, L121). However, `shapeOutline` reads `const outlines = new WeakMap<ShapeLayer, MaskStroke[]>()` (`shapeGeometry.ts` L61); Reanimated worklets cannot capture a host JS `WeakMap` on the UI runtime, which is why `layerTargets` (`src/editor/canvas/layerTargets.ts` L58) precomputes `shapeOutline` on the JS thread. Worse, per-stroke fading (`A3`) threads a `SharedValue` of hit stroke indices through `LayerContent.tsx` and `DrawingLayerView.tsx` (L70–92) into `<BrushStroke>`, complicating `render/`'s plain-props contract (`docs/architecture.md` L55).
- **Against `A3` (Idea 5 violates "nothing is final until export"):** `A3` claims auto-joining the topmost `DrawingLayer` preserves stacking (`PRODUCT.md` L58). Instead, it silently fuses separate Pen sessions into one `DrawingLayer`, shifting the rotation pivot via `recenterDrawing` (`src/editor/layers/strokes.ts` L91–108) and preventing users from moving or deleting Session 2's label independently of Session 1's arrow before Idea 10 exists (`ideas.md` L141). Nor does `A3` resolve Idea 5's shape dilemma (`ideas.md` L134–137): drawing Pen → Shape → Pen either fails to join or buries new ink *under* the shape.

### 2. Rival's Strongest Point
Position A's strongest argument (`A2`) is that whole-stroke pruning + orphan-eraser cleanup in `strokes.ts` shrinks `drawingBox` (`L71–84`) when whole strokes are erased inside a multi-stroke drawing, while retaining `blendMode: "clear"` fidelity.

### 3. Concessions
We concede (`A2`) that without whole-stroke pruning, erasing one entire stroke of a two-stroke drawing leaves `penExtent` (`src/editor/layers/strokes.ts` L48–64) spanning the erased stroke until the entire `DrawingLayer` has no uncovered pen points left.

### 4. Conditions Under Which Position A Should Win
Position A should win if user testing shows users frequently want one-swipe whole-stroke deletion (`Stroke eraser`, Idea 3) alongside partial erasing, and rarely move annotations from separate Pen sessions independently.

---

## Rebuttal to Position B

### 1. Critiques of Specific Claims
- **Against `B2` & Known Weakness 1 (Exact bounds do not justify five visual corruptions):** `B2` prioritizes shrinking `drawingBox` (`src/editor/layers/strokes.ts` L71–84) on partly erased strokes by flattening `strokePath`'s quadratic curves (`src/editor/layers/drawing/DrawingLayerView.tsx` L32–50) and splicing polylines. Yet `PRODUCT.md` L17 states *"the image matters more than the tools"*: users export rendered pixels, not bounding boxes. Splicing polylines breaks visual fidelity across all four brushes (`DrawingLayerView.tsx` L15–24, L108–165): round caps over-erase by $(w/2)/\sin\theta$ at shallow angles; square caps (`tip: "marker" | "ink"`) poke corners into the swath; cut Marker loops (`MARKER_OPACITY = 0.45`) double-darken to $69.75\%$ opacity at overlaps; Neon's `BlurMask` (`NEON_GLOW = 0.55`) blooms into the cut; and ink jumps on release when `LivePath`'s (`src/editor/canvas/LiveStrokeOverlay.tsx` L221–233) `blendMode: "clear"` preview swaps to cut geometry.
- **Against `B4` (Claim that `StrokesLesson.tsx` stays unchanged and compatible):** `B4` claims vector cutting keeps `docs/interactive/src/lessons/model/StrokesLesson.tsx` "unchanged, and `docs/interactive`-compatible." In fact, `StrokesLesson.tsx` L194–204 ("Erase across it") calls `addStroke` (L95), counts stored erasers via `layer.strokes.length - (pens ?? 0)` (L260), and explicitly teaches: *"An eraser is stored as a stroke too, so it moves with the drawing and can be undone. And `drawingBox` only counts pens, so erasing never shrinks the box."* Eliminating stored `type: "eraser"` strokes directly breaks the lesson's interactive state and text.
- **Against `B3` & `B5` (Premature optimization for unbuilt Ideas 7b and 10):** `B3` and `B5` justify polyline cutting to unlock unconditional `mergeDrawings` (Idea 7b) and stroke selection (Idea 10). Yet `mergeDrawings` still cannot merge Highlighter layers (`blend: "multiply"`, `ideas.md` L174) because separate `<Group layer={<Paint blendMode="multiply" />}>` wrappers (`DrawingLayerView.tsx` L79) darken where they cross (`docs/architecture.md` L153), and Idea 10 is an unbuilt **L**-sized refactor (`ideas.md` L237).

### 2. Rival's Strongest Point
Position B's strongest argument (`B2`/`B4`) is that splicing erased intervals out of `layer.strokes` at commit time makes `penExtent`, `drawingBox`, `recenterDrawing`, and `hitTestDrawing` (`src/editor/layers/strokes.ts`) automatically exact on partly erased strokes without accumulating `type: "eraser"` history.

### 3. Concessions
We concede (`B2`/`B3`) that storing `type: "eraser"` strokes leaves partly erased strokes with unshrunk bounding boxes and prevents merging an upper `DrawingLayer` containing erasers onto a lower `DrawingLayer`.

### 4. Conditions Under Which Position B Should Win
Position B should win if Tuck commits to shipping **Select** (Idea 10) and **Merge down** (Idea 7b) now, and replaces `LivePath`'s `blendMode: "clear"` preview with live geometry cutting so strokes never jump or double-darken on release.
