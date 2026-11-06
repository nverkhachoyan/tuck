# Position C Opening: Minimal Scoped Fix — Unscoped Default, Action-Scoped Narrowing, and Session Isolation

Position C solves Tuck's erasing pain—an unselected eraser doing nothing (`src/editor/layers/drawing/drawingEdits.ts` L27–34, `src/editor/EditorScene.tsx` L151–157) and earlier marks being unreachable—with minimal complexity while preserving per-session editing and pixel-exact rendering.

## Numbered Claims

### C1. Unscoped Default + Action-Scoped Narrowing Delivers Immediate Erasing and Discoverable Protection
- **Criteria:** **1. Immediate Utility & Mental Model (`PRODUCT.md`, 30%)** & **3. Non-Destructive Layer & Editing Flexibility (20%)**
- **Evidence:** Today, `eraserSpec.actsOn` declares `(layer) => layer.type === "drawing"` (`src/editor/tools/eraser/eraserSpec.ts` L11), so `layerActionsFor` (`src/editor/editorChrome.ts` L36–46) offers **Eraser** in the dock/bar when a drawing is selected (`src/editor/Editor.tsx` L470–477). Conversely, switching from Pen to Eraser via `startTool` (`src/editor/useEditorTools.ts` L139–161) leaves the new drawing selected without running `finishTool`'s `deselectOnDone` (`L110–117`). Position C separates accidental from intentional selection (`recommendation.md` Open Question 1b):
  - Opening Eraser from the toolbar, rail, or `X` key clears selection so `drawStroke` (`src/editor/layers/drawing/drawingEdits.ts` L21–60) and a shared live path in `EditorScene.tsx` (`L129`) erase across every unlocked, visible `DrawingLayer` they cross.
  - Opening Eraser from a selected drawing's layer actions keeps that drawing selected and outlined via `outlinedLayerFor` (`src/editor/canvasInputFor.ts` L139–166), narrowing erasing to that drawing alone (Illustrator's rule, `prior-art.md` L52).
  Unlike Positions A and B—which remove single-layer erasing and force users to hunt for Lock in `LayersPanel.tsx` (`recommendation.md` L26)—Position C keeps a discoverable, outlined way to erase one drawing while making default erasing effortless.

### C2. Preserving `blendMode: "clear"` Guarantees Live-to-Commit Visual Identity Across All Four Tips
- **Criterion:** **2. Visual & Geometric Fidelity (25%)**
- **Evidence:** In `src/editor/layers/drawing/DrawingLayerView.tsx`, each `DrawingLayer` renders inside `<Group layer={multiply ? <Paint blendMode="multiply" /> : true}>` (`L79`), and `brushPaint` renders erasers with `blendMode: "clear"` (`L147–153`). Position B's path cutting (Idea 4) replaces `strokePath`'s quadratic midpoint curves (`L32–50`) with spliced polylines, causing five visual regressions (`ideas.md` L108–116): round caps over-erase at shallow angles by $(w/2)/\sin\theta$; square caps on Highlighter/Marker (`tip === "marker" | "ink"`, `L155–159`) poke into the swath; cut Marker loops (`MARKER_OPACITY = 0.45`, `L15`) double-darken at self-intersections; Neon's blur (`NEON_GLOW = 0.55`, `NEON_GLOW_BLUR = 0.16`, `L20–24, L108–134`) bleeds back into the cut; and ink jumps on release when the live `clear` preview swaps to cut geometry. Position C keeps pixel-exact `clear` strokes with zero live-to-commit discrepancy.

### C3. Keeping One `DrawingLayer` per Pen Session Preserves Non-Destructive Repositioning Before Idea 10
- **Criteria:** **3. Non-Destructive Layer & Editing Flexibility (20%)** & **5. Backward Compatibility & Evolution Path (10%)**
- **Evidence:** `PRODUCT.md` Principle 3 mandates *"Nothing is final until export"* (`L58`). Today, `penTool`'s `deselectOnDone: true` (`src/editor/useEditorTools.ts` L116) gives each Pen session an independent `DrawingLayer` that moves, scales, rotates, or deletes (`EditorCanvas.tsx` L436–451). Positions A and B ship Idea 5 (auto-joining the top `DrawingLayer` when unselected), fusing separate sessions' marks into one box before Select (Idea 10) exists (`ideas.md` L141–142)—and in Idea 5's shape-skipping variant (`L134–137`), dropping new pen strokes *under* earlier shapes. Position C rejects Idea 5 and distinguishes rows via `LayerRow.tsx` swatches and `"Highlight"` labels (Idea 7a, `src/editor/layers/panel/LayerRow.tsx` L270).

### C4. Minimal Model Cleanup and Deferring Stroke Eraser Avoid UI-Thread Worklets and View Churn
- **Criteria:** **4. Architectural & Runtime Simplicity (15%)** & **5. Backward Compatibility & Evolution Path (10%)**
- **Evidence:** Position C updates `hitTestDrawing` (`src/editor/layers/strokes.ts` L202–213) so a pen stroke hits only where no later `type: "eraser"` stroke covers `point` via `nearLine` (`L158–173`), and deletes any crossed `DrawingLayer` with no uncovered pen points left. Omitting Idea 3's Stroke Eraser and live fade worklets avoids:
  1. Adding a variant flyout (`◢`) to `eraserTool.ts` (`src/editor/tools/eraser/eraserTool.ts` L6–14), keeping Eraser a zero-config utility (`PRODUCT.md` L59).
  2. Turning `shapeOutline` and `erasesShape` (`src/editor/layers/shape/shapeGeometry.ts` L67–76, L121–146)—which cache outlines in a JS `WeakMap` unavailable on UI worklets—into per-frame UI-thread worklets.
  3. Threading shared-value stroke-fade sets through `LayerContent.tsx` and `DrawingLayerView.tsx` (`L70–92`), keeping `docs/interactive/src/lessons/model/StrokesLesson.tsx` (`L194–204`) intact and v5 projects (`src/projects/projectFile.ts`) compatible.

## Known Weaknesses

1. **Unshrunk boxes on partially erased layers:** Without curve pruning (Idea 2) or path cutting (Idea 4), `penExtent` (`src/editor/layers/strokes.ts` L48–64) keeps full bounds until all pen points are covered.
2. **Stored eraser strokes accumulate:** Crossing multiple drawings appends an eraser stroke to each crossed `DrawingLayer`, blocking unconditional `mergeDrawings` (Idea 7b).
3. **Dual scoping rule:** Action-scoped narrowing relies on `SelectionOutline` (`EditorScene.tsx` L200–202) to signal why a layer-action Eraser is narrowed.
