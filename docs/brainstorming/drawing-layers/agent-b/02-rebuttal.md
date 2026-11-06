## Rebuttal to Position A

### 1. Critiques of Specific Claims
- **Refuting `A4` on `mergeDrawings` and Highlighters:** `A4` falsely claims Position B's `mergeDrawings` (Idea 7b) "breaks cross-layer Highlighter (`blend: "multiply"`) darkening (`docs/architecture.md` L153)." Both `brief.md` (L30) and `ideas.md` (L174–175) explicitly restrict `mergeDrawings` to **ink drawings** (`layerBlend(layer) === undefined`, `src/editor/layers/drawing/drawing.ts` L50–52), never highlighters (`blend: "multiply"`). Because normal source-over ink compositing is associative, merging ink drawings is 100% visually exact (`ideas.md` L175). What breaks ink merging is Position A (`A1`, `A2`): injecting `type: "eraser"` strokes into every crossed `DrawingLayer` prevents merging any partially erased upper ink drawing because its `blendMode: "clear"` paths (`src/editor/layers/drawing/DrawingLayerView.tsx` L152) would punch holes through lower ink once inside one `<Group layer>` (L79).
- **Critiquing `A2` and `A4` on Whole-Stroke Pruning vs. Partly Erased Geometry:** `A2` claims Idea 2's whole-stroke pruning fixes model honesty while `A4` claims it keeps `src/editor/layers/strokes.ts` simple. First, `ideas.md` (L56) notes that pruning a pen stroke requires checking that *every point along its drawn quadratic curve* (`strokePath`, `DrawingLayerView.tsx` L32–50)—not just raw `points`—lies inside later erasers' reach minus visible pen/glow reach. Thus Position A must still flatten quadratic curves in `strokes.ts` at commit, yet discards that work for *partially* erased strokes. When a user trims 80% of a scribble, `penExtent` (`strokes.ts` L48–64), `drawingBox` (L71–84), and `recenterDrawing` (L91–108) keep the full unerased box and off-center pivot. Second, keeping partial `type: "eraser"` strokes permanently adds an $O(P \times E)$ inner loop over later erasers inside the UI-thread `"worklet"` `hitTestDrawing` (`strokes.ts` L202–213, called by `findLayerAt`, `src/editor/canvas/hitTest.ts` L52) and re-renders historical `clear` paths every frame (`DrawingLayerView.tsx` L80–88).

### 2. Rival's Strongest Point
Position A's strongest argument (`A2`) is that `blendMode: "clear"` (`DrawingLayerView.tsx` L147–154) guarantees pixel-exact identity between live drag preview and committed result across all four tips (`Pen`, `Highlighter`, `Marker`, `Neon`).

### 3. Concessions
We concede `A2`'s five visual defects of polyline cutting (`ideas.md` L108–116): shallow-angle round-cap over-erase, square-cap corner protrusion on `marker`/`ink` (`DrawingLayerView.tsx` L159), `MARKER_OPACITY = 0.45` (L15) double-darkening when a self-overlapping Marker loop splits into two `<Path>`s, `NEON_GLOW = 0.55` (`BlurMask`, L20, L118) bleeding into the cut, and lift-off jump.

### 4. Conditions Under Which Position A Should Win
Position A should win if **Criterion 2 (25%)** prioritizes pixel-exact live-to-commit brush appearance over exact bounding boxes (`drawingBox`) and rotation centers (`recenterDrawing`) on partly erased strokes, and if unconditional `mergeDrawings` (Idea 7b) is unnecessary before Select (Idea 10).

---

## Rebuttal to Position C

### 1. Critiques of Specific Claims
- **Refuting `C1` on `outlinedLayerFor` and `ToolStarters`:** `C1` claims opening Eraser from layer actions keeps the drawing outlined via `outlinedLayerFor` (`src/editor/canvasInputFor.ts` L139–166) and narrows erasing without new chrome. In the code, `outlinedLayerFor` (L153–156) only outlines when `restyles(input.tool, selectedLayer)` is true, and `CANVAS_TOOLS.draw.restyles` is `null` (`src/editor/canvas/canvasTool.ts` L71, L91–96)—so neither Pen nor Eraser outlines a selected `DrawingLayer` while open. Furthermore, `starters` in `src/editor/useEditorTools.ts` (L224–229) passes the identical zero-argument `() => startTool(next)` callback to the dock, rail, `X` shortcut, and layer actions (`src/editor/PanelViews.tsx`). Distinguishing *where* Eraser was clicked requires plumbing caller-origin state into `useEditorTools.ts` and `editorMode.ts` to enforce a hidden two-mode rule users won't discover (`PRODUCT.md` L13).
- **Refuting `C4` on Point-Only Emptiness Checks and `shapeOutline` Worklets:**
  1. `C4` deletes a `DrawingLayer` "when no pen stroke has any uncovered sample points left" (`brief.md` L38). A straightened line (`straightStroke`, `strokes.ts` L182–195) or fast swipe has only two sample points (`[x0, y0, x1, y1]`). Erasing just its two endpoints leaves the middle 80% visible on screen, yet Position C's point-only check deletes the entire `DrawingLayer`!
  2. `C4.2` claims fading shapes requires turning `shapeOutline` (`src/editor/layers/shape/shapeGeometry.ts` L69–76)—which caches outlines in a JS `WeakMap`—into a UI-thread worklet. In fact, `layerTargets` (`src/editor/canvas/layerTargets.ts` L16–37, L58) *already* calls `shapeOutline(layer)` on the JS thread using the `WeakMap` cache and attaches `strokes: MaskStroke[]` to each `LayerTarget` (`src/editor/canvas/hitTest.ts` L27) sent to the UI thread (`ideas.md` L27). `shapeOutline` never runs on the UI thread.
- **Critiquing `C3` on Omitting Stroke Eraser & Continuation:** Rejecting Ideas 3 and 5 forces tedious back-and-forth scrubbing to remove one scribble and floods `LayerRow.tsx` (L270) with separate rows on every Done (`penTool.ts` L13).

### 2. Rival's Strongest Point
Position C's strongest argument (`C3`) is that keeping one `DrawingLayer` per Pen session preserves independent movement, scaling, and deletion of marks across sessions before Select (Idea 10) exists (`PRODUCT.md` L58).

### 3. Concessions
We concede `C2` that `blendMode: "clear"` avoids Idea 4's cut-end visual artifacts, and `C3` that top-drawing continuation (Idea 5) merges consecutive same-blend Pen sessions into one transform until Idea 10 separates strokes.

### 4. Conditions Under Which Position C Should Win
Position C should win only if engineering scope is strictly capped at an **XS/S** hotfix (after replacing `C4`'s broken endpoint-only deletion check with curve sampling) and per-session layer transforms outweigh layer-panel clutter and whole-stroke erasing.
