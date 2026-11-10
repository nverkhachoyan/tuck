## Verdict
Recommend **Position B, applied by its own test** ("land only what has a demonstrable hazard or measurable cost, each with a test or measurement"), not by its closing list. Confidence: medium, because no agent measured anything and B and C's closings nearly converged. The biggest reason: the debate's one "consensus" urgent fix rests on a false premise. At the installed Skia (3.9.0), web `makeRasterImage` reads back synchronously inside the Promise executor, so no caller can free the surface mid-readback. Only checking the code separates real findings from plausible ones, which is B's method.

## Criteria scoring
Scores are for closing positions.

| Criterion | Weight | A | B | C | Note |
|---|---|---|---|---|---|
| C1 Evidence fidelity | 25% | 3 | 4 | 4 | B's brief made the race conditional, but its closing did not; C's early fact-checks were best, yet it conceded a race it had argued correctly against |
| C2 User-visible impact | 25% | 3 | 4 | 3 | C files the commit cost for later |
| C3 Regression risk | 20% | 2 | 3 | 4 | A and B commit to a cache fix with no workable design |
| C4 Readability | 15% | 4 | 3 | 3 | Only A removes the walker duplication |
| C5 Cost and reviewability | 15% | 2 | 4 | 4 | A's PR 2 couples refactor and performance |
| **Weighted total** | | **2.80** | **3.65** | **3.60** | B and C are effectively tied on score |

## Claim ledger
| Claim | Status | Evidence | Note |
|---|---|---|---|
| A1 (unification is a prerequisite) | Refuted | Strong | Cache identity is unrelated to the walkers; A's closing still bundles them |
| A1/B2 (identity lost on add) | Partially upheld | Strong | I ran `addStroke` 200 times per pattern: identity kept on 0/199 adds (handwriting moving rightward), 46/199 (scatter), 199/199 (strokes inside existing extent). "Virtually every stroke" overstates it. Runs at commit, off the gesture loop |
| A2 (1M×1M layer every frame) | Refuted | Strong | C is right: `recordRedaction` records a picture, and null `saveLayer` bounds follow the clip. Re-recording on each update is real |
| A2/B3 (`DimmedStroke`) | Partially upheld | Strong | O(strokes) mappers are real (`LiveStrokeOverlay.tsx:309`), but they rerun when `dimmed` changes, not "each frame" |
| A3/B1 (mid-readback race) | Refuted as argued | Strong | `JsiSkImage.ts:181-186`; `drawOffscreen.web.ts:34-48` is synchronous through readback |
| A4 (memoization, idle tools) | Conceded | Strong | No `React.memo`; `fit` memoized (`useCropTool.ts`); Adjust syncs only on `[values, held, saved]` |
| A5 (P2 polish) | Conceded | Strong | Off the hot path |
| B3.3 (AABB in `strokesHitBy`) | Upheld | Strong | Called per pointer update (`useToolStroke.ts:238`) with no box check; all agents accept it |
| B4 (`drawingPieces` hotspot) | Upheld; rebuttal refuted | Strong | C said it runs only on tapping Separate. `LayerSelectionBar.tsx:61` calls it, unmemoized, on every render of the bar for an unlocked selected drawing |
| B5, B6 (memoization, ToolSpec churn) | Upheld | Strong | Accepted by A's closing |
| PC1 (audit errors) | Upheld; conceded by A | Strong | `sampleColor.ts` absent; `LayersPanel.tsx:109,128` guard on `open` |
| PC2 | Upheld | Strong | Same evidence as A4 |
| PC3 ("microseconds") | Unverified | Weak | Nobody measured it, and the same goes for B's "noticeable hitching" |
| PC4 (`recenterDrawing` must stay) | Upheld, narrowly | Strong | Changing origins would change layer-transform semantics; caching does not need that |
| PC4 (queue deadlock) | Refuted; conceded | Strong | No nested calls, so a linear chain cannot deadlock |
| Closing fix (key by "persistent stroke IDs": A, B, C) | Refuted | Strong | `MaskStroke` (`strokes.ts:14-18`) has no id. Adding one touches the saved format or needs a sidecar |

## Crux rulings
**Crux 1: `drawOffscreen` concurrency.** Hinges on whether readback spans an async gap. **Ruling: it does not.** The Promise executor runs `readPixels` before `await` yields. The only gap left is one microtask before `snapshot.dispose()`, when a resumed caller could free the context. That is a small, unreproduced hazard. A queue is cheap hardening, safe if a failed render cannot poison the chain, and may replace `markThumbnail`'s queue. It is optional and not urgent. C was right at first, and its closing concession was unnecessary. If a future Skia makes web readback truly asynchronous, this reverses.

**Crux 2: stroke identity.** Hinges on whether a cache can survive recentering without changing saved geometry. **Ruling: possibly, but no agent presented a workable design.** There is no stroke ID, `pathFor`'s cached paths are shared and must not be mutated by `offset`, and recentering rounds points to 0.01, so a translated path only approximates a rebuilt one. `strokes.ts` must also stay free of Skia. Measure rebuild cost on the handwriting pattern first; file an issue if it is not visible.

**Crux 3: scope.** **Ruling: small PRs, gated by evidence.** Land now: AABB rejection, using boxes computed once for each `strokeTargets` entry rather than per event (a worklet cannot share the JS `boxes` WeakMap), and cached or memoized bounds for `drawingPieces`. Next, after a measurement: `DimmedStroke` and live redaction work. Correct the audit and file the remaining findings as issues, which AGENTS.md requires anyway. Reject A's sequencing.

**Missed crux: can `DimmedStroke` be batched as two groups?** **Ruling: not as described.** `DrawingLayerView.tsx:99-115` draws strokes in index order, with erasers and overlaps depending on it. Moving hit strokes into a separate group changes paint order. C's "zero-regression" label is wrong. Options that preserve order include re-recording only when `dimmed` changes, or grouping contiguous runs.

## Conditional recommendations
- **A:** only as a later, separate refactor: unify walkers behind `strokes.test.ts` with no behavior change.
- **B:** the default, whenever each PR carries a test or before/after number.
- **C:** if time for profiling is unavailable now, or #95 and #97 device runs show acceptable performance. File everything, then land only AABB.

## What would change my verdict
- Headless Chrome reproduces context loss or a corrupt export: serialization becomes the first PR.
- A profile on #95 shows commit rebuilds or eraser mappers costing nothing visible at 200 marks: shift to C.
- A measured commit stall of more than a frame or two: prioritize path caching, with a designed key.
- A real bug traced to walker divergence: A's unification moves up.

## Missed by the debate
- All three closings adopted the same nonexistent stroke-ID fix without checking the type.
- Nobody opened Skia's `makeRasterImage`, though Crux 1 turned on it.
- Bounding live redaction by the document saves little: its layers already follow the current clip. Pre-recording must keep prior marks and the live stroke inside one `DstIn` mask layer.
- "Serialize" also fixes nothing about the idle timer: it cannot fire during the synchronous section, so it was never a hazard either.
