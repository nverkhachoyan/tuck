# Position A Rebuttal: Structure First Enables Sustainable Performance

## Rebuttal to Position B (Targeted Hot-Path and Correctness Fixes Only)

### 1. Critiques of Specific Claims
- **B2 & B4 (Piecemeal hot-path fixes without structural unification):** Position B advocates landing stroke identity preservation and `drawingPieces` bounds precomputation while leaving duplicate geometry in place (B6). This is fragile. Stroke bounds and line-walking are duplicated across three modules with conflicting semantics: `eachAlong` (`drawing.ts` L199–218) aborts when `visit` returns `false`, whereas `alongLine` (`drawingEdits.ts` L246–265) and `segmentsNear` (`strokes.ts` L208–231) abort when `visit` returns `true`. Furthermore, `recenterDrawing` (`strokes.ts` L91–108) is used across `drawing.ts`, `drawingEdits.ts`, and `strokes.ts`. Altering stroke origins without unifying geometry primitives (`penExtent` L48–64, `boundsOf` L173–190, `strokeBounds` L283–300) risks subtle bounding mismatches between UI worklet hit-testing and store edits. Unification in `strokes.ts` is not churn; it is the prerequisite for safe identity preservation.
- **B5 (Dismissing orchestration and context memoization):** B5 argues memoization is moot because `src/editor` lacks `React.memo`. This ignores React context mechanics: an un-memoized object literal in `editorContext` (`Editor.tsx` L514–527) forces every `useEditorContext()` consumer (`EditorCanvas.tsx` L87, active tool trays, inspect panels) to re-render whenever `Editor` updates. Furthermore, B5 overlooks that `useAdjustTool.ts` (L81–86) schedules UI-thread worklets (`scheduleOnUI(syncAdjustments)`) on native on every render when adjustments change, even while Adjust is closed. Gating idle tools eliminates real background thread work.
- **B6 (Treating ToolSpec cleanup as zero-value churn):** Hardcoding ~85 lines of `cut`/`removeBg` state in `Editor.tsx` (L371–457) and `adjust` targets in `useEditorTools.ts` (L176) violates Hard Constraint 1 (clean tool boundaries). Leaky tool orchestration directly generates the callback instability that drives re-renders.

### 2. Rival's Strongest Point
B1 correctly identifies that `drawOffscreen.web.ts` (L16–58) destroys WebGL contexts (`loseContext`/`deleteContext` L98–99) during asynchronous gaps (`await drawAsPicture` to `await snapshot.makeRasterImage()`). Addressing this via module-level queueing is an urgent, self-contained correctness fix.

### 3. Concessions
- We concede that absent `React.memo` on direct child components, stabilizing `Editor.tsx` callbacks will not prevent top-down JSX re-renders from parent state changes.
- We concede that P2 items (`Dial.tsx` tick strip, `TextStylePanel.tsx` HSV math, `sameDocument` stringification) do not sit on critical gesture loops and offer negligible frame-time gains compared to P0 stroke cache thrashing.

### 4. Conditions Under Which Position B Should Win
Position B is optimal if engineering capacity is restricted to a 1–2 day emergency window, or if Tuck is in an immediate pre-release freeze where only demonstrable crash/corruption bugs and profiled release regressions (#95) may be merged.

---

## Rebuttal to Position C (Verify, Correct, and File; Defer Code Changes)

### 1. Critiques of Specific Claims
- **PC1 (Using typographical audit errors to dismiss verified engine hazards):** PC1 cites mislocated files (`defineTool.ts`) and phantom citations (`sampleColor.ts`) to discredit the audit. But editorial errors do not invalidate verified runtime defects: `drawOffscreen.web.ts` (L16–58) genuinely suffers from unqueued WebGL surface sharing across `renderDocument.tsx` (L83), `cutMask.tsx` (L72), and `useRenderedDocument.tsx` (L54). Discarding real code hazards because an audit cited wrong lines is a fallacy.
- **PC3 (Labeling `addStroke` and live overlays "paper bottlenecks"):** PC3 claims `addStroke` (`strokes.ts` L114–134) is harmless because it runs on `onFinalize` in "microseconds." In real usage (e.g., handwriting or issue #95 with 200 marks), invalidating `DrawingLayerView.tsx`'s `WeakMap` cache (L60–69) on every commit forces Skia to rebuild 200 C++ `SkPath` objects from scratch. This causes noticeable hitching between strokes. Furthermore, PC3 ignores that `strokesHitBy` (`strokes.ts` L332–355) runs without AABB checks on the UI thread on *every pointer event* during eraser gestures (`useToolStroke.ts` L238).
- **PC4 (FUD regarding saved-project invariants):** Preserving stroke identity does not threaten Hard Constraint 5 (`projectFile.ts`). Preserving local stroke points or applying offsets to cached `SkPath`s keeps layer transform math and disk schemas intact.
- **PC5 (Administrative paralysis over action):** Converting obvious, unit-testable bugs into 16 GitHub issues postpones straightforward engineering solutions. Defects like `LiveRedactionStrokes` allocating an unbounded 1,000,000×1,000,000 layer (`RedactionLayerView.tsx` L48, L320) are verifiable directly by inspection and unit tests.

### 2. Rival's Strongest Point
PC1.4 & PC1.5 accurately note that `LayersPanel.tsx` (L109, L128) unmounts when closed and `useCropTool.ts` (L109) memoizes `fit` on `settled`. This fact-checking prevents wasted effort refactoring components that are already quiescent.

### 3. Concessions
- We concede the audit contained factual errors regarding `sampleColor.ts`, `defineTool.ts` paths, and `LayersPanel` closed mounting state.
- We concede that device-specific frame-rate targets (#95, #97) require validation on real mobile hardware per AGENTS.md rules before closing.

### 4. Conditions Under Which Position C Should Win
Position C is optimal if the team has zero capacity for active development and must enforce a strict policy where no code may be modified without prior issue triage and automated reproduction harnesses.
