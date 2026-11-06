# Debate Synthesis: Drawing, Erasing, and Layers

## 1. Points of Agreement

Across three rounds of adversarial debate grounded in the codebase (`e0b07fb`), all three agents converged on or conceded the following facts and design commitments:

1. **Unscoped Default Erasing (`Idea 1`):**
   - Today's rule in `drawStroke` (`src/editor/layers/drawing/drawingEdits.ts` L27–57) and `LiveStroke.targetId` (`src/editor/canvas/useToolStroke.ts` L118–123)—which restricts erasing to `selectedLayerId` while `erasesShape` (`src/editor/layers/shape/shapeGeometry.ts` L121–146) deletes any crossed `ShapeLayer`—is broken UX when unselected.
   - Opening Eraser from the toolbar, rail, or `X` key must erase across every unlocked, visible `DrawingLayer` its generously padded path crosses, rendering one shared live `strokePath` (`src/editor/canvas/LiveStrokeOverlay.tsx` L231) across those layers in `src/editor/EditorScene.tsx` (L129).
2. **`hitTestDrawing` Must Be Eraser-Aware in `src/editor/layers/strokes.ts`:**
   - Debater B conceded (`agent-b/03-closing.md` L4) that even if `DrawingLayer` cut strokes geometrically, `strokes.ts` is shared with brush `RedactionLayer`s (`src/editor/canvas/layerTargets.ts` L55–57) and v5 saved projects (`src/projects/projectFile.ts` L31). Therefore, `hitTestDrawing` (`strokes.ts` L202–213) **must** verify that no later `type: "eraser"` stroke covers the tested point.
3. **Curve-Coverage Pruning Is Required (Raw Vertex Checking Fails):**
   - Debater C conceded (`agent-c/02-rebuttal.md` L14, `agent-c/03-closing.md` L4) that checking only raw `stroke.points` fails on 2-point lines (`straightStroke`, `strokes.ts` L182–195) or fast segments where an eraser covers both endpoints while leaving the middle 80% visible. Pruning whole pen strokes, dropping orphaned eraser strokes, and deleting emptied `DrawingLayer`s (`Idea 2`) must sample along the drawn quadratic midpoint curve (`strokePath`, `src/editor/layers/drawing/DrawingLayerView.tsx` L32–50).
4. **Live UI-Thread Shape-Removal Fade Is Cheap (`Idea 1`):**
   - Debater C conceded (`agent-c/03-closing.md` L15) that `layerTargets` (`src/editor/canvas/layerTargets.ts` L31, L58) *already* calls `shapeOutline(layer)` on the JS thread (using its `WeakMap` cache safely) and passes `strokes: MaskStroke[]` on each `LayerTarget` to the UI thread. Fading `ShapeLayer`s (`LiveShape` in `LiveStrokeOverlay.tsx` L102) as the eraser crosses them requires zero `WeakMap` access in UI worklets.
5. **Coherence on `eraserSpec.actsOn` (`src/editor/tools/eraser/eraserSpec.ts` L11):**
   - All three agents agreed that leaving `actsOn: (layer) => layer.type === "drawing"` in `eraserSpec.ts` while making Eraser unconditionally deselect the layer on open turns the selected drawing's contextual **Eraser** action button (`src/editor/editorChrome.ts` L36–46) into a UX trap.
6. **Layer Row Identification (`Idea 7a`):**
   - All three agents agreed `src/editor/layers/panel/LayerRow.tsx` (`L270`) should show a color swatch and distinguish `"Highlight"` (`blend: "multiply"`) from `"Drawing"`.
7. **Interactive Docs Update (`StrokesLesson.tsx`):**
   - Debater B conceded (`agent-b/03-closing.md` L4) that `docs/interactive/src/lessons/model/StrokesLesson.tsx` (L194–204, L259–260) explicitly teaches that erasing never shrinks `drawingBox` and counts `eraser` strokes, so any model change that shrinks boxes or prunes erasers must update `StrokesLesson.tsx` in the same commit.

---

## 2. Crux Analysis

### Crux 1: Stored `blendMode: "clear"` + Whole-Stroke Curve Pruning (Position A) vs. Geometric Polyline Splicing (Position B)
- **What it hinges on:** Whether Criterion 2 (25% Visual & Geometric Fidelity) and Criterion 4 (15% Simplicity) are hurt more by **live-to-commit visual defects across all four brushes** (Position B) or by **unshrunk `drawingBox` bounds and unmergeable `clear` strokes on partially erased strokes** (Position A).
- **How the evidence resolves it:** **Resolved in favor of Position A (`blendMode: "clear"` + `Idea 2` curve pruning).**
  - Debater B conceded all five visual regressions of polyline cutting (`agent-b/02-rebuttal.md` L11): (1) round-cap over-erase by $\sim(w/2)/\sin\theta$ at shallow angles, (2) square-cap corner protrusion on `marker` and `ink` tips (`DrawingLayerView.tsx` L159), (3) `MARKER_OPACITY = 0.45` (L15) compounding to $69.75\%$ opacity when a self-overlapping Marker loop is cut into separate `<Path>`s, (4) `NEON_GLOW = 0.55` (`BlurMask`, L20, L118) blooming back into the cut gap, and (5) visible jump on finger release when `LivePath`'s `blendMode: "clear"` preview swaps to cut geometry.
  - Under `PRODUCT.md` L17 (*"the image matters more than the tools"*), degrading exported pixel fidelity across all four pen tips to tighten selection boxes on *partially* erased strokes is a net loss on Criterion 2 (25%).
  - Furthermore, Debater A proved (`agent-a/02-rebuttal.md` L8) that `hitTestDrawing` (`strokes.ts` L202–213) cannot stay unchanged under Position B because brush `RedactionLayer`s and v5 files still use `type: "eraser"` strokes. Position A's `Idea 2` prunes wholly erased pen strokes and orphaned erasers while keeping partial erasures pixel-exact.

### Crux 2: Unconditional Unscoped Erasing + Removing `eraserSpec.actsOn` (Positions A & B) vs. Contextual Action-Scoped Narrowing (Position C)
- **What it hinges on:** Whether `eraserSpec.actsOn` (`src/editor/tools/eraser/eraserSpec.ts` L11) should be **removed** so Eraser is always a document-wide tool that clears selection on open, or **kept** by plumbing caller-origin state into `startTool` (`src/editor/useEditorTools.ts` L224–229) and teaching `outlinedLayerFor` (`src/editor/canvasInputFor.ts` L153–156) to outline drawings.
- **How the evidence resolves it:** **Resolved in favor of Positions A & B (Revised): remove `actsOn` from `eraserSpec.ts` and clear selection when Eraser opens.**
  - Debaters A and B proved from the code (`agent-a/02-rebuttal.md` L25, `agent-b/02-rebuttal.md` L21) that `CANVAS_TOOLS.draw.restyles` is `null` (`src/editor/canvas/canvasTool.ts` L71) so `outlinedLayerFor` never outlines a `DrawingLayer` today, and `starters` in `useEditorTools.ts` (L224–229) uses a single zero-argument `() => startTool(next)` callback across dock, rail, `X`, and layer actions.
  - Crucially, Debater C exposed why `recommendation.md` Open Question 1 had lingering tension: `eraserSpec.ts` L11 still had `actsOn: (layer) => layer.type === "drawing"`. Once `actsOn` is removed from `eraserSpec.ts` (which neither `Shape` nor `Pen` sets on drawings) and Eraser clears selection on open (`prepare`), the UX trap disappears completely: there is no contextual "Erase this drawing" button to mislead the user, no hidden two-mode rule (`PRODUCT.md` L13), and no need to thread caller-origin flags through `useEditorTools.ts`.

### Crux 3: Top-Drawing Continuation (`Idea 5`, Positions A & B) vs. Per-Session Layer Isolation (Position C)
- **What it hinges on:** Before the `Select` tool (`Idea 10`) exists to split strokes apart, does `PRODUCT.md` (*"Seconds, not sessions"* vs. *"Nothing is final until export"*) favor auto-joining consecutive same-blend Pen sessions when no other layer sits between them (`Idea 5`), or keeping each Pen session as its own movable `DrawingLayer`?
- **How the evidence resolves it:** **Resolved as a sequenced, reversible step (Position A's Step 3, strict top-layer only).**
  - Debater C made a strong, evidence-backed point on Criterion 3 (20%): because `recenterDrawing` (`strokes.ts` L91–108) recomputes a single bounding box and rotation pivot over all pen strokes in a `DrawingLayer`, fusing Session 1 (e.g., an arrow) and Session 2 (e.g., a handwritten label) prevents moving or deleting them independently before `Select` (`Idea 10`) exists, and interleaving `ShapeLayer`s (`ideas.md` L134–137) either stops continuation or buries new ink under shapes.
  - However, once Step 1 (unscoped erasing + `Idea 2` pruning) and `Idea 7a` (`LayerRow.tsx` swatches/labels) ship, erasing no longer depends on how many `DrawingLayer`s exist. Sequencing `Idea 5` (strictly checking `document.layers.at(-1)` with matching `layerBlend`, never skipping shapes) in **Step 3** after Steps 1–2 allows evaluating on device whether row accumulation still bothers users once empty layers auto-delete and rows have color swatches.

### Crux 4: Shipping `Stroke eraser` + Live UI-Thread Removal Fade Now (`Idea 3`, Positions A & B) vs. Deferring Variants & Fade Plumbing (Position C)
- **What it hinges on:** Whether `Stroke eraser` (`Idea 3`) and live UI-thread fade previews for shapes and individual strokes justify the view/worklet plumbing in the initial build.
- **How the evidence resolves it:** **Resolved in favor of shipping `Stroke eraser` (`Idea 3`) + UI-thread `ShapeLayer` fade (`Idea 1`), with optional `SharedValue` per-stroke fade in `DrawingLayerView.tsx`.**
  - Whole-stroke removal (`Stroke eraser`) writes no `type: "eraser"` stroke (`ideas.md` L86)—it simply drops touched pen strokes and deletes the `DrawingLayer` if empty—reusing the exact crossing helper built in Step 1 and the existing `variants` pattern in `src/editor/tools/pen/penTool.ts` (L15–23).
  - For live fade previews: `ShapeLayer` fade in Step 1 uses `LayerTarget.strokes` (`layerTargets.ts` L58) and `LiveShape` (`LiveStrokeOverlay.tsx` L102) without touching `DrawingLayerView.tsx`. In Step 2 (`Stroke eraser`), an optional `fadedStrokes?: SharedValue<number[]>` prop on `DrawingLayerView.tsx` (defaulting to `undefined`) keeps `DocumentRenderScene.tsx` and `docs/interactive` lessons 100% source-compatible while giving immediate visual and haptic feedback before a whole stroke is removed.

---

## 3. Conditional Winners

- **Position A (Revised) wins when:** Pixel-exact visual consistency between live drag and committed ink across all four pen tips (`Pen`, `Highlighter`, `Marker`, `Neon`) is non-negotiable, erasing must obey a single zero-setup rule across the canvas, and users benefit from both partial (`Eraser`) and whole-stroke (`Stroke eraser`) removal. *(Matches Tuck's current architecture and `PRODUCT.md`.)*
- **Position B wins when:** Tuck prioritizes stroke-level vector manipulation (`Select`, `Idea 10`) and arbitrary multi-layer ink merging (`mergeDrawings`, `Idea 7b`) in the current milestone, and is willing to either replace `LivePath`'s `blendMode: "clear"` preview with live geometry cutting or accept cut-end artifacts on `Marker` and `Neon` strokes.
- **Position C wins when:** Engineering scope is constrained to a minimal bug-fix patch (`<1–2 days`), moving separate Pen sessions independently on the canvas is prioritized above preventing `"Drawing"` row accumulation, and a single-mode Eraser without a variant flyout is preferred.

---

## 4. Final Recommendation

Adopt **Position A (Revised)**, incorporating the concrete refinements surfaced by Debater C in Cruxes 2 and 3. Evaluated against `brief.md`'s weighted criteria:

| Criterion | Weight | Position A (Revised) | Position B | Position C (Revised) | Why Position A (Revised) Leads |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **1. Immediate Utility & Mental Model** | **30%** | **5 / 5** | 4.5 / 5 | 3.5 / 5 | Unscoped default erasing + removing `eraserSpec.actsOn` leaves one transparent rule (`PRODUCT.md` L13); includes both partial `Eraser` and `Stroke eraser`. |
| **2. Visual & Geometric Fidelity** | **25%** | **4.5 / 5** | 2.5 / 5 | 4.0 / 5 | Keeps pixel-exact `blendMode: "clear"` across all 4 tips (no release jump, Marker double-darkening, or Neon glow bleed) while shrinking boxes when whole strokes are erased. |
| **3. Non-Destructive Layer Flexibility** | **20%** | **4.0 / 5** | 4.0 / 5 | **4.5 / 5** | Sequencing `Idea 5` (strict top-layer continuation) in Step 3 after `Idea 7a` swatches lets device testing verify session-move trade-offs before committing. |
| **4. Architectural & Runtime Simplicity** | **15%** | **4.5 / 5** | 3.0 / 5 | **4.5 / 5** | Pure TS in `strokes.ts`, reuses `layerTargets.ts` `shapeOutline` cache for shape fade, avoids dense polyline bloat in `nearLine` and project JSON. |
| **5. Backward Compatibility & Evolution** | **10%** | **5 / 5** | 4.0 / 5 | 4.5 / 5 | Zero v5 `projectFile.ts` format changes; `hitTestDrawing` works identically on v5 files and brush `RedactionLayer`s; clean path to `Select` (`Idea 10`). |
| **Weighted Total** | **100%** | **4.60 / 5.00** | **3.63 / 5.00** | **4.03 / 5.00** | |

### Concrete Action Plan
1. **Step 1 — Unscoped Clear Eraser + Honest Model (`Ideas 1 + 2` + `Crux 2` fix):**
   - In `src/editor/layers/drawing/drawingEdits.ts` (`drawStroke`), apply eraser strokes to every unlocked, visible `DrawingLayer` whose generously padded strokes the eraser crosses (sharing the segment-stepping crossing helper with `erasesShape` in `src/editor/layers/shape/shapeGeometry.ts` and skipping drawings whose cached `drawingBox` misses the eraser).
   - In `src/editor/layers/strokes.ts`, update `hitTestDrawing` (`L202–213`) to ignore points covered by a later `type: "eraser"` stroke; on commit, prune earlier pen strokes whose drawn quadratic curve (`strokePath`) is completely covered by later erasers, drop orphaned eraser strokes with no earlier overlapping pen strokes, and remove emptied `DrawingLayer`s.
   - **Remove `actsOn` from `src/editor/tools/eraser/eraserSpec.ts` (`L11`)** and clear `selectedLayerId` when Eraser opens (`prepare` in `eraserTool.ts`), eliminating the layer-action trap identified in `Crux 2`.
   - Share one live `strokePath` across unlocked visible drawings in `src/editor/canvas/LiveStrokeOverlay.tsx` / `src/editor/EditorScene.tsx`, and fade crossed `ShapeLayer`s on the UI thread using `LayerTarget.strokes` (`src/editor/canvas/layerTargets.ts` L58).
   - Update `docs/interactive/src/lessons/model/StrokesLesson.tsx` and unit tests (`drawingEdits.test.ts`, `strokes.test.ts`, `shapeGeometry.test.ts`, `editorSlice.test.ts`).
2. **Step 2 — Stroke Eraser Variant (`Idea 3`):**
   - Add `Eraser` (partial default) and `Stroke eraser` (whole-stroke) variants to `src/editor/tools/eraser/` (`eraserSettings.ts`, `eraserTool.ts`, `EraserPanel.tsx`), removing touched pen strokes whole and fading hit strokes via an optional `SharedValue` prop on `DrawingLayerView.tsx`.
3. **Step 3 — Row Polish (`Idea 7a`) & Trial Strict Top-Layer Continuation (`Idea 5`):**
   - Add color swatches and `"Highlight"` / `"Drawing"` labels in `src/editor/layers/panel/LayerRow.tsx` (`L270`).
   - Trial strict top-layer continuation (`drawStroke` joining `document.layers.at(-1)` only when nothing joinable is selected and the top layer is an unlocked `DrawingLayer` with matching `layerBlend`, never skipping shapes) on device; keep it only if the reduction in layer rows outweighs coupling consecutive same-blend Pen sessions before `Select` (`Idea 10`) ships.
