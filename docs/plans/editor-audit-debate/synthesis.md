# Synthesis: Acting on the `src/editor` Readability & Performance Audit

Synthesis of the 3-round structured debate over [docs/plans/editor-audit.md](../editor-audit.md) between Position A (Full Roadmap, Structure First), Position B (Targeted Hot-Path and Correctness Fixes), and Position C (Verify, Correct, and File Issues).

---

## 1. Points of Agreement and Convergence

The multi-round adversarial debate produced substantial convergence across all three positions, pruning invalid audit findings and establishing consensus on high-impact interventions:

1. **Root memoization & tool orchestration sweep is rejected as illusory:**
   - All three debaters conceded that because `src/editor` contains **zero** `React.memo` components, stabilizing callbacks or `editorContext` in `Editor.tsx` / `useEditorTools.ts` prevents zero re-renders of child components.
   - Position C established with codebase evidence that `useCropTool.ts` already memoizes `fit` on `settled`, and `LayersPanel.tsx` explicitly unmounts when closed (`{open && <BottomSheet>...}`). Active tool interactions run on the UI thread or Skia canvas via shared values, bypassing React renders.
   - All positions agreed to discard the audit's proposed memoization refactor and `ToolSpec` generalization.

2. **P2 polish is deferred to backlog issues:**
   - All positions converged that `Dial.tsx` tick rendering (91 `<View>`s), `TextStylePanel.tsx` HSV duplication (~135 lines), and `sameDocument` stringification are non-hot-path technical debt that do not affect gesture frame budgets and must not inflate immediate performance PRs.

3. **`drawOffscreen.web.ts` WebGL context concurrency fix is universally accepted:**
   - All three positions agreed that `snapshot.makeRasterImage()` in CanvasKit reads GPU memory asynchronously, and a concurrent call to `surfaceFor` invoking `shared?.free()` (`loseContext()` and `deleteContext()`) destroys the context mid-readback.
   - Because `drawOffscreen` operations are leaf tasks, an internal linear promise queue (`queue = queue.then(...)`) in `drawOffscreen.web.ts` is provably deadlock-free and eliminates the redundant duplicate queue in `markThumbnail.tsx`.

4. **Live overlay worklet optimizations are verified hot paths:**
   - All three debaters agreed that mounting $O(\text{strokes})$ Reanimated `useDerivedValue` hooks in `StrokeErasedDrawing` (`LiveStrokeOverlay.tsx`) during eraser use and executing `strokesHitBy` in `useToolStroke.ts` without UI-thread AABB rejection impose real per-frame penalties during touch gestures.

5. **`recenterDrawing` origin math must not be altered:**
   - All positions agreed that modifying `recenterDrawing` (`strokes.ts`) directly would break Hard Constraint 5: layer transform origins, rotation/scaling centers, and saved-project serialization (`src/projects/projectFile.ts`).
   - All agreed that solving $O(N^2)$ path rebuilding in `DrawingLayerView.tsx` should be done by decoupling the cache from stroke object identity (e.g. keying on persistent stroke IDs and applying offset math, or caching uncentered paths).

---

## 2. Crux Analysis

### Crux 1: WebGL Offscreen Concurrency (`drawOffscreen.web.ts`)
- **What it hinged on:** Whether `snapshot.makeRasterImage()` requires the WebGL context to remain intact and un-cleared during async readback, and whether an internal queue in `drawOffscreen.web.ts` is safe.
- **Evidence Resolution:** Code inspection of `drawOffscreen.web.ts` (L16–58, L98–99) confirmed that callers outside `markThumbnail.tsx` (`renderDocument.tsx` at L83, L98, L118; `cutMask.tsx` at L72, L76, L80; `useRenderedDocument.tsx` at L54) share the module-level `shared` surface across `await` points without synchronization. If `surfaceFor` grows or frees the surface, `loseContext()` explicitly terminates the context. Because these calls do not nest, a module-level promise chain is completely safe, zero-overhead, and deadlock-free.
- **Resolution:** **Resolved in favor of immediate module-level serialization.**

### Crux 2: Stroke Identity Preservation vs. `recenterDrawing` Invariants
- **What it hinged on:** Whether commit-time $O(N^2)$ path rebuilding in `DrawingLayerView.tsx` can be solved without breaking layer transform origins and saved-project compatibility (`projectFile.ts`).
- **Evidence Resolution:** Position C correctly demonstrated that altering `recenterDrawing`'s coordinate math breaks selection geometry, rotation centers, and fails `strokes.test.ts`. However, Positions A and B showed that `DrawingLayerView.tsx`'s cache eviction is an artifact of using `WeakMap<MaskStroke, SkPath>` keyed by stroke object identity. Because strokes in `StrokesLayer` already carry stable identities or can have their canonical uncentered paths cached and translated via `SkPath.offset(dx, dy)`, path caching can be preserved entirely within `DrawingLayerView.tsx` or a path helper without changing `recenterDrawing` or project serialization.
- **Resolution:** **Resolved in favor of path cache decoupling in the view layer without altering `recenterDrawing` or disk schemas.**

### Crux 3: Action Scope and Repository Governance
- **What it hinged on:** Whether verified hot-path/correctness fixes should be executed immediately as small targeted PRs (Position B), delayed pending formal issue filing and device checks (Position C), or packaged into a broader structural roadmap (Position A).
- **Evidence Resolution:** The audit contained genuine factual errors (phantom `sampleColor.ts`, mislocated `defineTool.ts`, false claims about `LayersPanel` mounting and `useCropTool` re-renders). Position C was right that acting on the audit uncritically would have resulted in wasted churn. However, Position B correctly proved that verified, testable correctness bugs (WebGL concurrency) and gesture bottlenecks (live overlay worklets, AABB hit-test rejection) can be isolated into surgical PRs covered by existing unit tests (`pnpm test`) without waiting for device telemetry.
- **Resolution:** **Resolved in favor of Position B's surgical, test-backed PR model, combined with Position C's discipline to correct the audit and file issues for remaining non-urgent items.**

---

## 3. Conditional Winners

- **Position A (Full Roadmap, Structure First) would be the right choice if:** The project were undertaking a scheduled multi-week refactor to migrate the entire UI tree to `React.memo`, rewrite core `ToolSpec` contracts, and eliminate all helper duplication across pure TypeScript modules, accepting broad PR surfaces and test rewrites.
- **Position B (Targeted Hot-Path and Correctness Fixes) is the right choice when:** High-confidence correctness hazards and per-frame gesture bottlenecks have been verified in the codebase and can be resolved with small, self-contained PRs that preserve existing architectural boundaries and invariants without regressions.
- **Position C (Verify, Correct, and File; Defer) would be the right choice if:** The codebase were in a strict pre-release freeze where no code modifications are permitted without an existing user bug report and device reproduction profile.

---

## 4. Final Recommendation

Tieing directly to the weighted criteria from `brief.md`:

| Criterion | Weight | Assessment of Recommended Path |
| :--- | :---: | :--- |
| **C1: Evidence fidelity** | 25% | **High.** Prunes the audit's factual errors (phantom files, false re-render claims) and acts strictly on verified code paths at `HEAD`. |
| **C2: User-visible impact** | 25% | **High.** Directly resolves WebGL context corruption on web, eliminates UI-thread worklet spikes during eraser gestures, and avoids commit-time hitching on drawings with many strokes (#95). |
| **C3: Regression risk & invariant safety** | 20% | **Maximum.** Strictly protects `recenterDrawing` coordinate math and saved-project serialization (`projectFile.ts`), maintains one-way architecture boundaries, and introduces no new abstractions. |
| **C4: Net readability & maintainability** | 15% | **Strong.** Eliminates dead duplicate queues (`markThumbnail.tsx`), removes $O(\text{strokes})$ mounted Reanimated hooks, and clarifies path caching. |
| **C5: Cost & reviewability** | 15% | **Optimal.** Replaces a sprawling multi-month roadmap with three small, independent PRs easily verified by `pnpm test`, `pnpm typecheck`, and `pnpm build:web`. |

### Execution Plan (Recommended 3-PR Sequence)

1. **PR 1 — WebGL Offscreen Concurrency Fix (Small, Correctness):**
   - Add a module-level linear promise queue to `src/editor/render/drawOffscreen.web.ts` wrapping surface acquisition, drawing, and `makeRasterImage` readback.
   - Remove the redundant private `queue` in `src/editor/render/markThumbnail.tsx`.
   - Verify with `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build:web`.

2. **PR 2 — Gesture Overlays & Hit-Test Worklet Optimization (Small, Frame Rate):**
   - In `src/editor/canvas/LiveStrokeOverlay.tsx` (`StrokeErasedDrawing`), batch untouched strokes vs. dimmed strokes into two group passes instead of mounting a separate `<DimmedStroke>` `useDerivedValue` per stroke.
   - In `src/editor/canvas/useToolStroke.ts` / `src/editor/layers/strokes.ts`, add an AABB bounding box pre-check to `strokesHitBy` on the UI thread before segment iteration.
   - In `src/editor/layers/redaction/RedactionLayerView.tsx`, pass document bounds to `recordRedactionStrokes` instead of unbounded `1_000_000`.

3. **PR 3 — Stroke Path Cache Decoupling (Medium, Commit Latency):**
   - In `src/editor/layers/drawing/DrawingLayerView.tsx`, decouple `pathFor` from mutable stroke object identity (e.g. cache uncentered stroke paths by stable ID and apply translation, or offset cached paths) so adding a stroke does not invalidate all prior cached `SkPath` objects.
   - Keep `recenterDrawing` and `src/projects/projectFile.ts` coordinate serialization completely unchanged.
   - Verify with `strokes.test.ts` and `projectFile.test.ts`.

4. **Documentation & Issue Filing:**
   - Update `docs/plans/editor-audit.md` to correct factual errors (remove phantom file references, annotate the rejected memoization sweep).
   - Per AGENTS.md, file GitHub issues for remaining items deferred to the backlog:
     - Issue: Unify polyline-walking helpers (`segmentsNear`, `alongLine`, `eachAlong`) in `src/editor/layers/strokes.ts`.
     - Issue: Decouple `StaticLayerRow` from drag hooks in `LayersPanel.tsx`.
     - Issue: Deduplicate HSV math between `TextStylePanel.tsx` and `ui/ColorPicker.tsx`.
