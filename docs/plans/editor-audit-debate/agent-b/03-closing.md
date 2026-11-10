# Position B Closing: Targeted Fixes on Verified Ground

### Crux 1: WebGL Offscreen Concurrency
`snapshot.makeRasterImage()` reads back GPU textures asynchronously. A concurrent call invoking `surfaceFor` destroys the active WebGL context (`loseContext()` at [`drawOffscreen.web.ts:98`](file:///Users/nverk/Dev/tuck/src/editor/render/drawOffscreen.web.ts#L98)) mid-readback. A linear promise chain (`queue = queue.then(...)`) is provably deadlock-free and eliminates `markThumbnail.tsx`'s redundant queue. This correctness fix must land immediately.

### Crux 2: Stroke Identity vs. Transform Invariants
Position C rightly defends Hard Constraint 5: `recenterDrawing`'s origin math is baked into saved projects ([`projectFile.ts`](file:///Users/nverk/Dev/tuck/src/projects/projectFile.ts)). However, solving $O(N^2)$ path rebuilds does not require altering project serialization. `DrawingLayerView.tsx` can cache `SkPath`s by stable stroke ID or cache uncentered paths with transform offsets. This preserves full saved-project compatibility while eliminating commit-time hitching and GC spikes (#95).

### Crux 3: Action Scope & Governance
The debate successfully pruned the audit's invalid claims: root memoization, `ToolSpec` rewrites, and P2 polish are rejected. But Position C's process paralysis leaves proven hot-path bugs untouched. Position A's monolithic roadmap bundles high-risk refactoring into simple wins. Surgical PRs, backed by unit tests (`pnpm test`) and zero architectural churn, are the correct governance model.

### Final Revised Position
Position B narrows scope to three discrete, independently verifiable PRs:
1. **WebGL Concurrency:** Centralize queue serialization in `drawOffscreen.web.ts`.
2. **Gesture Overlays:** Pass document bounds to `recordRedactionStrokes`, batch `<DimmedStroke>` in `StrokeErasedDrawing`, and add AABB rejection to `strokesHitBy`.
3. **Commit Latency:** Decouple `pathFor` caching in `DrawingLayerView.tsx` from stroke object identity without altering `recenterDrawing` or project serialization.

All other items—including polyline-walking deduplication, `LayersPanel`, `Dial`, and `TextStylePanel`—are deferred to GitHub issues per AGENTS.md.
