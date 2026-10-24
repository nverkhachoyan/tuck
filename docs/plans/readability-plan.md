# Readability

A refactor plan for the code inside the folders, written October 2026, after the directory plan landed. The tree holds up now: `model/edits/`, `render/layers/`, a folder per tool, `session/`, and `detection/` each tell a reader where to look. What doesn't hold up is inside a few files. `EditorScreen` and `EditorCanvas` each have a function body of 500 lines or more, where the wiring the folders used to hide has piled up. A type parameter, two props mappers, and the store's list of action signatures exist only to reshape something from one form to another. This plan takes those apart. The app's behavior, the project file format, and the native modules stay as they are.

Each stage leaves the app building. A stage that turns out to need a behavior change stops and splits that change out.

## Rules for the work

**Moves and splits, not rewrites.** A stage moves code into a new function, hook, or file, or deletes a layer that only renames. It doesn't change what the code does. Where a stage merges two pieces of code that look alike, check that they really do the same thing first (stage 4 has one pair that doesn't).

**Pure logic goes where it can be tested.** When a stage pulls a decision out of a component (which layer is outlined, which tray is open, which actions a layer offers), it lands in a plain TypeScript module with a test in `__tests__/`, imported by relative `.ts` path as AGENTS.md describes. A decision that is already a pure function stays one.

**AGENTS.md and `biome.json` follow the code.** Where a stage breaks one of their rules on purpose, it changes the rule in the same commit, and says why in the commit body.

**`"worklet"` stays on the function**, and a helper a worklet calls is declared above it. A helper missing the directive still runs on web, where a worklet is plain JavaScript, and crashes only on native.

**A gesture hook returns a memoized gesture.** The canvas's `canvasGesture` memo depends on the gestures it composes, and the gesture hooks in `canvas/` already return theirs from `useMemo`. A new gesture built fresh each render makes that memo rebuild, and React Native Gesture Handler re-attaches it.

## How to work through it

* One stage at a time, in the order below. Each numbered step is its own `refactor:` commit (or `test:` where it only moves tests). Review with `git diff -M`.
* In the same commit, update every name the step changes: imports, `biome.json` overrides and their messages, `docs/architecture.md`, the Project Structure section of `AGENTS.md`, and any learning in `AGENTS.md` that names a moved or renamed declaration.
* Lessons quote declarations by name and by path (the `file` strings in each lesson, and `docs/interactive/src/source/sources.ts`). Of what this plan touches, `src/store/editorSlice.ts` has 16 SourceView tabs, fifteen names with `setDocument` quoted again from `IdentityLesson`: `setDocument`, `selectionAfter`, `addOnTop`, `selectLayer`, `nudgeLayer`, `undo`, `redo`, `beginSession`, `commitSession`, `cancelSession`, `pastBefore`, `selectCanUndo`, `selectCanRedo`, `EditorSnapshot`, and `EditorSession`. The path string also appears in imports and prose, 24 times in all. Lessons also quote `src/store/index.ts` (`useStore`) and the `model/layers/` files. `lessons/store/lessonStore.ts` calls `getState().openDocument()`, and `HistoryLesson.tsx` and `SessionsLesson.tsx` take `const actions = store.getState()` and call the actions on it. A step that touches any of these updates the lesson in the same commit and builds the lessons. `SourceView` finds a top-level declaration, or else the last nested `const` or `name:` (`extract.ts`), so a quoted local stays a `const` or a property under the same name.
* After every step: `npm run check`, `npm run typecheck`, `npm test`. When a quoted file changed: `npm run build --prefix docs/interactive`.
* Stages 3–5 change the editor's composition. After each of those steps, open the editor in the browser pane and try what the step touched: start a tool, Done, Cancel, a shortcut. Drags do not count there. The pane runs about two frames a second while hidden, and one drag move is not a pan, so a stroke or a layer drag is checked in headless Chrome over CDP, as AGENTS.md describes. On a device, the same stroke and a layer drag while autosave runs: a gesture rebuilt every render re-attaches underneath them.
* Stage 4 moves gesture code. Run the iOS simulator after the shared worklet step and after each gesture hook, not only at the end of the stage.
* Tick the step here when it lands, with the commit subject.

## Stage 1: Drop the text edit type parameter

- [x] `refactor: drop the editor mode's text edit type parameter`

`EditorMode`, `EditorModeState`, `EditorModeAction`, `editorModeReducer`, `settle`, and `useEditorMode` take a `TextEdit` type parameter only so that `useTextEditing.ts` can add two fields to `TextEditState`: `TextEditing = TextEditState & { initialSelection; area? }`. `TextEditState` already lives in `editorMode.ts`, and both fields are plain data. The reducer reads only `edit.layer.id`. `initialSelection` reaches `TextEditor` (`EditorScreen.tsx`), and `area` is read when `useTextEditing` finishes the edit.

What changes:

* `TextEditState` gains `initialSelection: TextSelection` and `area?: Rect` (a type import from `../../model/geometry.ts`), with the comment from `TextEditing` that says what they're for.
* `EditedText` and `TextEditing` go. The mode types and functions lose their parameter, and `EditorTool` becomes `Extract<EditorMode, { type: "tool" }>["tool"]`. `takesKeys`, `shortcutCommand`, `hasTray`, and `withoutLayers` lose their `<unknown>`. `useEditorMode` lives in `useEditorMode.ts` and loses its `<TextEdit extends EditedText>`.
* Callers drop `TextEditing`. There are 10 mentions, in `EditorScreen.tsx`, `EditorDock.tsx`, `useCanvasInput.ts`, and `useTextEditing.ts`. Code that wrote `TextEditing` writes `TextEditState`.
* The canvas's consumers (`EditorScene`, `EditedTextView`, `EditorCanvas`, `useTextEditGesture`) already take `TextEditState` and ignore the new fields.
* `editorMode.test.ts` builds edits as `{ layer: { id }, text: "" }`, which the parameter allowed. Its `edit(id)` fixture builds a full `TextEditState` instead (a text layer from `createTextLayer` with the id set, an empty selection, `focused: false`). The test "text changes only while typing" also writes a top-level `text` field and deep-equals `{ layer: { id }, text: "HELLO" }`. It changes `layer.text`, or `focused`, on that fixture.

## Stage 2: The store's state and its actions

- [x] `refactor: keep the editor store's actions under one actions object`
- [x] `refactor: import the store's selectors from editorSlice`

`EditorSlice` declares the action signatures in about 80 lines, and each is written again as a wrapper around `model/edits`. `useEditorActions` then selects 31 of them one at a time. This stage comes before the screen and the canvas split, so the hooks those stages add can read `state.actions` themselves.

What changes:

* Split the slice into `EditorState` (`document`, `projectId`, `selectedLayerId`, `past`, `future`, `session`) and `actions`, built by `createEditorActions(set, get)`. `get` returns `EditorState`. An action that calls another calls the local function: `updateSelectedText` calls the local `updateTextLayer`, not `get().actions.updateTextLayer`. Calling through `get().actions` while `get` returns the inferred slice makes TypeScript give that action an implicit `any` return (`TS7023`).
* The parameter types move onto each action. There are 39 actions and 73 parameters, and inference will not fill them in: an arrow function takes its parameter types from the type of the object it is placed in, and that type is what this step deletes. An untyped parameter is a required `any`, so `addTextLayer("x")` fails with "Expected 3 arguments, but got 1". The signature block goes away. The inline types take some of it back, so this is not a clean 80-line saving. The comments on the type move to the implementation, which already has most of them.
* The actions' type is `EditorStoreActions`. `useEditorActions.ts` already exports `EditorActions`, and `useCanvasInput.ts` and `LayersPanel.tsx` `Pick` from that hook type. Both import `EditorStoreActions` from the slice instead. `useEditorActions` goes, and so do the 47 one-action selectors across the app (49 `useStore((state) => state.…)` selectors, minus the two that read `projectId`).
* `actions` never changes, so `useStore((state) => state.actions)` re-renders nothing. Callers that read one action off `getState()` go through `.actions`: `useProjectSession.ts` (`closeDocument`, `openDocument`) and `lessonStore.ts` (`openDocument`). `HistoryLesson` and `SessionsLesson` take `const actions = store.getState()` and call `actions.addTextLayer` and the rest. Those become `store.getState().actions`.
* The selectors' parameter type changes from `EditorSlice` to `EditorState`. `selectSelectedLayer(get())` stops compiling while `get` returns only the data.
* `editorSlice.test.ts` makes 268 action calls through `getState().…(`. Take `actions` from the store once per test instead. It also imports `StoreState` from `store/index.ts`, which the next step deletes.
* The quoted names stay findable: the local helpers (`setDocument`, `selectionAfter`, `addOnTop`, `pastBefore`) stay `const`s, and the actions stay `name:` properties. Build the lessons.
* The second step: `store/index.ts` stays, since it holds `useStore` and imports React Native, which the slice's tests can't load. Its re-exports of the selectors and the `StoreState` alias go. Callers import selectors from `@/store/editorSlice`, the file that declares them. The test builds its store from `EditorSlice`.

## Stage 3: Shrink `EditorScreen`

`ScreenContent` is 673 lines (130–802). Four pieces leave it. Rename Adjust's hook first, so the tools object below is born with its final name.

### 3.1 Adjust's hook

- [x] `refactor: rename useAdjustController to useAdjustTool`

Adjust's hook is the only tool hook called a controller (`useDrawTool`, `useRedactTool`, `useFindTool`, `useCutOutTool`). Rename the file and the function. Crop's `useCropController` stays: it's internal to `CropTool`, not a hook the editor composes.

### 3.2 Questions about the mode

- [x] `refactor: ask editorMode which tray is open and which image a tool works on`

`mode.type === "tool" && mode.tool !== "adjust" && mode.optionsOpen` is written in `EditorScreen` (`toolOptionsOpen`) and again in `ToolTrays` (`tray`). `hasTray` in `editorMode.ts` is already the first two checks. `EditorScreen` also works out `adjustedLayer` and `cutLayer` with the same `mode.type === "tool" && mode.tool === …` test. Add to `editorMode.ts`, with tests:

* `openTray(mode)`: `hasTray(mode) && mode.optionsOpen`, or null. The tool whose tray is open.
* `toolImageId(mode, tool)`: the image Adjust or Cut out works on, or null when that tool isn't open.

### 3.3 How tools open and close: `useToolLifecycle`

- [x] `refactor: gather the tools' start, Done, and Cancel into useToolLifecycle`

A new `useToolLifecycle.ts` at the editor root takes the session effect (begin when a tool opens, commit when it closes), `startDrawing`, `startRedacting`, `startAdjusting`, `startCutOut`, `startFinding`, `closeTool`, `finishTool`, `cancelTool`, `backToRedacting`, `finishFinding`, `doneWithTool`, `cancelWithTool`, the crop trio (`startCrop`, `closeCrop`, `finishCrop`), and the `startTool` table. It reads the mode, `targetImage`, `documentSize`, the tool hooks, `textEditing`, `dispatchMode`, `pickPhoto`, `openStickers`, and a way to read the visible area for new text. The store actions come from `useStore((state) => state.actions)`, not from a parameter. It returns `{ startTool, done, cancel, finishTool, closeCrop, finishCrop }`. The screen's Find button uses `startTool.find`.

`useAddImage` stays in the screen and is called first: `startTool.photo` is its `pickPhoto`, and the hook does not use the lifecycle. The visible area is read lazily, `() => canvasRef.current?.visibleArea()`, so the ref does not have to be set before the hook runs.

Cut out's `onRedact` hand-off stays in the screen. It uses `cancelSession`, `addMaskedRedaction`, `redact.setChosen`, and `dispatchMode`, so it does not need the lifecycle's return value. It has to be built before `useCutOutTool`, and the lifecycle takes `cut` after that. The comments on why Done and Cancel differ per tool move with the code.

The session effect stays the first effect in the new hook, which keeps it ahead of the tool hooks' effects. None of those write the store from an effect today. Moving it later would still change the order effects run in.

After this step, in the browser pane: cancel after an Adjust drag, Find's Cancel going back to Redact, Cut out's hand-off to Redact, switching tools from the rail while one is open, and a tool's shortcut while typing. The Adjust drag itself is a CDP check.

### 3.4 Shortcuts

- [ ] `refactor: let useEditorShortcuts carry out the commands it finds`

`handleShortcut` and the `runShortcut` switch move into `useEditorShortcuts`, and the handlers are closed over there. The switch stays. It is already exhaustive through `assertNever`, and a handler table would leave all 17 handlers in the screen.

A mapped handler type does not compile here. `{ [T in ShortcutCommand["type"]]: (command: Extract<ShortcutCommand, { type: T }>) => void }` indexed by `command.type` is a union of functions, and calling it asks for an argument that fits every member, which is `never` (`TS2345`).

### 3.5 The tool hooks travel together

- [ ] `refactor: pass the editor's tool hooks to the dock as one object`

`draw`, `redact`, `find`, `cut`, `textEditing`, and `adjust` go to `ToolTrays` and `DockContent` one prop at a time, and `ModeProps` in `EditorDock.tsx` lists them. An `EditorTools` type there (`{ draw, redact, find, cut, adjust, text }`) replaces those fields, and both components take `tools`. `customColor` and `dispatchMode` stay separate props.

## Stage 4: Break up `EditorCanvas`

`EditorCanvas.tsx` is 1,020 lines. The component body after the parameter list is about 610 lines (233–842). The props type and its comments (98–206) are about 110 lines above that. The moves below do not bring the file under 500 lines. What remains is the props, the viewport and the selection gestures, and the JSX, so the file stays around 700 lines.

The 38-line comment on `EditorCanvas` is split in this stage: each paragraph moves with the hook it describes (the cursor, the tool strokes, Find). The broken wraps at lines 184–186 and 409–415 are fixed in the same edits.

### 4.1 Decisions about tools and layers, in one place

- [ ] `refactor: move the canvas's tool and layer checks into canvasInput`

`restyles` and `canAddTo` (at the bottom of `EditorCanvas.tsx`) and `drags` (in `canvasInput.ts`) all answer a question about a `CanvasTool` and a layer. Move the first two into `canvasInput.ts` beside `drags`. Turn the nested ternary that picks `outlinedLayer`, and `cuttingOutId`, into functions there too (`outlinedLayerFor`, `cutImageId`). Test all four in `canvas/__tests__/canvasInput.test.ts`.

Rename the canvas's `targetImage` (line 644) to `outlinedImage`. It is the image outlined while cutting out or adjusting, or `false` when there is only one image. `EditorScreen`'s `targetImage` is the image a tool works on.

### 4.2 One worklet for "the handle under this point"

- [ ] `refactor: share the live selection's handle check between the canvas's worklets`

`dragAlone` and `selectionDrag` both call `handleUnder(readLiveTransform(live), readLiveBox(live), live.resizeMode.value, point, viewport.scale)`. Pull that into one worklet, declared above both. **Don't merge the layer checks that follow it.** They differ on purpose: `dragAlone` asks whether the point hits the selection anywhere (`hitsLayer`, even under another layer), while `selectionDrag` asks whether the selection is the topmost layer there (`findLayerAt(…)?.id === id`). Run the iOS simulator after this step.

### 4.3 Lookups the gestures share

- [ ] `refactor: share the canvas's screen-to-document lookups`

`viewport`, `targets`, `scale`, `handleAt`, `layerAt`, and `tapAway` feed `handleTap`, `handleHover`, `handleStroke`, `handleDetectionTap`, `handleIdleTap`, and both worklets. Build one object of those lookups (`handleAt`, `layerAt`, `toDocument`, `tapAway`) for the hooks below to take. Without it, `useToolStroke` takes about 15 inputs.

`idleGesture` and `detectionGesture` are the same `Gesture.Tap().maxDistance(TAP_SLOP_PX).onEnd(scheduleOnRN…)`. One `useCanvasTap(handler)` covers both, and Adjust's tap keeps using the idle one.

### 4.4 Hooks out of the body

- [ ] `refactor: move the canvas's tool strokes into useToolStroke`
- [ ] `refactor: move Find's taps on the canvas into useFindTap`
- [ ] `refactor: move the canvas's hover cursor into useCanvasCursor`
- [ ] `refactor: move Shift and the text-focus press into their own hooks`

* `useToolStroke`: `strokePoints`, `strokeId`, `landedStrokeId`, `handleStroke`, the paint gesture, and `liveStroke`. It takes the lookups from 4.3.
* `useFindTap`: `handleDetectionTap` and its tap, built with `useCanvasTap`.
* `useCanvasCursor`: the cursor state, `handleHover`, and `handleHoverEnd`. It returns `setCursor` too, for the text gesture.
* `useShiftHeld` owns the shared value the resize gesture reads (`aspectLocked`) and the web key listeners. The other effect is a `mousedown` `preventDefault` so a press on the canvas does not steal focus from the text input. That is `useKeepTextFocus`, not a keyboard hook.

Each hook goes in `canvas/` beside the gesture hooks it resembles, and each gesture it returns is memoized. Run the iOS simulator after each of these steps.

### 4.5 The canvas's own controls

- [ ] `refactor: move FitButton and SelectionBarFrame out of EditorCanvas`

`canvas/FitButton.tsx` and `canvas/SelectionBarFrame.tsx`, which takes `SELECTION_BAR_GAPS` with it.

## Stage 5: The tools panel from a table

- [ ] `refactor: build the tools panel from a table of tools`
- [ ] `refactor: let LayerActionsPanel read its rows from that table`

`ToolsPanel.tsx` has eight near-identical `<ToolButton>` blocks, and `toolButtonsFor` exists only to turn `ToolStarters` into `onAddText`, `onDraw`, and the rest. `layerActionsFor` chooses which of those a layer offers. Both were pulled out of `EditorDock` in `9fbb66b`. `toolButtonsFor` goes. `layerActionsFor` stays: which actions a layer offers is pure logic, and it gains a test.

* A `TOOLS` table in `ToolsPanel.tsx` gives each tool its key, label, and icon, whether it needs an image, and which open tools mark it (Redact is marked while Find is open). `ToolsPanel` and `LayerActionsPanel` both read the label and the icon from it. `CutOutButton` exists only to share Cut out's look, and goes. Sticker in the layer panel stays its own row (`Saved` / `Sticker`).
* `ToolsPanel` takes `{ vertical, tool, addBusy, hasImage, startTool }` and maps the table. The order stays: Text, Draw, Redact, Sticker, Crop, Adjust, Cut out, Add photo.
* The rail passes its starters through `fromRail` once, with a small typed `mapStarters(starters, wrap)` beside `ToolStarters`.
* `LayerActionsPanel` takes `{ layer, startTool, sticker, onSaveSticker }` and renders the rows `layerActionsFor` returns. `DockContent`'s `layerActions` prop carries those four.

Check both the phone grid and the wide rail, and a blank canvas with no image, where Adjust and Cut out hide.

## Stage 6: Each layer's validation with its layer

- [ ] `refactor: move each layer type's validation into its model file`

`isLayer` in `projects/projectFile.ts` holds every layer type's shape check. Now that each type has its own file in `model/layers/`, adding a field to a layer touches that file and `projectFile.ts`. After this, it touches one.

* The shared checks `isFields`, `isPositive`, and `isColorOrNull` go in a new leaf module, `model/values.ts`. `isTransform` goes in `geometry.ts`, beside `Transform`. They do not go in `layers/base.ts`: `adjustments.ts` and `strokes.ts` would then import from `layers/`, and today the layer files import from them. `projectFile.ts`'s upgrades would also import `isFields` from a layer file. Neither is a cycle. Both point the wrong way.
* Each layer file gains its own check: `isImageLayer`, `isTextLayer` (which takes the `textFonts` import), `isDrawingLayer`, `isRedactionLayer`, `isShapeLayer`. The stroke checks go beside their types: `isStroke` in `layers/drawing.ts`, `isMaskStroke` in `strokes.ts`, `isCutStroke` in `layers/image.ts`. `isAdjustments` goes in `adjustments.ts`. Those files import the shared checks from `model/values.ts` and `geometry.ts`.
* `layers/layer.ts` gets `isLayer`, the switch over them.
* `projectFile.ts` keeps the file's envelope (`isSavedProject`, `isThumbnail`, `isDocument`, `isLayerGroup`) and the version upgrades, and imports `isFields` from `model/values.ts`.
* `projectFile.test.ts` keeps testing through `parseSavedProject`, which already rejects a damaged layer of each type. Add a test to a layer file's suite only where a check was hard to reach from there.
* This puts parsing code in `model/`. It's plain TypeScript, so the `model/` rule still holds. AGENTS.md's line on what a layer file holds gains "and its check for a saved layer".

## Stage 7: Small consistency fixes

- [ ] `refactor: share the document's size between the editor's hooks`
- [ ] `refactor: rename editorCanvasInput to canvasInputFor`

* Optional. `useMemo(() => ({ width: document.width, height: document.height }), …)` is written in `EditorScreen`, `EditorCanvas`, and `useFindTool`, three memos of four lines each. A `useDocumentSize(document)` at the editor root can replace them. `useFindTool` can instead take `size` from its caller. Skip this step if neither reads better.
* `editorCanvasInput.ts`, `useCanvasInput.ts`, and `canvas/canvasInput.ts` are hard to tell apart. The first exports `canvasToolFor` and `canvasInputFor`, and `useCanvasInput` is named after the second. Rename the file and its test to `canvasInputFor.ts`.

## Stage 8: Long doc comments

- [ ] `refactor: break the longest doc comments into lists`

Three doc comments run 15 lines or more as one paragraph: `useLayerTransformGesture` (37), `useCutOut` (22), and `liveTransform` (15). `EditorCanvas`'s comment is split in stage 4, with the hooks it describes. Rewrite each of these three as a sentence on what it is, then a short list, one line per behavior or parameter. Keep what they say and drop nothing true. A comment that only restated code was already trimmed in `3d2dde0` and `cf15dfb`. This changes the house style for long comments, so AGENTS.md gains a line for it.

## Considered and left out

* **Splitting the image cache** (`imageCache.ts`, `decodedImages.ts`, `decodeImageLayers.ts`) differently. It's split so the cache can be tested without Skia.
* **Rewriting the `editorMode` reducer.** It's long, but every case is short and clear.
* **A handler table for shortcuts.** The switch is already exhaustive, and the mapped type that would make a missing handler an error does not compile (stage 3.4).
* **Splitting autosave out of `projectLifecycle`.** `closeProject` cancels the pending save and clears its error directly, so a split would add a channel between the two halves without making either clearer.
* **Moving `targetImageLayer` and `visibleImageLayer` out of `framing.ts`.** `targetImageLayer` falls back to the framing anchor, so it reads naturally there.
* **Pulling the sticker sheet's handlers or the dock footer out of `EditorScreen`.** Once stage 3 lands, the screen is mostly JSX, and these read fine inline.
* **Rewriting `pixelateFilter`'s comment as a list.** It is the 16-line comment on `RedactionLayerView`, and it explains why the filter is built from a blur and two displacement passes. A list would drop that reasoning. `LayersLesson` shows the comment.
* **Chasing a line count for `EditorCanvas`.** Stage 4 says what remains, and why it stays.
* Changing the project file format, the document schema, undo behavior, the native modules, or what any tool, gesture, or Skia drawing does.
