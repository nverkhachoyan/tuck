# Position A Closing: A Disciplined, Structure-Grounded Roadmap

### Crux 1: WebGL Offscreen Surface Concurrency
In CanvasKit, `snapshot.makeRasterImage()` (L48) reads GPU memory back asynchronously. Calling `shared?.free()` (L73) mid-readback destroys the underlying WebGL context via `loseContext()` (L98–99). Serializing calls via an internal module queue in `drawOffscreen.web.ts` (mirroring `markThumbnail.tsx` L19) is trivial, deadlock-free, and eliminates confirmed WebGL corruption.

### Crux 2: Stroke Identity vs. Recenter Invariants
Layer transform centering in `recenterDrawing` must be preserved for saved-project compatibility (`projectFile.ts`). However, cache eviction in `DrawingLayerView.tsx` (L60–69) is easily solved without altering geometry: key the cache on persistent stroke IDs or offset cached uncentered `SkPath`s. This eliminates $O(N^2)$ path rebuilding during multi-mark sketches (#95) while strictly preserving Hard Constraint 5.

### Crux 3: Action Scope and Repository Governance
Pure-logic duplication in stroke geometry (`strokes.ts`, `drawing.ts`, `drawingEdits.ts`) is a direct liability: fixing hit-testing or path caching against divergent line-walkers invites subtle worklet bugs. Unifying geometry primitives in `strokes.ts` with pure TypeScript unit tests (`strokes.test.ts`) is safe, reviewable, and provides the necessary foundation for hot-path wins.

### Final Revised Position
Debate evidence from Positions B and C demonstrated that `Editor.tsx` lacks `React.memo` and components like `LayersPanel` already unmount when closed. Position A therefore **concedes and eliminates** root context memoization, `ToolSpec` generalization, and all P2 polish (`Dial.tsx`, `TextStylePanel.tsx`, `sameDocument`).

We revise our roadmap to a focused 3-PR sequence:
1. **PR 1 (Correctness):** Internal promise queue in `drawOffscreen.web.ts`.
2. **PR 2 (Geometry & Cache):** Unify stroke walkers in `strokes.ts` and preserve `SkPath` caching across `addStroke`.
3. **PR 3 (Live Gestures):** Batch `StrokeErasedDrawing` and add AABB rejection to `strokesHitBy`.
