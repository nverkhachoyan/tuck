# Debate Brief: Drawing, Erasing, and Layers

## 1. Decision to be Decided

**Question:** How should Tuck's Pen, Shape, and Eraser relate to drawing layers, and what model, rendering, and tool scope should we commit to building now?

Today (`current-model.md`), each Pen session creates its own `DrawingLayer` (`src/editor/layers/drawing/drawing.ts`), and `drawStroke` (`src/editor/layers/drawing/drawingEdits.ts`) scopes an eraser stroke strictly to `selectedLayerId`, while removing any unlocked, visible `ShapeLayer` it crosses regardless of selection. When no drawing is selected, the eraser shows no live swath and changes nothing. Furthermore, `hitTestDrawing`, `drawingBox`, and `recenterDrawing` (`src/editor/layers/strokes.ts`) ignore eraser strokes entirely—leaving erased ink tappable, bounding boxes oversized, and fully erased drawings as invisible ghost rows in the Layers panel.

Three competing architectural positions are on the table:

### Position A — Honest Clear Eraser + Stroke Eraser + Top-Drawing Continuation (The `recommendation.md` Phased Package: Ideas 1 + 2 + 3 + 5 + 7a)
Keep `DrawingLayer` as a layer per place in the stack and keep pixel-exact `blendMode: "clear"` erasing as the default eraser, shipping in three tight steps without changing the saved project format:
1. **Unscoped Clear Eraser + Honest Model (Ideas 1 + 2):**
   - `drawStroke` adds an eraser stroke to every unlocked, visible `DrawingLayer` whose padded strokes it crosses (sharing a crossing helper with `erasesShape`), and `EditorScene` renders one shared live eraser path across all unlocked visible drawings.
   - `hitTestDrawing` counts a pen stroke as hit only where no later eraser stroke covers the point.
   - Whole pen strokes whose drawn curves lie completely within later erasers' reach (minus visible pen/glow reach) are pruned on commit, orphaned eraser strokes with no earlier overlapping pen strokes are dropped, and emptied `DrawingLayer`s are deleted automatically.
   - Eraser clears selection on open (no selection narrowing); shapes about to be removed fade live on the UI thread.
2. **Stroke Eraser Variant (Idea 3):**
   - Add a second variant to Eraser (`Eraser` default partial vs. `Stroke eraser` whole-stroke in `EraserPanel`, `EraserBar`, and toolbar flyout) that removes touched pen strokes whole without storing eraser strokes, with live UI-thread per-stroke fade in `DrawingLayerView`.
3. **Fewer, Clearer Drawing Rows (Ideas 5 + 7a):**
   - Add color swatches and kind labels ("Drawing", "Highlight") in `LayerRow.tsx`, and have `drawStroke` join the topmost layer when nothing joinable is selected and that top layer is an unlocked `DrawingLayer` with matching blend. Reject geometric path cutting (Idea 4) and defer `mergeDrawings` (Idea 7b).

### Position B — Geometric Vector Erasing + Mergeable Ink Architecture (True Path Cutting, No Stored Eraser Strokes: Ideas 1 + 3 + 4 + 5 + 7)
Instead of proliferating `blendMode: "clear"` eraser strokes into every crossed `DrawingLayer` and relying on a whole-stroke pruning heuristic (Idea 2) that leaves partly erased strokes with oversized bounding boxes and unmergeable eraser history, make erasing truly geometric across the model:
1. **Geometric Vector Cutting for Partial Erasing (Ideas 1 + 4):**
   - Flatten `strokePath`'s quadratic midpoint curves into dense polylines in plain TypeScript (`src/editor/layers/strokes.ts`) and splice each crossed pen stroke into the remaining intervals outside the eraser capsule's reach.
   - Stop storing `type: "eraser"` strokes on `DrawingLayer` (keeping legacy `type: "eraser"` support in `isStroke`/`DrawingLayerView` for v5 backward compatibility, or upgrading on open).
   - Because erased ink is gone from `layer.strokes`, `drawingBox`, `recenterDrawing`, and `hitTestDrawing` become automatically exact on partly and wholly erased strokes alike—with zero runtime loop over later eraser strokes during UI-thread hit-testing.
2. **Stroke Eraser + Top-Drawing Continuation + Merge Down (Ideas 3 + 5 + 7):**
   - Ship the whole-stroke **Stroke eraser** (Idea 3), top-drawing continuation (Idea 5), row swatches/labels (Idea 7a), and **Merge down** (`mergeDrawings` in `drawingEdits.ts`, Idea 7b)—which works unconditionally on any two adjacent ink drawings because upper drawings never carry stored `clear` strokes that would punch holes in lower drawings.

### Position C — Minimal Scoped Fix: Unscoped Default + Action-Scoped Narrowing + Session Isolation (Idea 1 + Minimal Idea 2 + Open Question 1b; Defer Ideas 3, 4, 5)
Solve the core user pain ("eraser does nothing when unselected / can't erase across drawings") with the smallest, safest surface area while preserving independent per-session layers and intentional single-layer erasing:
1. **Unscoped Clear by Default, Narrowed When Opened from Layer Actions (Idea 1 + Open Question 1b):**
   - Opening Eraser from the dock/rail clears selection and erases across all unlocked, visible drawings it crosses (`drawStroke` + shared live path in `EditorScene`).
   - Opening Eraser explicitly from a selected drawing's layer action bar keeps that drawing selected and outlined (`outlinedLayer`), scoping the eraser to that drawing alone (Illustrator's rule)—giving users a discoverable way to erase one drawing without hunting for Lock in the Layers panel.
2. **Minimal Honest Hit-Testing & Empty-Layer Cleanup (Minimal Idea 2, No Per-Frame UI Fade Worklets):**
   - Update `hitTestDrawing` (`src/editor/layers/strokes.ts`) to check that no later eraser stroke covers the hit point, and remove a `DrawingLayer` when no pen stroke has any uncovered sample points left—without complex curve-width pruning or threading shared-value fade sets into `DrawingLayerView` / `LayerContent`.
3. **Preserve One Layer per Pen Session & Single Eraser Tool (Reject Idea 5 Auto-Join; Defer Idea 3 Stroke Eraser):**
   - Keep `deselectOnDone: true` starting a new `DrawingLayer` on each new Pen session (plus row swatches/labels from Idea 7a) so marks drawn in separate sessions can still be moved, reordered, or deleted independently ("nothing is final until export") without waiting for the unbuilt Select tool (Idea 10).
   - Keep Eraser as a single-mode tool (no variant flyout) until user feedback after unscoped erasing ships demonstrates a need for a second eraser mode.

---

## 2. Weighted Evaluation Criteria

All agents must frame their arguments and trade-offs explicitly against these five criteria (summing to **100%**):

| Criterion | Weight | Description |
| :--- | :---: | :--- |
| **1. Immediate Utility & Mental Model (`PRODUCT.md`)** | **30%** | "Seconds, not sessions; a utility, not a studio." Does erasing work the moment a user picks the tool without layer-management friction, surprise deletions, or hidden modal rules? |
| **2. Visual & Geometric Fidelity** | **25%** | Does ink look identical during the live drag and after release (round/square caps, Marker 45% self-overlap, Neon glow, Highlighter multiply), and do selection boxes and tap hit-tests match visible ink? |
| **3. Non-Destructive Layer & Editing Flexibility** | **20%** | "Nothing is final until export." Can users still move, reorder, restyle, or isolate annotations across sessions, and protect marks they want to keep? |
| **4. Architectural & Runtime Simplicity** | **15%** | Respects module boundaries (`document/` and `layers/*.ts` stay plain TS; `render/` and layer views take plain props; UI-thread worklets stay fast; `docs/interactive` lessons keep building) with minimal complexity. |
| **5. Backward Compatibility & Evolution Path** | **10%** | Saved v5 projects (`src/projects/projectFile.ts`) continue to open cleanly, and the model leaves a clean path toward future tools (e.g., Select / Idea 10) without dead-end state. |

---

## 3. Hard Constraints

Any valid proposal must satisfy these non-negotiable invariants from `AGENTS.md`, `PRODUCT.md`, and `docs/architecture.md`:
1. **Straight onto the canvas:** Document layers must render directly onto the main Skia canvas (`EditorScene.tsx`, `DocumentRenderScene.tsx`), never inside a compositing container group, so redaction `BackdropFilter`s blur the underlying photo and highlighter `blendMode="multiply"` groups blend onto what is beneath them.
2. **Highlighter isolation:** Each `DrawingLayer` renders inside its own Skia `<Group layer={...}>` (`DrawingLayerView.tsx` L79) so `blendMode: "clear"` only clears that drawing's earlier strokes, and highlighter layers (`blend: "multiply"`) multiply as a single group onto the scene below.
3. **Plain TypeScript model boundary:** `src/editor/document/` and lowercase `.ts` files in `src/editor/layers/` must remain pure TypeScript (no React, React Native, or Skia runtime calls) so Node's unit tests (`pnpm test`) execute them directly. Functions called from UI-thread gestures must carry `"worklet"` and declare helpers above callers.
4. **Interactive docs compatibility:** `docs/interactive/src/lessons/model/StrokesLesson.tsx` (551 lines) imports `addStroke`, `recenterDrawing`, `createDrawingLayer`, `drawingBox`, `hitTestDrawing`, `drawStroke`, and `findLayerAt` by name for `SourceView`, and rendering lessons mount `DrawingLayerView` / `LayerContent`. Any change must keep `pnpm --dir docs/interactive build` green.
5. **Saved project compatibility:** Existing v5 projects (`src/projects/projectFile.ts`) containing `DrawingLayer`s with `type: "pen"` and `type: "eraser"` strokes must continue to open and render accurately.

---

## 4. Shared Context & Precedent

All debaters start from these verified codebase facts (`e0b07fb`):
- **`src/editor/layers/drawing/drawing.ts` (81 lines):** Defines `PenTip` (`"marker" | "ink" | "neon"`), `Brush` (`pen` or `eraser`), `Stroke` (`Brush & { points: number[] }`), and `DrawingLayer` (`strokes: Stroke[]`, `blend?: "multiply"`). In the UI (`PenPanel.tsx`), no-tip is **Pen**, `marker` is **Highlighter** (`blend: "multiply"`), `ink` is **Marker** (45% opacity), and `neon` is **Neon**.
- **`src/editor/layers/drawing/drawingEdits.ts` (60 lines):** `drawStroke(document, selectedLayerId, stroke)` joins `selectedLayerId` if it is an unlocked `DrawingLayer` and either `stroke.type === "eraser"` or `strokeBlend(stroke) === layerBlend(target)`. Otherwise, if `stroke.type === "eraser"`, it only deletes unlocked visible `ShapeLayer`s where `erasesShape` returns true (L35–47) and drops the eraser stroke if no drawing was selected.
- **`src/editor/layers/strokes.ts` (213 lines):** Shared by `DrawingLayer` and brush `RedactionLayer` (`MaskStroke`). Contains `penExtent` (L48–64, ignores `eraser` strokes), `drawingBox` (L71–84, `WeakMap` cached), `recenterDrawing` (L91–108), `addStroke` (L114–134, transforms document points into layer space and divides `width` by `transform.scaleX`), and worklets `segmentDistanceSquared`, `nearLine`, `straightStroke`, and `hitTestDrawing` (L202–213, checks only `stroke.type === "pen"`).
- **`src/editor/layers/drawing/DrawingLayerView.tsx` (166 lines):** `strokePath(points)` (L31–50, worklet) builds quadratic curves through midpoints (`quadTo`). `DrawingLayerView` wraps strokes in `<Group layer={multiply ? <Paint blendMode="multiply" /> : true}>`. `BrushStroke` draws `neon` as 3 layered `<Path>`s (`NEON_GLOW = 0.55` with `BlurMask` `0.16`, `NEON_TUBE = 0.2`, `NEON_CORE = 0.08`), `marker`/`ink` with `strokeCap: "square"` (`MARKER_OPACITY = 0.45` for `ink`), and `eraser` with `blendMode: "clear"` and `strokeCap: "round"`.
- **`src/editor/layers/shape/shapeGeometry.ts` (147 lines):** `shapeOutline(layer)` (L69–76, `WeakMap` cached) converts a `ShapeLayer` (rectangle, ellipse, line, arrow) into `MaskStroke[]`. `erasesShape(layer, points, width)` (L121–146) steps along segments at intervals `<= reach` (`width / 2 / transform.scaleX`) and calls `hitTestDrawing`.
- **`src/editor/canvas/useToolStroke.ts` (128 lines), `LiveStrokeOverlay.tsx` (368 lines), `EditorScene.tsx` (236 lines):** `LiveStroke.targetId` is currently `string | null` (`selectedLayer.id` when `canAddTo(tool, selectedLayer)` is true, else `null`). `EditorScene` passes `stroke` only to the layer matching `stroke?.targetId === layer.id` (L129), and `NewLayerStroke` returns `null` for an eraser (L168).
- **`src/editor/tools/eraser/` (`eraserTool.ts` 14 lines, `useEraserTool.ts` 70 lines, `eraserSettings.ts` 59 lines, `EraserPanel.tsx` 47 lines):** Currently has no variants (`sizeIndex` only) and sets `deselectOnDone: true`.
- **`src/editor/layers/panel/LayersPanel.tsx` (537 lines) & `LayerRow.tsx` (343 lines):** `LayerRow` labels every drawing `"Drawing"` (`layerKindName` L270). When `document.groups.length > 0`, `LayerList` switches from `FlatLayerList` (which supports drag-to-reorder) to `GroupedLayerList` (`StaticLayerRow`, no drag-to-reorder).
