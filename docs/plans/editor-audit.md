# `src/editor` Readability & Performance Audit

Audited against `HEAD` on November 8, 2026 (`src/editor`, ~43.2k lines across source and tests).

## Scope & Guiding Principles

This audit evaluates `src/editor` along two axes—**readability** and **performance**—while preserving the architectural boundaries documented in [docs/architecture.md](../architecture.md) and [AGENTS.md](../../AGENTS.md):

- **One-way dependency flow:** `Editor.tsx` → `tools/` · `canvas/` · `shell/` → `layers/` → `document/`, with `render/` and layer views never reading the store, and `document/` plus lowercase `.ts` files in `layers/` staying pure TypeScript (no React, React Native, or Skia).
- **Skia invariants:** Document layers stay drawn straight onto the canvas (no extra `Group layer` wrappers that break backdrop filters or cost full-canvas render passes), and offscreen renders reuse a shared surface via `drawOffscreen`.
- **Healthy balance:** Prefer refactors that simultaneously reduce cognitive load (removing duplicated algorithms, dead memoization wrappers, and leaky special cases) and eliminate wasted runtime work (cache thrashing, UI-thread allocations, and redundant re-renders).

---

## 1. Root Orchestration, Tool Hook Fan-Out & Defeated Memoization (High Impact)

**Files:**
- [`src/editor/Editor.tsx`](../../src/editor/Editor.tsx)
- [`src/editor/useEditorTools.ts`](../../src/editor/useEditorTools.ts)
- [`src/editor/tools/defineTool.ts`](../../src/editor/tools/defineTool.ts)
- [`src/editor/tools/builtInSpecs.ts`](../../src/editor/tools/builtInSpecs.ts)
- [`src/editor/tools/crop/useCropTool.ts`](../../src/editor/tools/crop/useCropTool.ts)
- [`src/editor/tools/adjust/useAdjustTool.ts`](../../src/editor/tools/adjust/useAdjustTool.ts)

### Findings

1. **Every `useMemo` and `useCallback` in `Editor.tsx` is defeated by unstable references from `useEditorTools`:**
   - In [`Editor.tsx` (L238–L242)](../../src/editor/Editor.tsx#L238-L242), the `view` option passed to `useEditorTools` is an inline object literal `{ zoomToArea, fit, visibleArea }`.
   - In [`useEditorTools.ts` (L88–L316)](../../src/editor/useEditorTools.ts#L88-L316), `controllers`, `startTool` (`starters`), `layerStarters`, `busy`, `putDownTool`, `finishTool`, `cancelTool`, and `announcements` are created as fresh object/array/function literals on every render.
   - In [`Editor.tsx` (L371–L488)](../../src/editor/Editor.tsx#L371-L488), `isToolAvailable`, `busy`, `toolStarters`, and `toolEntries` wrap their bodies in `useCallback` / `useMemo`, but depend on `controllers`, `busyTools`, `startTool`, and `putDownTool`. Because those dependencies change identity on every render, the memoized blocks recompute and return new references on **every single render**.
   - [`editorContext` in `Editor.tsx` (L514–L527)](../../src/editor/Editor.tsx#L514-L527) is an un-memoized object literal with inline closures (`startEyedropper`, `toggleTray`, `closeTray`). Every render of `Editor` forces all consumers of `useEditorContext()`—including [`EditorCanvas.tsx` (L87)](../../src/editor/EditorCanvas.tsx#L87), `CropCanvas`, `StickerSheet`, and active tool panels—to re-render.

2. **All 11 tool controllers run unconditionally on every render of `Editor`:**
   - [`useEditorTools.ts` (L88–L116)](../../src/editor/useEditorTools.ts#L88-L116) invokes every tool's `useController` hook on every render, regardless of whether the tool is open (`open === false`).
   - Several inactive tool hooks subscribe to `document` and perform non-trivial work on every document edit:
     - [`useCropTool.ts` (L65–L133)](../../src/editor/tools/crop/useCropTool.ts#L65-L133) runs `framingAnchor(document)`, `fitRectToView(...)`, `cropViewBounds(...)`, and `turnLayersLabel(document.layers, anchor.layer)` whenever `document` changes (for example, on every committed pen stroke or layer nudge).
     - [`useAdjustTool.ts` (L81–L86)](../../src/editor/tools/adjust/useAdjustTool.ts#L81-L86) runs a `useLayoutEffect` that dispatches `scheduleOnUI(syncAdjustments, ...)` on native whenever `targetImage` changes, even when Adjust is closed.

3. **Leaky tool abstractions in `Editor.tsx` and `useEditorTools.ts` (Readability):**
   - Although [`defineTool.ts`](../../src/editor/tools/defineTool.ts) defines a uniform `ToolSpec` / `ToolController` contract (with `variants`, `activeVariant`, and `selectVariant`), [`Editor.tsx` (L371–L457)](../../src/editor/Editor.tsx#L371-L457) hardcodes ~85 lines of `"cut"` / `"removeBg"` variant state (`cutVariant`, `busy`, `toolStarters`, `toolEntries`), and [`useEditorTools.ts` (L176)](../../src/editor/useEditorTools.ts#L176) hardcodes `next === "adjust" && selectedImage ? selectedImage : targetImage`.

### Recommended Refactor

- **Fold `cut` / `removeBg` variant routing and `adjust` target resolution into `ToolSpec`:**
  - Generalize `ToolSpec.grouped` / `variants` so [`cutTool.ts`](../../src/editor/tools/cut/cutTool.ts) owns its variant delegation, and add a declarative target policy (e.g. `target: "photo" | "selectedImageOrPhoto"`) to [`builtInSpecs.ts`](../../src/editor/tools/builtInSpecs.ts). This removes ~90 lines of tool-specific branching from `Editor.tsx` and `useEditorTools.ts`.
- **Gate expensive work in inactive tool hooks:**
  - Short-circuit geometry and effect synchronization in `useCropTool` and `useAdjustTool` when `!open` (or separate static dock `canStart` checks from active session hooks).
- **Stabilize `editorContext` and action callbacks:**
  - Memoize `editorContext` in `Editor.tsx` and stabilize `startTool` / `putDownTool` / `finishTool` / `cancelTool` in `useEditorTools.ts` so `toolEntries` and `EditorContext` consumers only re-render when tool state or `previewUri` actually changes.

---

## 2. Stroke & Drawing Geometry: Duplication and $O(N)$ / $O(N^2)$ Bottlenecks (High Impact)

**Files:**
- [`src/editor/layers/strokes.ts`](../../src/editor/layers/strokes.ts)
- [`src/editor/layers/drawing/drawing.ts`](../../src/editor/layers/drawing/drawing.ts)
- [`src/editor/layers/drawing/drawingEdits.ts`](../../src/editor/layers/drawing/drawingEdits.ts)
- [`src/editor/layers/drawing/DrawingLayerView.tsx`](../../src/editor/layers/drawing/DrawingLayerView.tsx)
- [`src/editor/canvas/useToolStroke.ts`](../../src/editor/canvas/useToolStroke.ts)

### Findings

1. **Every committed stroke reallocates all existing strokes in the drawing and invalidates Skia's `SkPath` cache:**
   - [`addStroke` in `strokes.ts` (L114–L134)](../../src/editor/layers/strokes.ts#L114-L134) calls [`recenterDrawing` (L91–L108)](../../src/editor/layers/strokes.ts#L91-L108) on every committed pen or eraser stroke.
   - Whenever the bounding box center shifts by `>= 0.01px` (virtually every pen stroke), `recenterDrawing` maps over **every existing stroke** in the layer (`s.points.map(...)`), allocating new `Stroke` objects and new `points` arrays for all prior strokes.
   - Because [`DrawingLayerView.tsx` (L60–L69)](../../src/editor/layers/drawing/DrawingLayerView.tsx#L60-L69) caches built `SkPath` instances in a `WeakMap<MaskStroke, SkPath>` keyed by stroke object identity (`paths`), `recenterDrawing` **evicts every stroke in the layer from the `WeakMap`**. Adding the 30th stroke to a drawing forces Skia to rebuild all 29 prior `SkPath` objects from scratch.

2. **Triplicated polyline-walking and quadruplicated bounding-box helpers (Readability & Maintenance):**
   - Stepping along a flattened `points: number[]` polyline is implemented three times with subtly different signatures and inverted boolean conventions (`.some` vs `.every`):
     - [`segmentsNear` in `strokes.ts` (L208–L231)](../../src/editor/layers/strokes.ts#L208-L231) — stops when callback returns `true`.
     - [`alongLine` in `drawingEdits.ts` (L246–L265)](../../src/editor/layers/drawing/drawingEdits.ts#L246-L265) — stops when callback returns `true`.
     - [`eachAlong` in `drawing.ts` (L199–L218)](../../src/editor/layers/drawing/drawing.ts#L199-L218) — stops when callback returns `false`.
   - Point-cloud bounding boxes are implemented four times:
     - [`penExtent` in `strokes.ts` (L48–L64)](../../src/editor/layers/strokes.ts#L48-L64)
     - [`boundsOf` in `drawing.ts` (L173–L190)](../../src/editor/layers/drawing/drawing.ts#L173-L190)
     - [`strokeBounds` in `drawingEdits.ts` (L282–L300)](../../src/editor/layers/drawing/drawingEdits.ts#L282-L300)
     - [`missesBox` in `drawingEdits.ts` (L60–L86)](../../src/editor/layers/drawing/drawingEdits.ts#L60-L86)
   - Eraser lookahead is duplicated between [`erasedAt` in `strokes.ts` (L235–L247)](../../src/editor/layers/strokes.ts#L235-L247) and [`erasedAfter` in `drawingEdits.ts` (L269–L279)](../../src/editor/layers/drawing/drawingEdits.ts#L269-L279).

3. **UI-thread worklet hit-testing lacks AABB rejection and allocates inside pointer loops:**
   - In [`useToolStroke.ts` (`onSegment`, L216–L266)](../../src/editor/canvas/useToolStroke.ts#L216-L266) and [`hoveredStroke` (L296–L329)](../../src/editor/canvas/useToolStroke.ts#L296-L329), every pointer/mouse move invokes [`strokesHitBy` in `strokes.ts` (L332–L355)](../../src/editor/layers/strokes.ts#L332-L355) across every pen stroke of every target drawing on the UI thread **without checking the layer's `drawingBox` or per-stroke AABB first**.
   - `onSegment` also allocates closures (`inside`, `near`) and spreads `near = { ...(near ?? {}), [target.id]: true }` inside the per-frame UI worklet loop.
   - `eraseTargets`, `crossable`, and `strokeTargets` in [`useToolStroke.ts` (L134–L187)](../../src/editor/canvas/useToolStroke.ts#L134-L187) call `document.layers.find(...)` inside `targets.flatMap(...)` ($O(N^2)$ in layer count).

4. **Redundant work in `drawingPieces` and `pruneErased`:**
   - [`drawingPieces` in `drawingEdits.ts` (L305–L366)](../../src/editor/layers/drawing/drawingEdits.ts#L305-L366) checks all pairs of pen strokes with [`inkTouches` (L211–L241)](../../src/editor/layers/drawing/drawingEdits.ts#L211-L241), which recomputes `strokeBounds(a)` and `strokeBounds(b)` on every pair ($O(P^2)$) rather than precomputing bounds once per stroke ($O(P)$).
   - [`pruneErased` in `drawing.ts` (L222–L276)](../../src/editor/layers/drawing/drawing.ts#L222-L276) runs synchronously after every eraser swipe and allocates `strokes.slice(index + 1).filter(...)` and `boundsOf` repeatedly per stroke.

### Recommended Refactor

- **Unify stroke geometry primitives in [`strokes.ts`](../../src/editor/layers/strokes.ts):**
  - Export one worklet-safe `strokeBounds`, one `walkStrokeSegments` (with clear early-exit semantics), and one `erasedAt`. Delete the duplicates in `drawing.ts` and `drawingEdits.ts`.
- **Preserve stroke object identity when adding strokes:**
  - Keep stroke points relative to a stable origin (or store an offset / recenter only on transform/separate, or shift cached `SkPath`s with `path.offset(dx, dy)`) so `addStroke` does not rewrite every prior `Stroke` and flush `DrawingLayerView`'s `WeakMap`.
- **Add AABB rejection to `strokesHitBy` and precompute bounds in `drawingPieces` / `pruneErased`:**
  - Reject layers and strokes outside the segment's expanded bounding box in $O(1)$ on the UI thread before walking segments.

---

## 3. Skia Live Overlays & Offscreen Rendering Concurrency (High Impact)

**Files:**
- [`src/editor/render/drawOffscreen.web.ts`](../../src/editor/render/drawOffscreen.web.ts)
- [`src/editor/render/markThumbnail.tsx`](../../src/editor/render/markThumbnail.tsx)
- [`src/editor/canvas/LiveStrokeOverlay.tsx`](../../src/editor/canvas/LiveStrokeOverlay.tsx)
- [`src/editor/layers/redaction/RedactionLayerView.tsx`](../../src/editor/layers/redaction/RedactionLayerView.tsx)

### Findings

1. **Web offscreen surface concurrency hazard across `await` boundaries (`drawOffscreen.web.ts`):**
   - [`drawOffscreen.web.ts` (L25–L53)](../../src/editor/render/drawOffscreen.web.ts#L25-L53) shares a single module-level `shared: Offscreen | null` WebGL surface across two `await` boundaries (`await drawAsPicture(element)` at L31 and `await snapshot.makeRasterImage()` at L48).
   - While [`markThumbnail.tsx` (L19–L29)](../../src/editor/render/markThumbnail.tsx#L19-L29) serializes its own calls via a local `queue` promise, other callers of `drawOffscreen`—including [`renderDocument.tsx` (L83–L120)](../../src/editor/render/renderDocument.tsx#L83-L120), [`cutMask.tsx` (L72–L81)](../../src/editor/tools/cut/cutMask.tsx#L72-L81), and [`sampleColor.ts`](../../src/editor/canvas/sampleColor.ts)—do not share that queue.
   - If a mark thumbnail render overlaps with an eyedropper sample, a Cut mask operation, or a document thumbnail/export render, the concurrent call can resize/dispose `shared` (`surfaceFor`) or clear its canvas while the first call is awaiting `drawAsPicture` or `makeRasterImage`.

2. **Full `SkPicture` + filter graph rebuilt on every pointer move during live Redact painting:**
   - In [`LiveRedactionStrokes` (`LiveStrokeOverlay.tsx`, L443–L476)](../../src/editor/canvas/LiveStrokeOverlay.tsx#L443-L476), `useDerivedValue` calls [`recordRedactionStrokes` (`RedactionLayerView.tsx`, L73–L108)](../../src/editor/layers/redaction/RedactionLayerView.tsx#L73-L108) on every pointer move.
   - Each frame allocates a new `Skia.PictureRecorder()`, constructs the blur/pixelate/displacement-map filter chain (`redactionFilter`), replays **all existing `marks`** in the layer plus the live stroke from point `0`, and finishes recording with `bounds = null` (which falls back to `UNBOUNDED = 1_000_000` in [`RedactionLayerView.tsx`, L25–L31](../../src/editor/layers/redaction/RedactionLayerView.tsx#L25-L31)).

3. **Full `SkPath` rebuilt from index `0` on every frame of live strokes:**
   - [`LivePath` (L413–L424)](../../src/editor/canvas/LiveStrokeOverlay.tsx#L413-L424), [`LiveCutPath` (L427–L436)](../../src/editor/canvas/LiveStrokeOverlay.tsx#L427-L436), and [`erasePath` in `useToolStroke.ts` (L334–L337)](../../src/editor/canvas/useToolStroke.ts#L334-L337) call `strokePath(unlanded(stroke))` inside `useDerivedValue`, slicing the points array and reconstructing the entire `SkPath` from the first point on every pointer event ($O(N^2)$ over a single stroke).

4. **`StrokeErasedDrawing` mounts a `useDerivedValue` and `<Group>` per individual stroke:**
   - In [`StrokeErasedDrawing` (`LiveStrokeOverlay.tsx`, L268–L323)](../../src/editor/canvas/LiveStrokeOverlay.tsx#L268-L323), selecting the Stroke eraser renders a `<DimmedStroke>` component **for every pen stroke in every unlocked drawing layer**. On a drawing with 100 strokes, simply selecting the Stroke eraser mounts 100 separate Reanimated `useDerivedValue` mappers that each run `.includes(index)` on every frame.

### Recommended Refactor

- **Move the serialization queue into [`drawOffscreen.web.ts`](../../src/editor/render/drawOffscreen.web.ts):**
  - Enqueue all `drawOffscreen` calls inside `drawOffscreen.web.ts` itself so the shared WebGL surface cannot be mutated concurrently by any caller, and remove the redundant queue in `markThumbnail.tsx`.
- **Replace per-stroke `<DimmedStroke>` hooks with two batched `<Picture>`s (or `<Group>`s) per layer:**
  - In `StrokeErasedDrawing`, partition the layer's strokes into untouched vs. `hitIndices` (updating only when `hitIndices` changes), eliminating $O(\text{strokes})$ mounted `useDerivedValue` hooks.
- **Bound and pre-record `LiveRedactionStrokes`:**
  - Pass `{ width: document.width, height: document.height }` instead of `null` (`1_000_000`) to `recordRedactionStrokes`, and pre-record existing `marks` into a memoized `SkPicture` so the per-frame `useDerivedValue` only draws the cached picture plus the active live stroke.

---

## 4. Layer List, Tool Panels & Store Polish (Medium Impact)

**Files:**
- [`src/editor/layers/panel/LayersPanel.tsx`](../../src/editor/layers/panel/LayersPanel.tsx)
- [`src/editor/layers/panel/LayerRow.tsx`](../../src/editor/layers/panel/LayerRow.tsx)
- [`src/editor/tools/text/TextStylePanel.tsx`](../../src/editor/tools/text/TextStylePanel.tsx)
- [`src/editor/shell/Dial.tsx`](../../src/editor/shell/Dial.tsx)
- [`src/editor/store/editorSlice.ts`](../../src/editor/store/editorSlice.ts)

### Findings

1. **`LayersPanel` mounts heavy gesture/animated rows even when closed or static:**
   - [`LayersPanel.tsx` (L84–L176)](../../src/editor/layers/panel/LayersPanel.tsx#L84-L176) stays mounted inside `BottomSheet` when `open === false`, keeping every [`LayerRow`](../../src/editor/layers/panel/LayerRow.tsx#L80-L137) and its [`MarkThumbnail`](../../src/editor/render/markThumbnail.tsx#L53-L108) subscribed to document edits while hidden.
   - In [`GroupedLayerList` (`LayersPanel.tsx`, L330–L349)](../../src/editor/layers/panel/LayersPanel.tsx#L330-L349), `StaticLayerRow` creates 4 dummy `useSharedValue`s per row just to satisfy `LayerRow`'s signature, and `LayerRow` still attaches `usePanGesture` and `useAnimatedStyle` (which runs `order.value.indexOf(id)` per row) even when `staticRow` is `true`.

2. **Inline color picker duplication in `TextStylePanel.tsx` (Readability):**
   - At 739 lines, [`TextStylePanel.tsx`](../../src/editor/tools/text/TextStylePanel.tsx) is the fourth largest non-test file in `src/editor`. [`InlineTextColorPicker` (L140–L275)](../../src/editor/tools/text/TextStylePanel.tsx#L140-L275) duplicates ~135 lines of HSV state synchronization, hue/tone math, and accessibility stepping logic from `src/ui/ColorPicker.tsx`.

3. **Tick view count and mid-gesture state updates in `Dial.tsx`:**
   - For `Crop` (`max = 45`, `tickEvery = 1`), [`Dial.tsx` (L135–L223)](../../src/editor/shell/Dial.tsx#L135-L223) mounts **91 `<View>` children** inside the moving `Animated.View` strip. Its `useAnimatedReaction` ([L96–L115](../../src/editor/shell/Dial.tsx#L96-L115)) calls `scheduleOnRN(setSteps, shown)` on every step crossed during a drag, re-rendering all 91 tick views mid-gesture.

4. **`JSON.stringify` in `sameDocument` (`editorSlice.ts`):**
   - In [`editorSlice.ts` (L767–L776)](../../src/editor/store/editorSlice.ts#L767-L776), `sameDocument` compares `JSON.stringify(a.groups ?? []) === JSON.stringify(b.groups ?? [])` inside [`stepsByMark` (L714–L744)](../../src/editor/store/editorSlice.ts#L714-L744). A shallow loop over `LayerGroup` (`id`, `name`) is faster, clearer, and avoids string serialization during history scanning.

### Recommended Refactor

- **Split `LayerRow` into `LayerRowContent` (stateless row UI) and `DraggableLayerRow` (Reanimated + Gesture wrapper):**
  - `StaticLayerRow` renders `LayerRowContent` directly without dummy `useSharedValue`s, `usePanGesture`, or `useAnimatedStyle`. Also gate offscreen `MarkThumbnail` rendering while `LayersPanel` is closed (`!open`).
- **Share HSV slider state/components with `ui/ColorPicker.tsx`:**
  - Extract a shared `useHsvColorState` hook or `<HsvSliders>` component in `src/ui/ColorPicker.tsx` and reuse it in `TextStylePanel.tsx`.
- **Memoize the static tick strip in `Dial.tsx`:**
  - Extract `<DialTicks>` wrapped in `React.memo` so `setSteps` only updates the numeric label and accessibility value without re-rendering the 91 tick `<View>`s.
- **Replace `JSON.stringify` in `sameDocument`:**
  - Compare `a.groups` and `b.groups` by length and element `id` / `name`.

---

## Priority Matrix

| Priority | Focus Area | Primary Win | Effort |
| :--- | :--- | :--- | :--- |
| **P0** | Serialize all callers inside [`drawOffscreen.web.ts`](../../src/editor/render/drawOffscreen.web.ts#L25-L53) | Prevents WebGL offscreen surface corruption/races across `await` points | Small |
| **P0** | Preserve stroke identity on add & unify geometry helpers in [`strokes.ts`](../../src/editor/layers/strokes.ts), [`drawing.ts`](../../src/editor/layers/drawing/drawing.ts), and [`drawingEdits.ts`](../../src/editor/layers/drawing/drawingEdits.ts) | Eliminates `WeakMap<MaskStroke, SkPath>` cache thrashing & removes 3× duplicated line-walking code | Medium |
| **P1** | Stabilize [`useEditorTools.ts`](../../src/editor/useEditorTools.ts) / [`Editor.tsx`](../../src/editor/Editor.tsx) memoization, gate idle tool hooks, and fold `cut`/`adjust` special cases into `ToolSpec` | Stops full-tree context re-renders, stops idle tool work on every stroke, and removes ~90 lines of special-case branching | Medium |
| **P1** | Optimize live Skia overlays ([`LiveRedactionStrokes`](../../src/editor/canvas/LiveStrokeOverlay.tsx#L443-L476), [`StrokeErasedDrawing`](../../src/editor/canvas/LiveStrokeOverlay.tsx#L268-L323)) & UI-thread AABB pre-checks in [`useToolStroke.ts`](../../src/editor/canvas/useToolStroke.ts) | Preserves 60/120fps frame budget during long strokes and on drawings with many strokes | Medium |
| **P2** | Decouple `StaticLayerRow` from drag hooks in [`LayerRow.tsx`](../../src/editor/layers/panel/LayerRow.tsx), memoize [`Dial.tsx`](../../src/editor/shell/Dial.tsx) ticks, deduplicate [`InlineTextColorPicker`](../../src/editor/tools/text/TextStylePanel.tsx#L140-L275), and replace `JSON.stringify` in [`editorSlice.ts`](../../src/editor/store/editorSlice.ts#L767-L776) | Cleaner component boundaries and fewer mounted worklets/views | Small |
