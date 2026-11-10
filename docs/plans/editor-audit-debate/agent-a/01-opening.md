# Position A Opening: Execute the Audit as a Roadmap, Structure First

The editor audit exposes a fundamental reality: Tuck’s performance bottlenecks and architectural duplication are deeply coupled. Attempting piecemeal hot-path patches without resolving foundational structural duplication guarantees divergent logic, fragile worklets, and recurring regressions. Executing the audit as a prioritized P0–P2 roadmap—addressing core structure first—achieves maximal user-visible performance while reducing cognitive load and long-term maintenance costs.

---

### A1. Unifying stroke geometry is the prerequisite for preserving stroke cache identity (C1, C2, C3, C4)
In `DrawingLayerView.tsx` (L60–69), `pathFor` caches built `SkPath`s in a `WeakMap<MaskStroke, SkPath>` keyed by stroke object identity. However, `addStroke` (`strokes.ts` L114–134) calls `recenterDrawing` (L91–108), which remaps every stroke’s `points` whenever the drawing center shifts by ≥ 0.01 px (virtually every pen stroke). On the 50th stroke of a drawing, all 49 existing strokes receive new identities, evicting the entire cache and forcing 50 full `SkPath` rebuilds.
Piecemeal fixes cannot safely preserve identity because polyline walking and bounding boxes are duplicated with conflicting semantics across three modules: `segmentsNear` (`strokes.ts` L208–231), `alongLine` (`drawingEdits.ts` L246–265), and `eachAlong` (`drawing.ts` L199–218; inverted boolean stop condition); plus four separate bounding helpers (`strokes.ts` L48–64, `drawing.ts` L173–190, `drawingEdits.ts` L60–86, L283–300). Unifying stroke geometry in `strokes.ts` first establishes a single tested truth (`layers/__tests__/strokes.test.ts`), allowing stable stroke origins and AABB hit-test rejection in `strokesHitBy` (`strokes.ts` L332–355; `useToolStroke.ts` L238) without logic divergence.

### A2. Live Skia overlays must be bounded and batched to preserve 60/120 fps (C1, C2, C3)
During live strokes, `LiveRedactionStrokes` (`LiveStrokeOverlay.tsx` L456–474) invokes `recordRedactionStrokes` (`RedactionLayerView.tsx` L315–345) on every pointer event. Passing `bounds = null` defaults to `UNBOUNDED = 1_000_000` (L48), recreating a 1,000,000×1,000,000 layer, filter graph, and recording all existing marks from scratch every frame. Bounding with document size and pre-recording existing marks restores `O(1)` per-frame recording.
Similarly, `StrokeErasedDrawing` (`LiveStrokeOverlay.tsx` L268–323) wraps every stroke of every layer in a separate `<DimmedStroke>`, mounting `O(strokes)` Reanimated `useDerivedValue` hooks that evaluate `.includes(index)` each frame. Batching untouched vs. dimmed strokes into two groups per layer eliminates this hook overhead.

### A3. WebGL offscreen surface concurrency must be serialized at the module boundary (C1, C2, C3)
`drawOffscreen.web.ts` (L16, L28–59) manages a single shared `Offscreen` WebGL surface across asynchronous `await drawAsPicture` and `await snapshot.makeRasterImage` points. While `markThumbnail.tsx` (L19) maintains a private queue, external callers—`renderDocument.tsx` (L83), `cutMask.tsx` (L72), and `useRenderedDocument.tsx`—do not. Overlapping calls risk resizing or clearing `shared` during active rasterization. Enqueuing all executions inside `drawOffscreen.web.ts` eliminates this WebGL corruption hazard universally at near-zero cost.

### A4. Root orchestration cleanup and idle tool gating stop cascading UI churn (C1, C2, C4)
In `Editor.tsx`, the inline `view` literal (L238–242) and unstable closures in `useEditorTools.ts` (L88–116) invalidate `useCallback`/`useMemo` wrappers (L371–488). Crucially, un-memoized `editorContext` (L514–527) forces every context consumer (`EditorCanvas.tsx` L87, `CropCanvas`, tool panels) to re-render on any editor state update. Moreover, inactive tools run unconditionally: `useCropTool.ts` (L65–133) recalculates framing anchors and refits on every document edit, while `useAdjustTool.ts` (L81–86) dispatches `scheduleOnUI(syncAdjustments)` on native even when closed. Folding ~90 lines of leaky `cut`/`removeBg` and `adjust` target routing (`Editor.tsx` L371–457; `useEditorTools.ts` L176) into `ToolSpec` and gating inactive hooks stops continuous background CPU/thread churn.

### A5. P2 component and store polish completes architectural integrity (C4, C5)
- Decoupling `StaticLayerRow` (`LayersPanel.tsx` L330–349) from `LayerRow.tsx` (L80–137) removes dummy shared values and unused pan gestures.
- Memoizing `Dial.tsx` tick strips (L212–223) prevents re-rendering 91 `<View>`s per drag step.
- Sharing HSV math between `TextStylePanel.tsx` (L140–275) and `ui/ColorPicker.tsx` deletes ~135 duplicate lines.
- Replacing `JSON.stringify` in `sameDocument` (`editorSlice.ts` L774) eliminates repeated serialization during history traversal.

---

### Known Weaknesses
1. **Initial Scope and Batching Risk:** Executing P0–P2 requires multiple discrete PRs across pure TypeScript, React, and Skia layers. If poorly separated, changes risk bundling unrelated concerns.
2. **Profile Validation Gap on Minor Items:** P2 improvements (Dial ticks, `sameDocument`) are hygienic cleanups whose real-world frame-time savings are modest compared to P0 stroke cache thrashing.
3. **Inactive Hook State Gating:** Gating hooks like `useCropTool` when `!open` requires careful synchronization to ensure initial state correctly initializes upon activation without delayed reframes.
