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

### 1.2 Small cleanups (done)

Built as described. `runAction` in `ExportScreen.tsx` takes the busy state, the failure alert's title, and what to do with the rendered image. Checked on web: Copy shows Copied with clipboard access and "Copy failed" without it, and the buttons come back either way. `BRUSH_NAMES`, `EFFECT_NAMES`, and `FOUND_GROUP_NAMES` are records keyed by their types, so a new brush, effect, or detector without a name fails to type-check.

**Bug found, not fixed:** in a document with no layers (a new blank canvas), the layers panel's empty text ("Text, drawings, photos, and stickers you add appear here.") wraps to two lines at 390pt and in the 1024pt inspector, and the Background row is drawn over its second line. `styles.empty` in `panels/LayersPanel.tsx` fixes both `height` and `lineHeight` to `ROW_HEIGHT`, so the second line spills out of its box.

* `ExportScreen.tsx`: Save, Share, and Copy each repeat the same busy flag, `try`, `catch`, and `finally`. Give them one helper that takes the action and its error title.
* Replace nested-ternary label choices with records: Draw's brush names (`DrawPanel.tsx`), Redact's effect names (`RedactPanel.tsx`), and Find's group name in `finishFinding`.

## Phase 2: The editor screen

The goal is a `ScreenContent` that reads as composition: hooks that each own one concern, and JSX that places what they return. A reasonable target is under 400 lines.

### 2.1 An editor mode reducer — **Propose first** (done)

Built as approved. `editorMode.ts` holds the mode union, its reducer, `settle`, `shortcutCommand`, and `takesKeys`, with 26 tests: the transitions, each correction, and each key rule. `useEditorMode.ts` holds it for the screen and settles it as it renders. In `ScreenContent`, nine `useState`s and three render-time corrections became one hook, and `handleShortcut` became a lookup plus a `switch` that runs the result. `TextColorKey` moved to `editorMode.ts`. Checked on web with headless Chrome: each tool from the rail, its key, and the dock; Escape at each level (eyedropper, tool, Add, the shortcuts list, crop, typing); the eyedropper from Draw, Redact, Find, and a text color picker while typing; the layers sheet closing for a tool and staying open under crop at 390pt; Find and Adjust put down by a redo, with Draw then opening with its tray closed; and a picker closed by undo selecting other text, which redo doesn't reopen. Bug 1 still reproduces, as intended until 2.1b.

Put findings 1 and 4's precedence in one pure module, `features/editor/editorMode.ts`, with tests. Roughly: a base mode (`idle`, `tool` with its options' open state, `text` with its edit, `crop`), overlays that sit on a mode (the eyedropper, a text color picker), and sheets (layers, Add, shortcuts). Its transitions carry the rules that are scattered today: starting anything closes the layers sheet, starting a tool from the rail finishes the one in use, and a tool whose target is gone reads as no tool. It's derived from the document, not corrected by a `setState` during render.

* Move `handleShortcut`'s precedence into a pure function of the mode, the selection, and the shortcut, returning what to do, and test it against today's behavior shortcut by shortcut.
* Before building, write down today's precedence from `handleShortcut`, `fromRail`, and the render-time corrections, and show the proposed state type beside it.
* Verify: each tool opens and closes from the dock, the rail (at 1024pt and wider), and its key; Escape at each level; the eyedropper from Draw, Redact, Find, and a text color picker while typing; the layers sheet closing when a tool starts.

#### Proposal (approved)

Approved on 2026-09-30, with the tray's open state inside the tool mode. That fixes the leftover open tray in bug 2 by construction, and it's the one behavior change 2.1 makes. The corrections settle and are kept.

**Today.** Ten pieces of state: `tool`, `adjustedId`, `toolOptionsOpen`, `textEdit`, `cropping`, `eyedropper`, `textPicker`, `layersOpen`, `addOpen`, and `shortcutsOpen`. The rules they follow:

* Keys (`handleShortcut`): the first rule that matches wins, and a key no rule uses passes to the browser.
  1. With the shortcuts list open, ? or Escape closes it, and every other key is held.
  2. ? opens the list.
  3. Undo and redo always run, even over a tool, the Add sheet, or the eyedropper.
  4. With the Add sheet open, Escape or A closes it, and other keys pass.
  5. Zoom always runs.
  6. While the eyedropper waits, Escape stops it, and other keys pass.
  7. With a tool open, Escape is Done (Find redacts what's chosen), and other keys pass.
  8. A tool's key starts it. Each start checks its own target: Find and Cut out need a photo, Adjust an image.
  9. L shows or hides the layers.
  10. With nothing selected, the rest pass. With a selection, E edits text (text only), and Delete, Escape (deselect), duplicate, reorder, and nudge act on it.

  Typing and cropping switch these keys off, since each handles its own. A text color picker has no keys: Escape deselects its text, which closes it.
* Starting Text, text editing, Draw, Redact, Find, Adjust, or Add closes the layers sheet. Crop, Photo, and Cut out leave it open: the crop screen covers the sheet, and it's still open afterwards. A tool starts with its tray closed, because finishing a tool always closes the tray.
* The rail (`fromRail`, at 1024pt and wider) finishes an open tool and commits text being typed, then starts the new one. Finishing Find this way doesn't redact what it found, and finishing a tool also stops the eyedropper.
* Three render-time corrections: Adjust puts itself down when its image is gone or hidden, and Find does when no photo is left. Neither closes the tray or stops the eyedropper. A text color picker closes when a tool is open, or when the text being styled is another layer.
* Some can be on together: a tray and the eyedropper (Style reopens the tray while the eyedropper waits), a text color picker and the eyedropper (the dock opens a picker for another color), and the shortcuts list over the Add sheet. The layers and Add sheets can't: the Add sheet's scrim covers the Layers button, and L is held while it's open.

**Proposed.** `features/editor/editorMode.ts`, pure, with tests:

```ts
export type EditorMode<TextEdit> =
	| { type: "idle" }
	| { type: "tool"; tool: "draw" | "redact" | "find"; optionsOpen: boolean }
	| { type: "tool"; tool: "adjust"; layerId: string }
	| { type: "text"; edit: TextEdit }
	| { type: "crop" };

export type EditorModeState<TextEdit> = {
	mode: EditorMode<TextEdit>;
	textPicker: { layerId: string; key: TextColorKey } | null;
	eyedropper: { apply: (color: string) => void } | null;
	sheet: "layers" | "add" | null;
	shortcutsOpen: boolean;
};
```

* The text edit is a type parameter because the editor root doesn't import from `text/` or `canvas/`. `TextColorKey` moves to the root.
* A reducer carries the transitions: starting a tool, Adjust, text, crop, or the Add sheet; finishing and canceling; the tray, the text picker, the eyedropper, and the sheets. Side effects stay with the screen: committing text, Find's redaction, `cancelSession`, and `detection.reset`.
* `shortcutCommand(state, selection, shortcut)` returns what to do (`undo`, `closeAdd`, `doneWithTool`, `start` with a `ToolKey`, `deselect`, …), `"held"`, or null for a key that passes, and the screen runs the command. Its tests go through the key rules above, one case each.
* `settle(state, targets)` replaces the three corrections. It puts Adjust or Find down when its target is gone, and closes a picker whose text isn't the one being styled. `useEditorMode` applies it once per render and keeps the result (React's "adjusting state when a prop changes" pattern), so something that's gone stays gone. Deriving it without keeping the result would change behavior: open text A's color picker, select text B, then select A again, and A's picker would reopen, where today it stays closed.

**Bugs found, not fixed.** Bug 1 and the redo in bug 2 are kept as they are in 2.1, and fixed in step 2.1b after it.

1. Starting a tool from the rail while the eyedropper waits for a text color leaves the eyedropper waiting. The hint stays up over the new tool, and the first tap picks a color for the text instead of drawing. `fromRail` stops the eyedropper only when a tool was open. Checked on web at 1280pt: text color picker, then the eyedropper, then Draw in the rail.
2. Redo works inside a tool's session and replays steps from before the session began: `beginSession` doesn't clear `future`, and only undo is held to the session's start. If the redone step deletes Find's photo, Find puts itself down through the render-time correction, which leaves `toolOptionsOpen` set, so the next tool opens with its tray already open. Checked on web: paste a photo, delete it, undo, then Find, Style, Redo, and Draw opens with its tray showing.

### 2.1b Fix the bugs found in 2.1 (done)

Built as described. In `editorMode.ts`, starting a tool, Adjust, text, crop, or the Add sheet stops the eyedropper. The store's session keeps `redoStop`, the redo step that was next when the session began, and `selectCanRedo` and `redo` stop there. The redo stack itself is untouched, so a session that ends without changes leaves the redo steps from before it. Tests cover both, and both scenarios were checked on web: Draw from the rail now draws on the first tap, and inside Find, Redo is disabled and its key does nothing.

* Starting anything stops the eyedropper, from the rail too (bug 1).
* Redo is held to a tool session's start, as undo is (bug 2).
* Verify both scenarios from 2.1's notes on web.

### 2.2 A hook per tool, in its folder (done)

Built as described: `draw/useDrawTool.ts`, `redact/useRedactTool.ts`, `redact/useFindTool.ts`, `text/useTextEditing.ts`, and `useStickerSave.ts` at the root. Find's pure part, `chosenBoxes` in `redact/findResults.ts`, has tests. `TextEditState` moved to `editorMode.ts`, because `text/` can't import `canvas/`. The hooks took 8 of the screen's store subscriptions. The other 30 or so are layer and canvas actions, which the render split in 2.4 may take further. `ScreenContent` went from about 1,140 lines to about 870. Checked on web: typing and restyling text, both while typing and while selected; a shape restyled in Draw, and Draw starting with the shape tool on a selected shape; a box restyled to blur in Redact; the pasted group photo kept as a sticker; and Find finding 28 faces, redacted into a "Face results" group.

Move finding 3's logic into hooks beside the panels they feed, which the screen composes. Folders still don't import each other.

* `draw/useDrawTool.ts`: `drawSettings`, `changeDrawSettings`, the shape being restyled, and choosing the brush when drawing starts.
* `redact/useRedactTool.ts`: the same for redactions.
* `redact/useFindTool.ts`: the mapped detections, the overlay, visible and selected counts, `findRegions`, and `finishFinding`. Turning chosen regions into boxes and naming their group is pure; test it.
* `text/useTextEditing.ts`: the text edit state, starting new text or editing the selection, finishing, restyling, and selecting.
* A small `useStickerSave` for saving the selected photo as a sticker.

Each hook selects only the store actions it uses, which retires most of the screen's one-by-one subscriptions (finding 4).

### 2.3 One color target (done)

Built as described, except that `colorTarget(apply)` returns only `onPickCustom` and `onEyedropper`. The trays take `customColor` on its own, because `TextColorPicker` shows no custom swatch, and spreading the color in would pass it a prop it doesn't take. `TextColorPicker` now gives its picked color to `onPickCustom` alone, as the trays do, and lost its `onChange`: the screen still applies the color, then keeps it as the custom color. Checked on web: a color from each of the four pickers (Draw, Redact, Find, text) became both that tool's color and the custom color, and the eyedropper still works from each.

Replace the four copies of the custom-color and eyedropper wiring with a helper that takes what a color applies to and returns `customColor`, `onPickCustom`, and `onEyedropper` for a tray.

### 2.4 Split the render (done)

Built as described. `HeaderActions` selects undo and redo itself. `ToolTrays` owns `colorTarget`. `DockContent` is a `switch` on the panel kind, whose last kind is now `idle`: the tools in the dock, or the layers in the inspector. All three live in `EditorScreen.tsx`, since only the screen may compose subfolders. `toolButtons(wrap)` builds `ToolsPanel`'s props for the dock, and for the rail through `fromRail`. The selected layer's actions are one object. `ScreenContent` is now about 705 lines, short of the 400-line target. What's left is the canvas's tool wiring (`canvasTool` and its stroke, box, shape, and pick handlers), the shortcut runner, and the layer list and its arrange handlers; each could become a hook if the target matters. Checked on web at 390, 900, and 1280pt: the header's actions, the tools in the dock or rail, the layers as a sheet, sidebar, or inspector, a photo's actions, Draw's panel and tray, and typing. Checked on the iOS simulator with the software keyboard up while typing: the dock rode the keyboard with the style tabs and footer. A stroke, Cancel, typing, Done, and Undo all worked there.

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
