## Verdict

Build **Position C as revised in its closing, taking its option 2 for `actsOn`**. That means an unscoped `clear` eraser, Idea 2's curve-based pruning, eraser-aware `hitTestDrawing`, live fade for whole shapes, removing `eraserSpec.actsOn`, one drawing per Pen session, and row swatches (7a). Confidence is **medium** on that core and **low** on choosing C over A. A and C converged on Cruxes 1–2, and the totals are a near-tie (C 4.00, A 3.95). The biggest reason for C: Idea 5 costs Criterion 3. Without Select (Idea 10), joined Pen sessions can't be moved apart again, and A conceded this and only offered to "trial" Idea 5. The Stroke eraser hasn't been shown to be needed yet. B conceded Crux 1's defects and the eraser-aware hit test.

## Criteria scoring

| Criterion | Weight | A | B | C | Note |
|---|---|---|---|---|---|
| Immediate utility & mental model | 30% | 5 | 4 | 4 | All three end on one unscoped rule. A adds one-swipe stroke removal. B's ink jumps when the finger lifts, a surprise. C's opening two-mode rule is gone once `actsOn` is removed. |
| Visual & geometric fidelity | 25% | 4 | 2 | 4 | B conceded all five defects in cut ink. A and C stay pixel-exact, and partly erased strokes keep their full box. |
| Non-destructive flexibility | 20% | 3 | 3 | 4 | Idea 5 joins sessions so they can't be moved apart (conceded by A and B). B's Merge down is opt-in. C keeps each session's own transform. |
| Architectural & runtime simplicity | 15% | 3 | 2 | 4 | B needs M-sized geometry, RDP simplification, and still an eraser-aware hit test (two erasure models). A adds a variant and per-stroke fade props. |
| Backward compat & evolution | 10% | 4 | 3 | 4 | A and C: no format change, only the lesson text changes. B: old eraser strokes stay alongside the new model, and the lesson needs rewriting. |
| **Weighted total** | 100% | **3.95** | **2.90** | **4.00** | |

## Claim ledger

| Claim | Status | Evidence | Note |
|---|---|---|---|
| A1 | Upheld | Strong | `starters` (`useEditorTools.ts` L224–229) gives every entry point the same `() => startTool(next)`. `startTool` skips `deselectOnDone`, so the drawing just made stays selected. |
| A2 (fidelity) | Upheld, conceded by B and C | Strong | `brushPaint` sets square caps for marker/ink and per-path `MARKER_OPACITY`. The defects are in `ideas.md` L108–116. |
| A2 (hit test must check erasers anyway) | Upheld, conceded by B | Strong | `MaskStroke.type` includes `"eraser"` (`strokes.ts` L15). Brush redactions use it. `layerStrokes` passes redaction strokes to `findLayerAt` → `hitTestDrawing`. |
| A4 (merge breaks highlighters) | Refuted | Strong | `ideas.md` L174–175 limits merging to ink drawings, and source-over is associative. |
| B2 | Upheld, but outweighed | Strong | `penExtent` says "Erasing never shrinks it" (L46). The boxes really are oversized, but A conceded only partly erased strokes. |
| B3 | Partially refuted | Strong | Merging is limited to ink. Old v5 erasers still block it unless they're cut on open. |
| B4 | Refuted, conceded | Strong | Brush redactions keep the loop over eraser strokes. `StrokesLesson.tsx` L194–204 and L260 count and teach stored erasers. |
| B5 | Partially upheld | Weak | Separate pieces would help Select. Speculative: Idea 10 is unbuilt and L-sized. |
| C1 (outline) | Refuted | Strong | `CANVAS_TOOLS.draw.restyles` is `null` (`canvasTool.ts` L71), so `outlinedLayerFor` never outlines a drawing. |
| C1 (`actsOn` trap) | Upheld | Strong | `eraserSpec.ts` L11, read by `editorChrome.ts` L44. A and B adopted removing it. |
| C3 | Upheld, conceded by A and B | Strong | `recenterDrawing` reframes a joined layer around both sessions' ink. |
| C4 (point-only emptiness) | Refuted, conceded | Strong | `straightStroke` returns two points, so erasing both ends leaves the middle visible. |
| C4 (`WeakMap` worklet) | Refuted, conceded | Strong | `layerTargets.ts` L58 runs `shapeOutline` on the JS thread. |

## Crux rulings

**Crux 1 (clear + pruning vs. splicing): A/C win.** It hinges on whether exact boxes for partly erased strokes are worth visible ink changes. `PRODUCT.md` says "the image matters more than the tools". B conceded every defect and that the hit test has to check erasers anyway, which removes B4's simplicity advantage. The leftovers of A's approach show up only as a box too large on the erased side.

**Crux 2 (`actsOn`): remove it.** It hinges on whether the entry point should change what the eraser reaches. Nothing on screen would show it: drawings are never outlined, and every entry point calls the same starter. One rule, with Undo and Lock as the safety net, fits users who "won't learn it". C's own option 2 agrees.

**Crux 3 (Idea 5): reject it for now.** It hinges on whether there's a way to separate sessions again. Until Idea 10 exists there isn't, and A and B both conceded the cost. The benefit is a tidier Layers panel, which this utility's users rarely open, and 7a already tells the rows apart.

**Crux 4 (Stroke eraser + fades): ship the whole-shape fade, defer the Stroke eraser and per-stroke fade.** It hinges on whether the plumbing pays for itself. The shape fade reuses `LayerTarget.strokes` and is cheap, and it addresses the riskiest thing an unscoped eraser does: deleting whole shapes without warning.

**Missed crux: which layer types the unscoped eraser reaches.** It should reach drawings and shapes and never brush redactions, which also store eraser strokes. Wiping out part of a redaction by accident would expose what it hid.

## Conditional recommendations

- **A** if testing shows people scrub repeatedly to remove whole scribbles (then ship the Stroke eraser), or rarely move earlier sessions' marks on their own (then Idea 5's row savings win).
- **B** if Select (Idea 10) is committed and needs real sub-strokes. Even then, prefer B's fallback: run Idea 4's cutting only inside `mergeDrawings`, not on every erase.
- **C** for the core now, as recommended above.

## What would change my verdict

- Phone testing showing row clutter causes errors, or that people expect consecutive Pen sessions to be one object: favors A's Step 3.
- Canva (`prior-art.md`, flagged as uncertain) letting its eraser reach earlier Draw sessions while keeping them separate: supports C; joining them supports A.
- An eraser-aware `hitTestDrawing` turning out measurably slow on the UI thread with many stored erasers: that reopens B's case for cutting.

## Missed by the debate

- **Redaction exclusion** (above) should be stated outright in the spec and tests.
- **Live preview vs. commit:** the shared live path clears in every unlocked drawing, but the commit adds eraser strokes only to drawings whose padded strokes it crosses. The crossing test has to be conservative, or something visibly erased during the drag comes back on release.
- **Pen's own `actsOn`** (`penSpec.ts` L11) stays. Removing the eraser's leaves a drawing with Draw but not Erase in its action bar. Decide that on purpose.
