# Debate Cruxes: Acting on the Editor Audit

Readings of all openings (`01-opening.md`) and cross-rebuttals (`02-rebuttal.md`) demonstrate clear convergence on several points while leaving three foundational cruxes contested and unresolved.

---

## Points of Concession and Agreement
1. **Root memoization in `Editor.tsx` / `useEditorTools.ts` is illusory:** Position A conceded (under critiques from B and C) that because `src/editor` has zero `React.memo` components, stabilizing callback references in `Editor.tsx` or `editorContext` cannot prevent children from re-rendering on parent updates. Furthermore, `useCropTool.ts` already memoizes `fit` and `LayersPanel.tsx` unmounts when closed.
2. **P2 polish is non-hot-path technical debt:** All agents agree that `Dial.tsx` tick strips, `TextStylePanel.tsx` HSV duplication, and `sameDocument` stringification do not degrade gesture frame rates and should not bloat immediate refactoring PRs.
3. **Polyline-walking duplication is genuine debt:** All agents agree that three separate implementations of line walking (`segmentsNear`, `alongLine`, `eachAlong`) with inverted boolean stop conditions present a maintenance and divergence hazard.
4. **Live overlay worklet overhead is real:** All agents agree that `<DimmedStroke>` in `LiveStrokeOverlay.tsx` mounting $O(\text{strokes})$ Reanimated `useDerivedValue` hooks during eraser use and `strokesHitBy` lacking AABB rejection in `useToolStroke.ts` represent genuine UI-thread worklet costs during active gestures.

---

## Contested Cruxes

### Crux 1: WebGL offscreen surface concurrency in `drawOffscreen.web.ts`
- **Positions A & B stance:** `drawOffscreen.web.ts` shares a single module-level `Offscreen` WebGL surface across asynchronous gaps (`await drawAsPicture` and `await snapshot.makeRasterImage()`). Other callers (`renderDocument.tsx`, `cutMask.tsx`, `useRenderedDocument.tsx`) bypass `markThumbnail.tsx`'s queue. A concurrent call can invoke `surfaceFor`, calling `shared?.free()` (`loseContext()` and `deleteContext()`) while another caller awaits rasterization. Enqueuing all calls inside `drawOffscreen.web.ts` is an urgent, zero-overhead, deadlock-free correctness fix.
- **Position C stance:** Surface clearing, drawing, and snapshotting happen synchronously once `drawAsPicture` resolves. `makeRasterImage()` operates on an independent `SkImage`. No context loss has ever been reproduced. Introducing a global promise queue introduces deadlock/latency risk without an observed failure case.
- **Hinges on:** Whether `snapshot.makeRasterImage()` requires the underlying WebGL context to remain alive and un-mutated during its asynchronous execution, and whether a linear promise queue in `drawOffscreen.web.ts` is completely safe and deadlock-free.

### Crux 2: Stroke identity preservation on `addStroke` vs `recenterDrawing` invariants
- **Positions A & B stance:** `addStroke` invokes `recenterDrawing` on every committed stroke, remapping all existing strokes into new objects and point arrays. This evicts `DrawingLayerView.tsx`'s `WeakMap<MaskStroke, SkPath>` cache on every single stroke, turning stroke addition into an $O(N^2)$ path rebuilding loop that causes commit hitching and GC spikes in long sketching sessions or the 200-mark test (#95).
- **Position C stance:** `addStroke` runs only on gesture finalization (`onFinalize`), taking microseconds. Re-centering is critical: it anchors the layer's local coordinate origin to the center of ink for correct rotation and scaling transforms, and is baked into saved project serialization (`projectFile.ts`) and tests (`strokes.test.ts`). Modifying stroke points or avoiding re-centering risks breaking coordinate math and invariant safety (Hard Constraint 5).
- **Hinges on:** Can stroke cache identity or SkPath caching be preserved (e.g. via stroke ID keys, caching uncentered paths and translating, or adjusting cache lookup) without mutating layer transform origin semantics or breaking saved projects?

### Crux 3: Action scope and repository governance
- **Position A stance:** Foundational stroke geometry and line-walking duplication in `strokes.ts` must be unified first to create a single tested source of truth before landing performance optimizations; otherwise, worklets and store edits will diverge.
- **Position B stance:** Ship surgical, targeted PRs immediately for high-impact correctness and gesture bottlenecks (`drawOffscreen` queue, live overlay batching, stroke path caching, AABB rejection), leaving structural cleanups in the backlog to maintain small review surfaces.
- **Position C stance:** The audit is compromised by factual and architectural errors. AGENTS.md mandates filing disciplined GitHub issues for open findings. Changes should not be made without reproduction harnesses or profiling on devices, except where a bug is undeniably proven.
- **Hinges on:** Whether verified hot-path/correctness wins (overlay batching, AABB hit-test, offscreen serialization) should be executed immediately as small PRs (Position B), delayed pending formal issue filing and device reproduction (Position C), or packaged into a broader structural roadmap (Position A).
