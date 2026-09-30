# Readability plan

An audit of the codebase on 2026-09-30, once the core features were built and checked on a real device. It looks for code that's hard to read or change, and plans refactors that make it clearer without changing what the app does.

The folders are in good shape. Earlier refactors gave each screen and tool its own folder, split the editor into `canvas/`, `crop/`, `panels/`, and a folder per tool, and pinned the import boundaries in `biome.json`. Moving files around again would buy little. The debt that's left sits inside two components, `EditorScreen`'s `ScreenContent` and `EditorCanvas`. Each coordinates the editor's modes by hand, one piece of state and one precedence check at a time, and neither has a test.

## How to work through it

* One step at a time, in order. After each step, verify it, stop, and hand over a Conventional Commits message (`refactor: …`). The user reviews and commits each step; don't run `git commit`.
* Every step is behavior-preserving. If a step turns up a bug, note it here and fix it in its own step, not inside the refactor.
* Steps marked **Propose first** need the proposed types or state shape shown to the user and approved before building.
* Pure logic moves into plain `.ts` modules with Node tests beside them (the conventions are in AGENTS.md: explicit `.ts` imports, nothing React-based at runtime). A move that makes untested logic testable is worth more than one that only shortens a file.
* Run `npm run check`, `npm run typecheck`, and `npm test` after every step. Steps in phases 2 and 3 also need the app driven through the scenarios they list, on web (headless Chrome over CDP for anything timing-sensitive) and on the iOS simulator for gestures.
* Judge each finding on its merits. If one conflicts with a rule in `biome.json` or AGENTS.md and is still right, change the rule too.
* Tick steps off here as they land, with a line on what was built.

## Findings

What each phase fixes, with where it comes from.

1. **The editor's modes live in nine separate pieces of state.** `ScreenContent` (`EditorScreen.tsx`, about 1,140 lines) holds `tool`, `textEdit`, `cropping`, `eyedropper`, `textPicker`, `toolOptionsOpen`, `layersOpen`, `addOpen`, and `shortcutsOpen`. Which of them can be set together is enforced one handler at a time: most `start…` handlers close the layers panel themselves (Crop doesn't), `fromRail` finishes the tool and the text, three render-time `setState` calls put down a tool whose target went away (lines 309, 352, 369), and `handleShortcut` repeats the precedence as an 80-line chain. None of it is tested.
2. **`EditorCanvas` works out the same precedence five times.** It takes the mode as four nullable props (`tool`, `textEdit`, `adjusting`, `detection`) and derives `holdingStill`, `oneFingerMode`, `modeGesture`, the cursor, and `outlinedLayer`, each checking them in a slightly different order. The props also overlap on purpose: the eyedropper, opened from a text color picker while typing, sets `tool` to `pickColor` with `textEdit` still set. Its input comes first, and the text is still drawn.
3. **Tool logic is inline in the screen.** Draw's and Redact's "show the selected layer's style, and restyle it on change" logic, Find's mapping, counting, and grouping of detections, text editing's start, finish, and restyle, and saving a sticker all sit in `ScreenContent`. Their folders (`draw/`, `redact/`, `text/`) hold only the panels and settings.
4. **Wiring is repeated.** The custom-color and eyedropper handlers are written out four times, once each for `BrushOptions`, `RedactOptions` (twice), and `TextColorPicker`. `ToolsPanel` gets the same ten props in the rail and in the dock. The screen subscribes to about 40 store values one by one.
5. **The canvas's gesture results are decided inline.** `handleStroke` sorts a finished stroke into a color pick, a tap away, paint, a box, a shape, a tap that selects, or nothing. `handleDetectionTap` hit-tests the proposals. Both are plain geometry on the JS thread, and neither is tested. The double-tap check is written twice, once for zoom and once for selecting a word.
6. **The canvas's zoom state is spread through its body.** `zoomed`, `latestViewport`, `setZoom`, `commitViewport`, `zoomTo`, `tapOnNothing`, `zoomView`, `visibleArea`, and the wheel's flush are one concern, sitting between the text-press and hover logic.
7. **The store slice repeats its patterns.** The "replace this layer" update is written out about a dozen times. `setLayerHidden` and `setLayerLocked` are near copies, as are `setLayerGroupHidden` and `setLayerGroupLocked`. "Clear the selection if it's among these" appears seven times. `effectsEqual` compares redaction effects in the store, not in `model/`, where the type lives.

## Phase 1: Warm-up on tested code

### 1.1 Store slice helpers (done)

Built as described. `replaceLayer` makes ten single-layer updates one line each. `nudgeLayer` keeps its own `map`, because it writes one replaced list two ways (a new undo step, or joining the last nudge's), and splitting that list across the two branches would hide that they write the same thing. `setLayerFlag` and `setLayerGroupFlag` back the four hidden and locked actions. `selectionWithout(ids)` replaces the seven selection checks. `effectsEqual` is exported from `model/document.ts` and has its own test. Group lock, hide, and delete had no store tests; they have them now, and those tests pass against the old slice too. No bugs found.

`src/store/editorSlice.ts` has 1,126 lines of tests, so this step has the least risk and shows the working rhythm.

* Add a `replaceLayer(action, target, next, nextSelectedLayerId?)` helper for the "replace one layer" update, and use it everywhere that pattern appears.
* Fold the hidden and locked setters into one flag setter for layers and one for groups, keeping the public actions and their devtools action names.
* Add a helper that keeps the selection unless it's among some ids, for the seven places that repeat it.
* Move `effectsEqual` into `model/document.ts` beside `RedactionEffect`, with a test.

### 1.2 Small cleanups

* `ExportScreen.tsx`: Save, Share, and Copy each repeat the same busy flag, `try`, `catch`, and `finally`. Give them one helper that takes the action and its error title.
* Replace nested-ternary label choices with records: Draw's brush names (`DrawPanel.tsx`), Redact's effect names (`RedactPanel.tsx`), and Find's group name in `finishFinding`.

## Phase 2: The editor screen

The goal is a `ScreenContent` that reads as composition: hooks that each own one concern, and JSX that places what they return. A reasonable target is under 400 lines.

### 2.1 An editor mode reducer — **Propose first**

Put findings 1 and 4's precedence in one pure module, `features/editor/editorMode.ts`, with tests. Roughly: a base mode (`idle`, `tool` with its options' open state, `text` with its edit, `crop`), overlays that sit on a mode (the eyedropper, a text color picker), and sheets (layers, Add, shortcuts). Its transitions carry the rules that are scattered today: starting anything closes the layers sheet, starting a tool from the rail finishes the one in use, and a tool whose target is gone reads as no tool. It's derived from the document, not corrected by a `setState` during render.

* Move `handleShortcut`'s precedence into a pure function of the mode, the selection, and the shortcut, returning what to do, and test it against today's behavior shortcut by shortcut.
* Before building, write down today's precedence from `handleShortcut`, `fromRail`, and the render-time corrections, and show the proposed state type beside it.
* Verify: each tool opens and closes from the dock, the rail (at 1024pt and wider), and its key; Escape at each level; the eyedropper from Draw, Redact, Find, and a text color picker while typing; the layers sheet closing when a tool starts.

### 2.2 A hook per tool, in its folder

Move finding 3's logic into hooks beside the panels they feed, which the screen composes. Folders still don't import each other.

* `draw/useDrawTool.ts`: `drawSettings`, `changeDrawSettings`, the shape being restyled, and choosing the brush when drawing starts.
* `redact/useRedactTool.ts`: the same for redactions.
* `redact/useFindTool.ts`: the mapped detections, the overlay, visible and selected counts, `findRegions`, and `finishFinding`. Turning chosen regions into boxes and naming their group is pure; test it.
* `text/useTextEditing.ts`: the text edit state, starting new text or editing the selection, finishing, restyling, and selecting.
* A small `useStickerSave` for saving the selected photo as a sticker.

Each hook selects only the store actions it uses, which retires most of the screen's one-by-one subscriptions (finding 4).

### 2.3 One color target

Replace the four copies of the custom-color and eyedropper wiring with a helper that takes what a color applies to and returns `customColor`, `onPickCustom`, and `onEyedropper` for a tray.

### 2.4 Split the render

* The header's actions, the tool trays over the canvas, and the dock's content (a `switch` on the panel kind, replacing the eight-way ternary) each become a component in `EditorScreen.tsx` or beside it.
* Build `ToolsPanel`'s props once for the rail and the dock.
* Verify at 390pt, 900pt (the layers sidebar), and 1280pt on web, and on the iOS simulator with the keyboard up while typing.

## Phase 3: The editor canvas

`EditorCanvas.tsx` already has its gestures in hooks (`useLayerTransformGesture`, `usePaintGesture`, `useTextEditGesture`, `useViewGesture`, `useWheelZoom`). What's left is decisions and state that sit in the component body. The AGENTS.md lessons on worklets, `Gesture.Simultaneous`, and `scheduleOnUI` all apply here, so the pure steps come first.

### 3.1 Pure gesture results

* `canvas/strokeIntent.ts`: a function from the tool, the stroke's points, the view scale, and the document size to what the stroke means (a color pick, a tap away, paint, a box, a shape, a tap that selects, or nothing). `handleStroke` then only dispatches. Test each outcome, including thin boxes and a line.
* A `detectionAt(regions, point, padding)` hit test beside `hitTest.ts`, preferring the smallest region, with tests.
* One double-tap tracker used by the empty-tap zoom and the text word selection.

### 3.2 A zoom hook

Move finding 6's state and callbacks into `canvas/useCanvasZoom.ts`, returning the viewport, `zoom`, what the imperative handle needs (`zoomView`, `visibleArea`), `commitViewport`, and `tapOnNothing`. Verify: pinch, trackpad pinch and wheel on web, ⌘+ ⌘− ⌘0, double tap on nothing, Fit, a crop resetting the zoom, and a tray opening while zoomed.

### 3.3 Text presses with their gesture

Move the text press and hover handling, with its latest-handler refs, next to `useTextEditGesture` (or into it), so the canvas passes the edit and gets a gesture back. Verify: placing the caret, dragging a selection, double tap for a word, a tap off the text finishing, and a second finger zooming mid-press on iOS.

### 3.4 One input mode — **Propose first**

Pass the canvas one union for what input does (select and transform, paint with a tool, pick a color, edit text, find, adjust), derived once from phase 2's mode, and keep the props that only affect drawing (the text being edited, the live adjustment, the detection overlay) separate. The gesture, the cursor, holding still, the one-finger pan, and the outline then each read the one value. The overlap in finding 2 (picking a color while text stays drawn) must survive. Show the union, and a table of today's five derivations beside it, before building. Verify every mode on web and the iOS simulator, including one-finger pan while zoomed, and pan while finding and adjusting.

## Phase 4: Optional

Worth doing only if phases 1–3 leave time and appetite.

* **`projectLifecycle.ts`**: the autosave queue, its timer, and its error listeners could be their own small module inside `projects/`, separate from the open-project registry. It's coherent as it stands and well tested, so it's a readability gain only.
* **Web key listeners**: six places add a `keydown` listener to `window` behind a `Platform.OS` guard, but their needs differ (capture, `keyup`, `blur`), so a shared hook would need options for each. Revisit only if a seventh appears.

## Left as is

Looked at and not worth changing:

* **`EditorScene.tsx`** is long (about 1,000 lines) but already made of small named parts, one per piece of chrome.
* **`useLayerTransformGesture.ts`** is dense because worklets need their state in shared values declared up front. It's one cohesive gesture, and splitting it would scatter that state across files.
* **`EditorSceneParts.tsx` and `DocumentRenderScene.tsx`** each switch over layer types. They differ on purpose: the editor loads images as they decode, while export needs them all decoded before its single frame.
* **`stickers.ts`** is a catalog of data.
* **The draw and redact option trays** already share `ToolOptions`, `RingChoice`, and `ColorOptions`. What they have left in common is layout.
