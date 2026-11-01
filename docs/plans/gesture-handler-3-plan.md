# Gesture Handler 3 Hooks Migration Plan

Migration plan for issue [#22: Migrate gestures to Gesture Handler 3's hooks API](https://github.com/nverkhachoyan/tuck/issues/22).

## 1. Overview and Motivation

React Native Gesture Handler 3 deprecates the `Gesture.*` builder pattern in favor of React hooks (`usePanGesture`, `useTapGesture`, `usePinchGesture`, `useRotationGesture`, `useHoverGesture`, `useSimultaneousGestures`, `useCompetingGestures`).

Because hook gestures and builder gestures cannot be related to each other via composition or external relations, the canvas's composed gestures must migrate together in one atomic step. Standalone components (`Dial`, `ColorPicker`, `BottomSheet`, `LayerRow`) can also be migrated to v3 hooks, allowing us to drop `LegacyScrollView` in `LayersPanel`.

## 2. API Differences and Key Behaviors

1. **Callback Renames & Signatures**:
   - `onStart` → `onActivate`
   - `onEnd((event, success) => ...)` → `onDeactivate((event) => ...)` where `event.canceled` indicates failure/cancelation (`success` is `!event.canceled`)
   - `onChange` is replaced by `onUpdate` with `event.changeX` / `event.changeY`
   - `onBegin`, `onUpdate`, `onFinalize`, and touch callbacks (`onTouchesDown`, `onTouchesUp`, etc.) remain supported
2. **Relations**:
   - `blocksExternalGesture(ref)` → `block: gesture` (takes gestures rather than component refs)
   - `requireExternalGestureToFail(ref)` → `requireToFail: gesture`
   - `simultaneousWithExternalGesture(ref)` → `simultaneousWith: gesture`
3. **Composition**:
   - `Gesture.Simultaneous(a, b)` → `useSimultaneousGestures(a, b)`
   - `Gesture.Race(a, b)` → `useCompetingGestures(a, b)`
   - In RNGH v3, `useComposedGesture` automatically inlines / flattens same-type compositions (`gestures.flatMap(g => isComposedGesture(g) && g.type === type ? g.gestures : [g])`), which resolves the AGENTS.md quirk where `Gesture.Simultaneous` dropped nested relations.
4. **Hook Lifecycle**:
   - Hooks must be invoked unconditionally in the component or custom hook body according to the Rules of Hooks (not wrapped in `useMemo` factories).
   - `enabled: boolean` is used to toggle gestures dynamically instead of conditional hook calls.

## 3. Implementation Steps

### Phase 1: Standalone Component Gestures
- **`src/ui/BottomSheet.tsx`**:
  - Replace `Gesture.Pan()` in `useMemo` with top-level `usePanGesture({ activeOffsetY: [-8, 8], onUpdate, onDeactivate })`.
  - In `onDeactivate`: `if (!event.canceled && coast > height.value / 3) ...`.
- **`src/ui/ColorPicker.tsx`**:
  - Replace `Gesture.Pan()` in `useFieldPan` with `usePanGesture({ runOnJS: true, minDistance: 0, onBegin, onUpdate, onFinalize })`.
- **`src/editor/shell/Dial.tsx`**:
  - Replace `Gesture.Pan()` and `Gesture.Tap()` with `usePanGesture` and `useTapGesture`.
  - Compose with `useCompetingGestures(pan, reset)`.
- **`src/editor/layers/panel/LayersPanel.tsx` & `src/editor/layers/panel/LayerRow.tsx`**:
  - Drop `LegacyScrollView` in `LayersPanel.tsx` in favor of `ScrollView` from `react-native-gesture-handler`.
  - Capture `scrollGesture` via `onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER`.
  - In `LayerRow.tsx`, pass `scrollGesture` and use `usePanGesture({ minDistance: 0, block: scrollGesture ?? undefined, onActivate, onUpdate, onFinalize })`. Remove `scrollRef` prop.

### Phase 2: Canvas Composed Gestures
- **`src/editor/canvas/useCanvasTap.ts`**:
  - Replace `Gesture.Tap()` with `useTapGesture({ maxDistance: TAP_SLOP_PX, onDeactivate })`.
- **`src/editor/canvas/useDialDrag.ts`**:
  - Accept `tap: TapGesture` instead of `LegacyTapGesture`.
  - Use `usePanGesture({ activeOffsetX: [-ACTIVE_PX, ACTIVE_PX], failOffsetY: [-FAIL_PX, FAIL_PX], enabled: Boolean(drag), onActivate, onUpdate, onFinalize })`.
  - Use `useCompetingGestures(pan, tap)` and return `drag ? competing : tap`.
- **`src/editor/canvas/usePaintGesture.ts`**:
  - Replace `Gesture.Pan().minDistance(0)...` with `usePanGesture({ minDistance: 0, onTouchesDown, onBegin, onUpdate, onFinalize })`.
- **`src/editor/canvas/useViewGesture.ts`**:
  - Replace `Gesture.Pinch()` and `Gesture.Pan()` with `usePinchGesture` and `usePanGesture`.
  - Compose with `useSimultaneousGestures(pinch, pan)`.
- **`src/editor/tools/crop/useCropGesture.ts`**:
  - Replace `Gesture.Pan()` and `Gesture.Hover()` with `usePanGesture` and `useHoverGesture`.
  - Compose with `useSimultaneousGestures(hover, pan)`.
- **`packages/skia-text-input/src/useCanvasTextGesture.ts`**:
  - Replace `Gesture.Pan()` and `Gesture.Hover()` with `usePanGesture` and `useHoverGesture`.
  - Compose with `useSimultaneousGestures(hover, pan)`.
- **`src/editor/canvas/useLayerTransformGesture.ts`**:
  - Replace `Gesture.Tap()`, `Gesture.Pan()`, `Gesture.Pinch()`, `Gesture.Rotation()`, and `Gesture.Hover()` with `useTapGesture`, `usePanGesture`, `usePinchGesture`, `useRotationGesture`, and `useHoverGesture`.
  - Compose with `useSimultaneousGestures` and `useCompetingGestures`.
- **`src/editor/EditorCanvas.tsx`**:
  - Compose `modeGesture`, optional `gesture` (`dragsSelection`), and `viewGesture` using `useSimultaneousGestures`. Drop `.toGestureArray()`.

### Phase 3: Learnings and Documentation Updates
- Update `AGENTS.md` to document RNGH v3 hooks behavior (automatic flattening of same-type compositions, removal of `toGestureArray()`).
- Update `docs/plans/follow-ups-plan.md` to note issue #22 status.

### Phase 4: Verification
- Run `pnpm check` (Biome linting and formatting).
- Run `pnpm typecheck` (TypeScript check across root and packages).
- Run `pnpm test` (Unit tests for editor, math, layout, and document logic).
- Run `pnpm build:web` (Metro web export and CSP verification).
