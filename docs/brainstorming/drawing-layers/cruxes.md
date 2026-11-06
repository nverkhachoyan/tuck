# Debate Cruxes: Drawing, Erasing, and Layers

After reviewing `01-opening.md` and `02-rebuttal.md` across all three agents, all positions converged on two foundational points:
1. **Unscoped default erasing (`Idea 1`):** Opening Eraser from the toolbar/rail/`X` key must erase across every unlocked, visible `DrawingLayer` (and `ShapeLayer`) its path crosses, with a single shared live `strokePath` rendered in `EditorScene.tsx`.
2. **Layer row identification (`Idea 7a`):** `LayerRow.tsx` (`L270`) should display a color swatch and distinguish `"Highlight"` (`blend: "multiply"`) from `"Drawing"`.
3. **Point-only emptiness check is invalid:** All agents (including C's concession of `A2`) recognize that testing only raw vertices (`stroke.points`) fails when an eraser crosses the endpoints of a 2-point stroke (`straightStroke`, `strokes.ts` L182–195) while leaving its middle visible; curve/segment coverage is required.

Four genuine, evidence-backed cruxes remain unresolved for Step 3 (Closings):

---

## Crux 1: Stored `blendMode: "clear"` + Whole-Stroke Curve Pruning (Position A) vs. Geometric Polyline Splicing (Position B)

- **Position A (joined by C on `blendMode: "clear"`):**
  - Cites `src/editor/layers/drawing/DrawingLayerView.tsx` (L79, L108–165) to show that `blendMode: "clear"` inside `<Group layer>` is the only mechanism that preserves pixel-exact visual identity between the live drag (`LiveStrokeOverlay.tsx` L231) and the committed stroke across all four tips (`Pen`, `Highlighter`, `Marker` at `MARKER_OPACITY = 0.45`, and `Neon` with `NEON_GLOW = 0.55` / `BlurMask`).
  - Points out that `src/editor/layers/strokes.ts` is shared with brush `RedactionLayer`s (`src/editor/canvas/layerTargets.ts` L55–57) and v5 saved projects (`src/projects/projectFile.ts` L31), so `hitTestDrawing` (`strokes.ts` L202–213) *must* check later `type: "eraser"` strokes even under Position B.
  - Argues that flattening `strokePath`'s quadratic curves into dense polylines (`B2`) inflates `stroke.points` by 5–20×, slowing UI-thread `nearLine` (`strokes.ts` L158–173) and growing project files.
- **Position B:**
  - Points out that Position A's whole-stroke pruning (`Idea 2`, `ideas.md` L56) *already* requires sampling/flattening `strokePath`'s quadratic midpoint curves (`DrawingLayerView.tsx` L32–50) at commit time to verify whether a pen stroke is 100% covered, yet throws that work away whenever a stroke is 80–90% erased—leaving `penExtent` (`strokes.ts` L48–64), `drawingBox` (L71–84), and `recenterDrawing` (L91–108) oversized with off-center handles.
  - Notes that Position A injects `type: "eraser"` strokes into every crossed `DrawingLayer`, permanently blocking `mergeDrawings` (`Idea 7b`) on partially erased ink layers (`layerBlend === undefined`) because upper `clear` strokes punch holes through lower ink once inside a shared `<Group layer>`.
- **Hinges on:** Whether Criterion 2 (25% Visual & Geometric Fidelity) and Criterion 4 (15% Simplicity) are damaged more by **cut-end visual regressions on release + polyline point bloat** (Position B) or by **oversized bounding boxes/pivots and unmergeable `clear` strokes on partially erased strokes** (Position A), and whether `hitTestDrawing` must become eraser-aware regardless due to brush redactions and v5 files.

---

## Crux 2: Unconditional Unscoped Erasing + Removing `eraserSpec.actsOn` (Positions A & B) vs. Contextual Action-Scoped Narrowing (Position C)

- **Positions A & B:**
  - Show from the code that `outlinedLayerFor` (`src/editor/canvasInputFor.ts` L153–156) checks `restyles(input.tool, selectedLayer)` where `CANVAS_TOOLS.draw.restyles` is `null` (`src/editor/canvas/canvasTool.ts` L71), so drawings are never outlined by tools today, and `useEditorTools.ts` (`starters`, L224–229) uses a single zero-argument `() => startTool(next)` callback across dock, rail, `X` shortcut, and layer actions.
  - Argue that scoping the eraser based on *which button opened it* creates a hidden modal rule violating `PRODUCT.md` L13 ("won't learn it, set it up, or read about it first").
- **Position C:**
  - Shows that `src/editor/tools/eraser/eraserSpec.ts` (L11) explicitly sets `actsOn: (layer) => layer.type === "drawing"`, which causes `layerActionsFor` (`src/editor/editorChrome.ts` L36–46) to render a contextual **Eraser** button when a drawing is selected (`src/editor/Editor.tsx` L470–477).
  - Argues that if opening Eraser unconditionally deselects the drawing and erases *all* layers (`A1`/`B1`), tapping a selected drawing's own **Eraser** action button becomes a UX trap that destroys unselected layers underneath—whereas keeping selection when opened from `actsOn` (and updating `outlinedLayerFor` to outline it) fulfills the promise of the layer action button and provides discoverable single-layer protection without hunting for Lock in `LayersPanel.tsx`.
- **Hinges on:** Whether `eraserSpec.actsOn` (`src/editor/tools/eraser/eraserSpec.ts` L11) should be **removed** so Eraser is strictly a document-wide tool that clears selection on open (Positions A & B), or **honored** by distinguishing layer-action entry and outlining the target drawing via `outlinedLayerFor` (Position C).

---

## Crux 3: Top-Drawing Continuation (`Idea 5`, Positions A & B) vs. Per-Session Layer Isolation (Position C)

- **Positions A & B:**
  - Cite `penTool`'s `deselectOnDone: true` (`src/editor/tools/pen/penTool.ts` L13) and `drawStroke` (`src/editor/layers/drawing/drawingEdits.ts` L59) to show that every Done + re-entry spawns a new `DrawingLayer`, cluttering `LayersPanel.tsx` and multiplying Skia `<Group layer>` saves.
  - Argue that joining the topmost layer when it is an unlocked `DrawingLayer` with matching `layerBlend` (`drawing.ts` L50–52) prevents layer spam while still starting a new layer whenever a shape, sticker, text, or different-blend drawing sits on top.
- **Position C:**
  - Cites `PRODUCT.md` L58 (*"Nothing is final until export"*) and `recenterDrawing` (`strokes.ts` L91–108): before `Select` (`Idea 10`) exists to split strokes, auto-joining consecutive Pen sessions fuses separate annotations (e.g., an arrow in Session 1 and a note in Session 2) into one bounding box and shifts their rotation pivot, making them impossible to move, scale, or delete apart.
  - Points out that in the common Pen → Shape → Pen workflow (`ideas.md` L134–137), each `ShapeLayer` is a new top layer, so strict top-layer continuation fails to prevent new `DrawingLayer`s whenever shapes are interleaved, while skipping shapes buries new ink *underneath* the shape.
- **Hinges on:** Before stroke selection (`Idea 10`) exists, does Criterion 1 (30%) + Criterion 3 (20%) favor **auto-joining consecutive same-blend Pen sessions when no other layer intervened** (Positions A & B) or **keeping one `DrawingLayer` per Pen session so each session's marks remain independently movable** (Position C)?

---

## Crux 4: Shipping `Stroke eraser` + Live UI-Thread Removal Fade Now (`Idea 3`, Positions A & B) vs. Deferring Variants & Fade Plumbing (Position C)

- **Positions A & B:**
  - Show that `layerTargets` (`src/editor/canvas/layerTargets.ts` L31, L58) *already* calls `shapeOutline(layer)` on the JS thread and passes `strokes: MaskStroke[]` to the UI thread, refuting C's claim that shape fading hits a UI-thread `WeakMap` limit.
  - Argue that one-swipe whole-stroke deletion (`Stroke eraser`, `Idea 3`) and live fade previews for shapes/strokes about to be removed prevent surprise whole-shape deletions (`drawingEdits.ts` L38–45) and match Apple Markup / Goodnotes (`prior-art.md` L37–38).
- **Position C:**
  - Points out that while shape outlines are in `layerTargets`, **per-stroke fading** inside `DrawingLayerView.tsx` (`L70–92`) requires threading a `SharedValue` through `EditorScene.tsx` → `StrokeTarget` → `LayerContent.tsx` → `DrawingLayerView.tsx` and wrapping individual `<BrushStroke>` elements (including 3-path `neon` strokes and `multiply` highlighter strokes) in animated opacity groups, while adding a variant flyout (`◢`) to `eraserTool.ts`.
- **Hinges on:** Whether whole-stroke erasing (`Idea 3`) and live UI-thread fade previews for shapes and/or individual strokes justify the view/worklet plumbing in the initial implementation, or whether shape fade should be decoupled from per-stroke fade.
