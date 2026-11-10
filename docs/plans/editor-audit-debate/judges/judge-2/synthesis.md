## Verdict

**Recommended Option: Position B (Targeted hot-path and correctness fixes only), constrained by Position C’s invariant and verification guards — Confidence: Medium.** Position B wins narrowly (4.00 vs. 3.95 for C and 2.80 for A) by focusing on verified UI-thread and commit-time bottlenecks (`strokesHitBy` AABB rejection, `drawingPieces` bounds precomputation, `StrokeErasedDrawing` hook reduction, and `addStroke` path-cache preservation) as small, unit-testable PRs while rejecting the illusory `Editor.tsx` memoization sweep and `ToolSpec` refactor. Confidence is **medium** because codebase verification at `HEAD` shows C was right to distrust unverified prescriptions: three remedies endorsed by A and B (and partly conceded by C) contain flaws against Skia 3 (`react-native-skia@3.9.0`) and layer coordinate spaces that would cause regressions if implemented as written.

## Criteria scoring

| Criterion | Weight | A | B | C | Note |
| :--- | :-: | :-: | :-: | :-: | :--- |
| **C1: Evidence fidelity** | 25% | 2 | 3 | 4 | C caught phantom `sampleColor.ts`, mislocated specs, `LayersPanel.tsx:109,128` unmount guards, `useCropTool.ts:109` memoization, and zero `React.memo`. A repeated false premises until rebuttal; B avoided `Editor.tsx` churn but accepted flawed overlay/WebGL claims. |
| **C2: User-visible impact** | 25% | 4 | 5 | 3 | B targets real UI-thread worklet costs (`strokesHitBy` at `useToolStroke.ts:238,309`; `StrokeErasedDrawing` at `LiveStrokeOverlay.tsx:268`) and $O(N^2)$ commit rebuilds (`DrawingLayerView.tsx:60`). C deferred hot-path fixes behind issues before conceding three in closing. |
| **C3: Regression risk & invariant safety** | 20% | 2 | 4 | 5 | C best defended Hard Constraints 3–5 (`recenterDrawing` origin math in `strokes.test.ts:48–135`, `projectFile.ts` compatibility, Skia layer clipping). A's broad rewrite across `Editor.tsx`, `defineTool.ts`, and `layers/` carried the highest blast radius. |
| **C4: Net readability & maintainability** | 15% | 4 | 3 | 4 | A's unification of triplicated polyline walkers (`segmentsNear`, `alongLine`, `eachAlong`) addresses real debt; C's audit correction + issue discipline prevents speculative clutter; B leaves duplicate walkers beside hot-path edits. |
| **C5: Cost & reviewability** | 15% | 2 | 5 | 4 | B's surgical PRs are small and verifiable via `pnpm test`, `pnpm typecheck`, and `pnpm build:web`. A's roadmap inflates review scope; C's upfront 16-issue triage delays trivial pure-TS fixes. |
| **Weighted total** | **100%** | **2.80** | **4.00** | **3.95** | **Position B wins narrowly, requiring C's invariant checks on Skia changes.** |

## Claim ledger

| Claim ID | Status | Evidence quality | Note |
| :--- | :--- | :--- | :--- |
| **A1** | Partially refuted | Weak | `pathFor` cache eviction (`DrawingLayerView.tsx:60–69`) is real, but unifying walkers is not a prerequisite for fixing cache identity (B2/PC4). |
| **A2 / B3** | Partially refuted | Weak | `<DimmedStroke>` (`LiveStrokeOverlay.tsx:309–323`) $O(\text{strokes})$ hooks and `strokesHitBy` (`strokes.ts:332–355`) missing AABB checks are verified, but passing document bounds to `recordRedactionStrokes` (`LiveStrokeOverlay.tsx:458`) and splitting `StrokeErasedDrawing` into two groups break rendering. |
| **A3 / B1** | Partially refuted | Weak | Moving `markThumbnail.tsx:19`'s queue into `drawOffscreen.web.ts` is good hygiene, but `snapshot.makeRasterImage()` on web reads pixels synchronously inside `new Promise` (`JsiSkImage.js:110–135`). |
| **A4 / B5 / PC2** | Upheld (B/C) | Strong | Conceded by A. `src/editor` has zero `React.memo`; `useCropTool.ts:109` memoizes `fit`; `useAdjustTool.ts:81–86` only syncs when `saved` changes. |
| **A5 / B6** | Upheld (B/C) | Strong | All agreed P2 items (`Dial.tsx:212`, `TextStylePanel.tsx:140`, `sameDocument` at `editorSlice.ts:774`) and `ToolSpec` rewrites are non-hot-path churn. |
| **B2 / PC4** | Upheld (modified) | Strong | `addStroke` (`strokes.ts:114–134`) calls `recenterDrawing` (`L91–108`), evicting `WeakMap<MaskStroke, SkPath>`, while `strokes.test.ts:48–135` and `projectFile.ts` require preserving `recenterDrawing` coordinates. |
| **B4** | Upheld | Strong | `drawingPieces` (`drawingEdits.ts:336–366`) recomputes `strokeBounds` inside `inkTouches` ($O(P^2)$) instead of once per stroke ($O(P)$). |
| **PC1 / PC5** | Upheld | Strong | Verified at `HEAD`: `defineTool.ts`/`builtInSpecs.ts` live in `src/editor/`, `sampleColor` is in `renderDocument.tsx:73`, `LayersPanel.tsx:109,128` unmounts when closed, and AGENTS.md mandates issues for deferred findings. |
| **PC3** | Partially refuted | Weak | Right on `sameDocument`/`Dial.tsx`; wrong to dismiss $O(N^2)$ `SkPath` rebuilds and `strokesHitBy` walks in 200-mark sessions ([#95](https://github.com/nverkhachoyan/tuck/issues/95)). |

## Crux rulings

### Crux 1: WebGL offscreen surface concurrency in `drawOffscreen.web.ts`
- **Hinges on:** Whether `snapshot.makeRasterImage()` (`drawOffscreen.web.ts:48`) reads GPU memory asynchronously across `await`, and whether a module-level queue is safe.
- **Ruling:** **C is right on `HEAD` mechanics; A/B/C are right to land the queue anyway.** In `react-native-skia@3.9.0` (`JsiSkImage.js:110–135`), `makeRasterImage()` returns `new Promise(resolve => resolve(this.copyToRaster()))`. Because `new Promise` runs its executor synchronously, `copyToRaster()` (`this.ref.readPixels`) runs **synchronously** in the same tick as `surfaceFor`, `drawPicture`, and `makeImageSnapshot`—before `await` yields. Thus `surfaceFor` cannot call `loseContext()` mid-readback today. Still, moving `markThumbnail.tsx:19`'s linear queue into `drawOffscreen.web.ts` is deadlock-free, removes duplicate queueing, and prevents `idleTimer` (`L54–58`) or `offscreenPhotos` thrashing across `await drawAsPicture`.

### Crux 2: Stroke identity preservation on `addStroke` vs. `recenterDrawing` invariants
- **Hinges on:** Eliminating $O(N^2)$ `SkPath` rebuilds without mutating `recenterDrawing` origin semantics or breaking `projectFile.ts` / `strokes.test.ts`.
- **Ruling:** **Upheld for C on invariants and B on the target—with a correction to all closings.** Every agent proposed caching `SkPath` by stroke ID and calling `SkPath.offset(dx, dy)`. In Skia 3 (`Path.d.ts:43–141`), **`SkPath` is immutable and has no `.offset()` method** (`offset` is on `SkPathBuilder`), and returning an un-translated `SkPath` after `recenterDrawing` shifts `points` by `(-centerX, -centerY)` would misplace prior strokes. Cache each stroke's `SkPath` with its center offset and translate via `Skia.PathBuilder.Make().addPath(cachedPath, matrix).build()`.

### Crux 3: Action scope and repository governance
- **Hinges on:** Structural roadmap (A) vs. surgical hot-path PRs + issues (B) vs. issue triage and device profiles first (C).
- **Ruling:** **Position B’s narrowed scope + Position C’s issue discipline wins.** Pure-TS wins (`strokesHitBy` AABB, `drawingPieces` bounds, `drawOffscreen.web.ts` queue) are unit-testable now without device harnesses; refuted refactors are dropped and deferred debt becomes GitHub issues per AGENTS.md.

## Conditional recommendations

- **Position B (Recommended):** Land small, test-backed PRs for verified hot paths (`drawOffscreen.web.ts` queue, `strokesHitBy` AABB + `drawingPieces` bounds, safe `pathFor` caching, paint-order-safe `StrokeErasedDrawing`), correct `docs/plans/editor-audit.md`, and file issues for remaining debt.
- **Position C:** During a pre-release freeze where only reproduced bugs may land before device benchmarks ([#95](https://github.com/nverkhachoyan/tuck/issues/95), [#97](https://github.com/nverkhachoyan/tuck/issues/97)).
- **Position A (narrowed 3-PR closing):** When scheduling a dedicated `src/editor/layers/` cleanup pairing polyline-walker unification (`segmentsNear`, `alongLine`, `eachAlong`) with `strokes.test.ts` coverage.

## What would change my verdict

1. **To Position C:** Profiling 200 marks in a Release build ([#95](https://github.com/nverkhachoyan/tuck/issues/95)) shows `addStroke` path construction and `strokesHitBy` take `< 1 ms` per commit/frame.
2. **To Position A:** Adding AABB rejection to `strokesHitBy` requires touching `alongLine` and `eachAlong` anyway, making simultaneous unification smaller.

## Missed by the debate

1. **Partitioning `StrokeErasedDrawing` into two groups breaks eraser paint order:** `DrawingLayer.strokes` interleaves `"pen"` and `"eraser"` (`blendMode: "clear"`) strokes (`DrawingLayerView.tsx:82–83, 199–205`). Moving dimmed pen strokes into a second `<Group>` changes whether they draw before or after an eraser, corrupting rendering. Only contiguous untouched runs can share a group, or `DimmedStroke` should only wrap indices in `dimmedStrokes`.
2. **Passing document bounds to `LiveRedactionStrokes` clips layer-space coordinates:** `recordRedactionStrokes` (`RedactionLayerView.tsx:315–350`) records in centered layer space `[-halfWidth, +halfWidth]` padded by `filterReach` (`L425–434`), not document space `(0, 0, width, height)`.
3. **`pathFor` is also used by `RedactionLayerView.tsx:231` and `ImageLayerView.tsx:191`:** `paintRedaction` (`redactionEdits.ts:93`) calls `addStroke` → `recenterDrawing`, evicting brushed redaction `SkPath`s too.
4. **Wide-screen `EditorInspector` keeps `LayersPanel` mounted:** `EditorInspector.tsx:33` renders `<LayersPanel layout="inspector" open />` when `inspectorPinned` is true (`useEditorLayout.ts:50`), running `MarkThumbnail` → `drawOffscreen` after every stroke.
