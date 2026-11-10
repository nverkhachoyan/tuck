# Debate Brief: Acting on the `src/editor` Readability & Performance Audit

Grounding document: [docs/plans/editor-audit.md](../editor-audit.md) (the "audit"), written against `HEAD` = `da0d580` on November 8, 2026.

## 1. Decision to be Decided

**How should the project act on the audit's four sections and its priority matrix?**

The audit makes ~16 findings across four areas (tool orchestration and memoization, stroke geometry, live Skia overlays and offscreen concurrency, panels/store polish) and proposes a P0–P2 roadmap. The question is what scope of work, in what order, the audit justifies.

### Position A — Execute the audit as a roadmap, structure first

Adopt the priority matrix substantially as written, including its structural refactors, because the readability refactors are the means of the performance wins:
- Unify stroke geometry (one `strokeBounds`, one segment walker, one `erasedAt`) in `layers/strokes.ts` and preserve stroke identity on `addStroke`.
- Fold `cut`/`removeBg` variant routing and `adjust`'s target choice into the tool spec; stabilize `useEditorTools`/`Editor.tsx` callbacks and memoize `editorContext`; gate idle tool hooks.
- Serialize `drawOffscreen` on web; batch `StrokeErasedDrawing`; pre-record and bound `LiveRedactionStrokes`; incremental live paths; AABB rejection in hit tests.
- P2 polish: split `LayerRow`, memoize `Dial` ticks, share HSV state with `ui/ColorPicker.tsx`, replace `JSON.stringify` in `sameDocument`.

### Position B — Targeted hot-path and correctness fixes only

Verify each finding, then land only those with a demonstrable correctness hazard or a measurable per-frame / per-edit cost, as small independent PRs each with a test or measurement:
- In: `drawOffscreen` serialization (if the race is real), stroke identity on add (`recenterDrawing` / `pathFor` cache), live-overlay per-frame work (`LiveRedactionStrokes`, `strokePath(unlanded(...))`, `StrokeErasedDrawing`), AABB rejection in `strokesHitBy`, precomputed bounds in `drawingPieces`.
- Out or deferred: the tool-spec generalization, the `Editor.tsx` memoization sweep, `LayerRow` split, HSV sharing, and helper unification beyond what a perf fix touches — unless a profile shows they matter.

### Position C — Verify, correct, and file; defer code changes

Treat the audit as unverified hypotheses. Spend the effort checking each claim against `HEAD` and (where it's about frame rate) on a device or in headless Chrome, correct the audit document, and file **one GitHub issue per confirmed finding** per AGENTS.md's Issues rules (templates, labels, `needs device`). Fix immediately only a confirmed correctness bug, if any. Performance and readability work is scheduled later from the issues, when it's tied to user-visible symptoms (e.g. #95's 200-mark Release build).

## 2. Weighted Evaluation Criteria

| # | Criterion | Weight | What it means |
| :- | :--- | :-: | :--- |
| C1 | **Evidence fidelity** | 25% | Are the findings the position acts on actually true at `HEAD` (paths, line ranges, call graphs, complexity claims)? Does the position avoid acting on misstatements? |
| C2 | **User-visible impact** | 25% | Frame rate during strokes/gestures, correctness (no corrupted renders, no races), responsiveness on web, iOS, and Android — weighted toward real usage (e.g. many marks, long strokes, exports). |
| C3 | **Regression risk & invariant safety** | 20% | Likelihood of breaking Skia/worklet/GC invariants (AGENTS.md learnings, docs/GOTCHAS.md), architecture boundaries, saved-project compatibility, or `docs/interactive` lessons. |
| C4 | **Net readability & maintainability** | 15% | Does the codebase get easier to read and change afterward? Duplication removed vs. new abstractions added. |
| C5 | **Cost & reviewability** | 15% | Effort, PR size, how verifiable each change is with `pnpm test` / `pnpm typecheck` / `pnpm build:web` vs. device-only checks. |

## 3. Hard Constraints

Any proposal must satisfy these (from AGENTS.md and docs/architecture.md):

1. **Import direction:** `app` → `screens` → `editor`; inside the editor, `document/` and lowercase `.ts` files in `layers/` stay plain TypeScript (no React, React Native, or Skia); `render/` and layer views never read the store; nothing but `builtInSpecs.ts` / `builtInTools.ts` imports a tool, and tools don't import each other.
2. **Tool hooks run above the `EditorContext` provider** (in `Editor`'s body via `useEditorTools`): they can't read the context and get what they need through `ToolEnv`, the store, or a shared preference. The list of tools is fixed for the editor's life (hooks called in a loop under a `biome-ignore`).
3. **Skia invariants:** document layers draw straight onto the canvas (no extra `Group layer` wrappers); saved layers are bounded by a clip; offscreen drawing goes through `drawOffscreen`; images from `decodedImages` are released and forgotten in the same cleanup; anything holding an image past its holder (an `SkPicture`) is cached by the decoded image; `beginRecording` gets explicit bounds.
4. **Worklets:** UI-thread helpers carry `"worklet"` and are declared above their callers (not hoisted); a worklet calls only worklets.
5. **Saved-project compatibility:** projects already saved (stroke `points`, layer `transform`) must keep loading and drawing identically (`src/projects/projectFile.ts`).
6. **Process:** `pnpm check`, `pnpm typecheck`, `pnpm test` (and `pnpm build:web` for `.web` files) pass; findings left undone become issues (AGENTS.md "Issues"); no new Biome import-boundary overrides; Hermes has no `toSorted`.

## 4. Shared Context & Precedent

### Size and layout (at `da0d580`)
- `src/editor`: ~31.9k non-test lines, ~11.3k test lines (the audit's "~43.2k" is both combined).
- Key files: `Editor.tsx` 744 lines, `useEditorTools.ts` 350, `canvas/LiveStrokeOverlay.tsx` 559, `canvas/useToolStroke.ts` 381, `layers/strokes.ts` 355, `layers/drawing/drawing.ts` 276, `layers/drawing/drawingEdits.ts` 486, `tools/text/TextStylePanel.tsx` 739, `shell/Dial.tsx` 284, `store/editorSlice.ts` 801, `layers/panel/LayersPanel.tsx` 537, `layers/panel/LayerRow.tsx` 368.
- Tool specs: 11 (`adjust`, `crop`, `cut`, `removeBg`, `eraser`, `find`, `pen`, `redact`, `shape`, `stickers`, `text`); each tool's `useController` is called every render of `Editor` from `useEditorTools.ts` (~L88–116).

### Orchestrator spot-checks (debaters should verify further)
- **Path errors in the audit:** `defineTool.ts` and `builtInSpecs.ts` live at `src/editor/defineTool.ts` and `src/editor/builtInSpecs.ts`, not under `src/editor/tools/`.
- **`drawOffscreen` callers:** `render/renderDocument.tsx` (3 call sites), `tools/cut/cutMask.tsx` (3), `render/markThumbnail.tsx` (1, behind its own `queue`), and `src/screens/export/useRenderedDocument.tsx` (1). `canvas/sampleColor.ts` does **not** call `drawOffscreen` (the audit lists it). In `drawOffscreen.web.ts`, the code between `await drawAsPicture(...)` and `await snapshot.makeRasterImage()` (surface sizing, clear, draw, snapshot) is synchronous; whether a concurrent call can free/grow `shared` while another awaits `makeRasterImage` on a snapshot of it is the real question. On native, `drawOffscreen` is plain `drawAsImage`.
- **`recenterDrawing`** (`layers/strokes.ts` ~L91–108) rounds the center to 0.01 and, unless the center is exactly 0,0, remaps every stroke's `points` into new objects. `DrawingLayerView.tsx` caches `SkPath`s in `WeakMap<MaskStroke, SkPath>` by stroke identity (`pathFor`). `recenterDrawing` is also used by `drawing.ts`, `drawingEdits.ts`, and `redaction/redaction.ts`, with tests in `layers/__tests__/strokes.test.ts`.
- **Memoization:** no React Compiler is configured and there is no `React.memo` anywhere in `src/editor`. `Editor.tsx` passes an inline `view` object to `useEditorTools` (~L238–242) and builds `editorContext` as an un-memoized literal (~L514–527). Whether stabilizing these changes what actually re-renders (when `Editor` re-renders, its children re-render anyway absent `memo`) is for debaters to establish.
- `sameDocument` (`store/editorSlice.ts` L767) does use `JSON.stringify` on `groups` (L774).
- Audit line ranges are approximate in places; cite current lines.

### Precedent
- [docs/plans/follow-ups-plan.md](../follow-ups-plan.md): open device checks, including 200 marks in an iPhone Release build ([#95](https://github.com/nverkhachoyan/tuck/issues/95)) and Stroke eraser dimming ([#97](https://github.com/nverkhachoyan/tuck/issues/97)); a prior performance plan was built and removed (git history before `1c2b056`).
- docs/architecture.md "Rendering": unbounded drawing layers dropped web to 11 fps at 50 layers ([#88](https://github.com/nverkhachoyan/tuck/pull/88)), fixed by `needsOwnLayer` + `inkRect` clipping.
- docs/GOTCHAS.md: freed-Skia-image races (`decodedImages`), and "An offscreen surface's dispose left its WebGL context alive" — the history behind `drawOffscreen.web.ts`.
- AGENTS.md "Worklets 0.13" note: callbacks captured by worklets leaked closed editors; `patches/react-native-worklets@0.13.0.patch`.

## Rules for Debaters

- Write only in your own `agent-<x>/` folder.
- Cite file paths and current line numbers at `HEAD`; tie every claim to a criterion (C1–C5).
- Don't run the app or change code; reading code, docs, tests, and `git log` is expected.
