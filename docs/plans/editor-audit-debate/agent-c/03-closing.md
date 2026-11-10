# Position C Closing: Principled Pragmatism

### Crux 1: WebGL Offscreen Concurrency (`drawOffscreen.web.ts`)
While `snapshot.makeRasterImage()` operates on an `SkImage`, `surfaceFor` calling `shared?.free()` (`loseContext()`) during async rasterization is a plausible GPU failure mode on web. Because offscreen renders are leaf operations with no nested calls, a module-level linear promise queue in [drawOffscreen.web.ts](../../../src/editor/render/drawOffscreen.web.ts#L28) is provably deadlock-free and removes the duplicate queue in `markThumbnail.tsx`. Position C **concedes** landing this immediate, isolated defensive fix.

### Crux 2: Stroke Identity vs. `recenterDrawing` Invariants
Position C maintains that `recenterDrawing` ([strokes.ts:91–108](../../../src/editor/layers/strokes.ts#L91-L108)) is non-negotiable: changing stroke points or transform origins breaks selection bounds, rotation centers, and Hard Constraint 5 (saved-project compatibility in [projectFile.ts](../../../src/projects/projectFile.ts)). However, Position C **concedes** the cache eviction problem: rather than destabilizing stroke geometry, `DrawingLayerView.tsx:60` can preserve path caching by keying on persistent stroke IDs and applying `SkPath.offset(dx, dy)`. This eliminates $O(N^2)$ path rebuilds while leaving `recenterDrawing` and serialization untouched.

### Crux 3: Scope and Repository Governance
Position A's structural roadmap and memoization sweeps are decisively refuted. However, awaiting issue filing for consensus UI-thread hot paths creates unnecessary delay. Position C **narrows scope to a hybrid pragmatic model**:
1. **Immediate surgical PRs:** Land three uncontested, zero-regression hot-path fixes: (a) `drawOffscreen.web.ts` serialization, (b) `<DimmedStroke>` batching in [LiveStrokeOverlay.tsx:268](../../../src/editor/canvas/LiveStrokeOverlay.tsx#L268), and (c) worklet AABB rejection in `strokesHitBy`.
2. **Issue filing & audit correction:** Correct the audit's factual errors and file disciplined GitHub issues per AGENTS.md for remaining items (geometry helper deduplication, persistent stroke ID path offsetting), validated against device checks (#95).
