# Position B Rebuttal: Targeted Correctness & Hot Paths vs. Over-Refactoring and Inaction

## 1. Rebuttal to Position A (Roadmap, Structure First)

### Critiques of Specific Claims
- **A1 (Prerequisite Fallacy):** Position A asserts that unifying polyline walkers (`segmentsNear`, `alongLine`, `eachAlong`) and four bounding helpers is a "prerequisite" for preserving stroke cache identity in [`DrawingLayerView.tsx`](file:///Users/nverk/Dev/tuck/src/editor/layers/drawing/DrawingLayerView.tsx#L60-L69). This is false. Cache eviction occurs solely because [`addStroke`](file:///Users/nverk/Dev/tuck/src/editor/layers/strokes.ts#L114-L134) calls [`recenterDrawing`](file:///Users/nverk/Dev/tuck/src/editor/layers/strokes.ts#L91-L108), which allocates new `Stroke` objects and point arrays. Preserving stroke identity requires only that `addStroke` appends points in stable coordinates without re-centering prior strokes (or translates cached `SkPath`s). Tying this hot-path fix to an expansive rewrite across `strokes.ts`, `drawing.ts`, and `drawingEdits.ts` artificially inflates PR scope and regression risk.
- **A4 (Illusory Memoization & False Churn):** Position A claims stabilizing `view`, callbacks, and `editorContext` stops "cascading UI churn." But `src/editor` has zero `React.memo` components; React re-renders children whenever `Editor` updates regardless of context reference stability. Furthermore, `useAdjustTool.ts` (L81–L86) only synchronizes when `layer?.adjustments` changes, and `useCropTool.ts` (L68–L71) memoizes `photoSize`. A4 manufactures background churn to justify a high-risk rewrite of `ToolSpec` contracts ([`defineTool.ts`](file:///Users/nverk/Dev/tuck/src/editor/defineTool.ts), [`builtInSpecs.ts`](file:///Users/nverk/Dev/tuck/src/editor/builtInSpecs.ts)) that yields zero runtime improvement.
- **A5 (Scope Bloat):** The P2 items—`Dial.tsx` tick strips (L212), `TextStylePanel.tsx` HSV duplication (L140), and `sameDocument`—run outside hot paths and have no measurable impact on frame rate. Bundling them into an active refactor roadmap violates reviewability (C5).

### Rival's Strongest Point
**A2 (Bounded Live Overlays):** Position A correctly diagnoses that unbounded `saveLayer` in [`RedactionLayerView.tsx`](file:///Users/nverk/Dev/tuck/src/editor/layers/redaction/RedactionLayerView.tsx#L285-L294) (`UNBOUNDED = 1_000_000`) and per-stroke `<DimmedStroke>` mounting in [`LiveStrokeOverlay.tsx`](file:///Users/nverk/Dev/tuck/src/editor/canvas/LiveStrokeOverlay.tsx#L268-L323) impose heavy per-frame penalties during live user gestures.

### Concessions
We concede that the three polyline-walking helpers with inverted boolean semantics (`segmentsNear` stopping on `true` vs. `eachAlong` stopping on `false`) represent genuine technical debt. If stroke geometry is unified, it will marginally improve codebase consistency (C4).

### Conditions Under Which Position A Should Win
Position A should win if the team prioritizes a holistic, multi-week cleanup of `src/editor`'s architectural boundaries and helper duplication, accepting large PR surfaces, wide test revisions, and merge conflicts in exchange for a standardized codebase.

---

## 2. Rebuttal to Position C (Verify, Correct, and File; Defer Code Changes)

### Critiques of Specific Claims
- **PC3 (Dismissing $O(N^2)$ Path Rebuilding):** Position C claims `addStroke` cache eviction is a "paper bottleneck" taking "microseconds" on quiescent paths. This ignores interaction reality. In rapid sketching or hatching (and the 200-mark benchmark in [#95](https://github.com/nverkhachoyan/tuck/issues/95)), rebuilding 50–200 smooth Bezier curves via `strokePath` ([`DrawingLayerView.tsx`](file:///Users/nverk/Dev/tuck/src/editor/layers/drawing/DrawingLayerView.tsx#L37-L56)) at every touch-up causes noticeable commit latency, GC pressure, and frame drops. It is an algorithmic flaw with an obvious fix.
- **PC4 (Mischaracterizing WebGL Concurrency):** Position C calls queueing in [`drawOffscreen.web.ts`](file:///Users/nverk/Dev/tuck/src/editor/render/drawOffscreen.web.ts#L25-L53) "concurrency overkill" that risks "deadlock." In JavaScript, a linear promise chain (`queue = queue.then(...)`) cannot deadlock. Asynchronous gaps at `await drawAsPicture` (L32) and `await snapshot.makeRasterImage()` (L48) allow concurrent callers (`renderDocument.tsx`, `cutMask.tsx`) to invoke `shared?.free()` (L73), calling `loseContext()` (L98) during active rasterization. Leaving a known GPU corruption hazard in production until an end-user files a report is unacceptable engineering practice.
- **PC5 (Process Paralysis):** Filing 16 GitHub issues and demanding external reproductions before fixing verified hotspots—like `LiveRedactionStrokes` re-recording full filter graphs on every touch move—delays obvious, testable wins. Targeted PRs with unit tests (`pnpm test`) resolve these without process overhead.

### Rival's Strongest Point
**PC1 & PC2 (Factual Audit Invalidation):** Position C's strongest contribution is exposing the audit's factual inaccuracies (phantom `sampleColor.ts`, `LayersPanel` unmounting guards at L109/L128) and proving that the root memoization sweep achieves nothing without `React.memo`.

### Concessions
We concede that modifying `recenterDrawing` must strictly uphold Hard Constraint 5: saved project serialization ([`projectFile.ts`](file:///Users/nverk/Dev/tuck/src/projects/projectFile.ts)) and existing stroke rotation math cannot be altered. We also concede that non-hot-path findings (`LayersPanel`, `Dial` ticks) should be logged as issues rather than patched immediately.

### Conditions Under Which Position C Should Win
Position C should win if project policy imposes a strict feature/refactoring freeze on `src/editor`, requiring that every single modification be preceded by a reproducible bug report from real device telemetry.
