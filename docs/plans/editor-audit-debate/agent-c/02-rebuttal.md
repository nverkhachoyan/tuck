# Position C Rebuttal: Auditing the Interventions

Position C evaluates the competing positions against codebase reality at `HEAD` and repository governance.

---

## Rebuttal to Position A

### 1. Critiques of Specific Claims
- **A4 (Root orchestration & idle tool gating):** Position A's premise that stabilizing `useEditorTools.ts` or `editorContext` stops UI churn is invalid. There is **zero** `React.memo` in `src/editor`. Without `memo`, child components re-render whenever `Editor.tsx` renders, regardless of callback stability. Active gestures (strokes, pan, zoom) run on the UI thread via Reanimated shared values, bypassing React renders entirely. Furthermore, `useCropTool.ts:109` memoizes `fit` on `[settled, photoSize, viewSize]`; `settled` never changes when Crop is closed. In `useAdjustTool.ts:81–86`, `syncAdjustments` only runs when `saved` adjustments change; pen strokes never touch `targetImage`.
- **A2 (Live Redaction unbounded layer):** Position A claims `bounds = null` (`UNBOUNDED = 1_000_000`) recreates a "1,000,000×1,000,000 layer... every frame". In Skia, [RedactionLayerView.tsx:285–301](../../../src/editor/layers/redaction/RedactionLayerView.tsx#L285-L301) uses `PictureRecorder` to record an `SkPicture` (a command display list), which allocates no raster bitmap texture. Bounding bounds prematurely risks clipping transformed redactions.
- **A1 (Stroke geometry unification):** Position A insists unifying geometry across three modules is a prerequisite for preserving stroke identity. However, altering `recenterDrawing` ([strokes.ts:91–108](../../../src/editor/layers/strokes.ts#L91-L108)) breaks layer rotation/scaling origins and violates Hard Constraint 5 (saved-project compatibility in [projectFile.ts](../../../src/projects/projectFile.ts)), failing existing tests in [strokes.test.ts:72–135](../../../src/editor/layers/__tests__/strokes.test.ts#L72-L135).
- **A5 (P2 polish):** Position A admits these are "hygienic cleanups" with "modest" savings. Bundling them into a multi-PR roadmap violates AGENTS.md issue discipline.

### 2. Rival's Strongest Point
Position A correctly identifies technical debt in triplicated polyline walking ([strokes.ts:208](../../../src/editor/layers/strokes.ts#L208), [drawingEdits.ts:246](../../../src/editor/layers/drawing/drawingEdits.ts#L246), [drawing.ts:199](../../../src/editor/layers/drawing/drawing.ts#L199)) with inverted boolean stop conditions, which risks subtle logic divergence.

### 3. Concessions
- Concede that polyline-walking duplication degrades maintainability (C4) and deserves consolidation.
- Concede that `<DimmedStroke>` ([LiveStrokeOverlay.tsx:268–323](../../../src/editor/canvas/LiveStrokeOverlay.tsx#L268-L323)) mounting $O(\text{strokes})$ Reanimated hooks creates redundant UI-thread overhead during eraser use.

### 4. Conditions Under Which Position A Should Win
Position A should win if the project prioritizes a greenfield architectural refactor to eliminate code duplication across all tools over regression safety, accompanied by a planned full-tree `React.memo` migration.

---

## Rebuttal to Position B

### 1. Critiques of Specific Claims
- **B1 (Web offscreen concurrency race):** Position B claims an active race where `surfaceFor` can destroy the WebGL context via `loseContext()` while another caller awaits readback. In [drawOffscreen.web.ts:34–48](../../../src/editor/render/drawOffscreen.web.ts#L34-L48), surface clearing, picture drawing, and snapshotting run completely synchronously in one microtask; `makeRasterImage()` operates on an independent `SkImage`. Native uses `drawAsImage`. On web, `markThumbnail.tsx:21` already has its own promise queue, and export renders are non-concurrent user actions. No context loss or corruption has ever been reproduced. Introducing a global serialization queue risks deadlocks without a verified failure case.
- **B2 (Preserving stroke identity):** `addStroke` ([strokes.ts:114–134](../../../src/editor/layers/strokes.ts#L114-L134)) runs once upon gesture completion (`onFinalize`), never per frame. Rebuilding an `SkPath` takes microseconds. Position B claims keeping stroke coordinates stable avoids this "without touching Skia layer invariants", but ignores that `recenterDrawing` centers the layer transform origin for rotation and scaling. Changing this breaks selection bounds and saved-project serialization ([projectFile.ts](../../../src/projects/projectFile.ts)).
- **B4 (`drawingPieces` hotspot):** `drawingPieces` ([drawingEdits.ts:336–366](../../../src/editor/layers/drawing/drawingEdits.ts#L336-L366)) runs only when a user explicitly taps "Separate" in the mark menu. It is an infrequent user action, not a frame-rate bottleneck. Optimizing it without issue tracking or profiling violates AGENTS.md.

### 2. Rival's Strongest Point
Position B's identification that `<DimmedStroke>` ([LiveStrokeOverlay.tsx:309–323](../../../src/editor/canvas/LiveStrokeOverlay.tsx#L309-L323)) mounts separate Reanimated hooks per stroke and that `strokesHitBy` lacks AABB rejection (B3.2, B3.3) accurately isolates true UI-thread gesture costs.

### 3. Concessions
- Concede that Position B (B5, B6) correctly refutes Position A's memoization sweep and ToolSpec generalization as illusory optimizations.
- Concede that UI-thread worklet hit-testing without AABB pre-checks wastes cycles during active pointer panning.

### 4. Conditions Under Which Position B Should Win
Position B should win if automated headless Chrome or device benchmarks reproduce a WebGL context crash or demonstrate measurable frame drops during gestures (e.g. in issue #95's 200 marks test), justifying immediate code intervention before filing issues.
