# Position C Opening: Verify, Correct, and File; Defer Code Changes

Position C treats [docs/plans/editor-audit.md](../../editor-audit.md) as unverified hypotheses. Before modifying code, we must audit the audit against `HEAD`, verify performance claims against real profiles, correct misstatements, and file disciplined GitHub issues per AGENTS.md.

---

### PC1: The audit is compromised by factual errors and invalid runtime claims (Serves C1: Evidence Fidelity, Weight 25%)

Acting directly on the audit optimizes non-existent bottlenecks based on false premises:
1. **Mislocated files:** The audit locates `defineTool.ts` and `builtInSpecs.ts` under `src/editor/tools/`; both reside at [src/editor/defineTool.ts](../../../src/editor/defineTool.ts) and [src/editor/builtInSpecs.ts](../../../src/editor/builtInSpecs.ts).
2. **Phantom files:** The audit cites `src/editor/canvas/sampleColor.ts`; no such file exists. `sampleColor` is in [src/editor/render/renderDocument.tsx:73](../../../src/editor/render/renderDocument.tsx#L73).
3. **Muted citations:** `recordRedactionStrokes` is cited at `RedactionLayerView.tsx (L73–L108)` (which renders blurs); the worklet is at [src/editor/layers/redaction/RedactionLayerView.tsx:315–350](../../../src/editor/layers/redaction/RedactionLayerView.tsx#L315-L350).
4. **False architectural claim:** The audit claims [LayersPanel.tsx](../../../src/editor/layers/panel/LayersPanel.tsx#L84-L176) keeps `LayerRow` and `MarkThumbnail` mounted when `open === false`. In reality, [LayersPanel.tsx:109](../../../src/editor/layers/panel/LayersPanel.tsx#L109) (`{open && <BottomSheet>...}`) and [L128](../../../src/editor/layers/panel/LayersPanel.tsx#L128) (`{open && <Animated.View>...}`) explicitly guard mounting; nothing mounts when closed.
5. **False invalidation claim:** The audit claims [useCropTool.ts:65–133](../../../src/editor/tools/crop/useCropTool.ts#L65-L133) recomputes `fitRectToView` on every stroke/nudge. In fact, `fit` is memoized on `[settled, photoSize, viewSize]` ([L109](../../../src/editor/tools/crop/useCropTool.ts#L109)); when Crop is closed, `settled` never changes on document edits.

### PC2: The proposed memoization sweep yields zero performance improvement (Serves C1: Evidence Fidelity [25%], C5: Cost & Reviewability [15%])

The audit claims unstable callbacks in [useEditorTools.ts](../../../src/editor/useEditorTools.ts) defeat memoization in [Editor.tsx](../../../src/editor/Editor.tsx). However:
- `src/editor` contains **zero** `React.memo` calls. Without `memo`, child components re-render whenever `Editor` renders regardless of reference stability. Stabilizing callbacks or `editorContext` ([Editor.tsx:514–527](../../../src/editor/Editor.tsx#L514-L527)) prevents zero child re-renders.
- Active gestures (strokes, panning, zooming) operate via Reanimated shared values on the UI thread / Skia canvas, completely bypassing React re-renders of `Editor.tsx`.
- Refactoring `Editor.tsx` and `useEditorTools.ts` creates churn without measurable frame-rate or latency benefit.

### PC3: The audit diagnoses quiescent paths rather than measured frame-rate bottlenecks (Serves C2: User-Visible Impact, Weight 25%)

The audit identifies paper bottlenecks that do not degrade user experience:
- `addStroke` ([src/editor/layers/strokes.ts:114–134](../../../src/editor/layers/strokes.ts#L114-L134)) runs only on gesture commit (`onFinalize`), never inside the 60/120fps gesture loop. Rebuilding an `SkPath` once takes microseconds.
- `sameDocument` ([src/editor/store/editorSlice.ts:767–776](../../../src/editor/store/editorSlice.ts#L767-L776)) only runs `JSON.stringify` after all layers pass strict reference equality (`every(layer === b.layers[index])`), serializing 0–2 elements in nanoseconds.
- [Dial.tsx:122–133](../../../src/editor/shell/Dial.tsx#L122-L133) drives ruler and fill translation on the UI thread via `useAnimatedStyle`; `scheduleOnRN(setSteps)` only updates the accessibility and text label.
- [docs/plans/follow-ups-plan.md](../../follow-ups-plan.md#L24) explicitly notes: "Bugs to look into: None open." Genuine performance checkpoints—like [#95](https://github.com/nverkhachoyan/tuck/issues/95) (200 marks in Release) and [#97](https://github.com/nverkhachoyan/tuck/issues/97) (Stroke eraser dimming)—are already tracked for device testing.

### PC4: Premature code changes threaten critical invariants (Serves C3: Regression Risk & Invariant Safety, Weight 20%)

Unverified refactors jeopardize core system invariants:
- **Geometry & Saved Projects:** Altering `recenterDrawing` ([strokes.ts:91–108](../../../src/editor/layers/strokes.ts#L91-L108)) to preserve stroke identity threatens Hard Constraint 5 (saved-project serialization in [src/projects/projectFile.ts](../../../src/projects/projectFile.ts)), rotation centers, and tests in [strokes.test.ts:72–135](../../../src/editor/layers/__tests__/strokes.test.ts#L72-L135).
- **Skia Backdrop Filters:** Live redactions ([RedactionLayerView.tsx:289–300](../../../src/editor/layers/redaction/RedactionLayerView.tsx#L289-L300)) rely on `saveLayer` and `DstIn` compositing. Pre-recording without device checks risks breaking filters across Display P3 / sRGB color spaces or hitting web shader limitations (AGENTS.md Skia rules).
- **Concurrency Overkill:** On native, `drawOffscreen` is plain `drawAsImage`. On web ([drawOffscreen.web.ts:25–53](../../../src/editor/render/drawOffscreen.web.ts#L25-L53)), canvas drawing is synchronous once `drawAsPicture` resolves. Global queueing introduces deadlock risk without a reproducible collision.

### PC5: Process discipline minimizes review costs and preserves focus (Serves C4: Maintainability [15%], C5: Reviewability [15%])

AGENTS.md dictates: *"File an issue for what a change finds but leaves... One issue per finding; search open issues first... Write it with a template"*.
Position C follows this workflow: correct the audit doc, verify suspected regressions with reproduction scripts or headless Chrome, and file actionable issues (`needs device`, `tool:`). Code changes land only when backed by reproducible defects or profile measurements.

---

### Known Weaknesses of Position C

1. **Deferred cleanups:** Genuine low-risk duplications (e.g. polyline walking across `strokes.ts:208` and `drawingEdits.ts:246`) remain in the codebase until prioritized through issues.
2. **Upfront triage effort:** Verifying 16 findings and writing reproduction scripts/issues requires dedicated analytical labor without immediately visible code progress.
3. **Latent concurrency risk:** If an unobserved WebGL context collision does exist in `drawOffscreen.web.ts` during concurrent exports, it remains unpatched until reproduced.
