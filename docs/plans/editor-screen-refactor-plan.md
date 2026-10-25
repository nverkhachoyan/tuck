# Editor screen

A refactoring plan for `src/screens/editor/EditorScreen.tsx`, written October 2026. It's the most complex part of the app: the file that composes the editor. Nothing here changes what the editor does. The goal is a screen whose decisions are each made in one place and whose parts can be read on their own.

## Why this file

The largest files were compared by size, how often they change, and how much they decide:

* `EditorScreen.tsx` is the largest file in `src/` (929 lines). It's also one of the most edited (19 commits in the last 50), and it's where every tool, both layouts, and the project session meet. Its `ScreenContent` component runs from line 156 to 882 in one function.
* `projectLifecycle.ts` (736 lines) has as many branches, but it's plain TypeScript with its storage passed in, and its tests cover it. That complexity comes from the domain: opening, claiming, copying, and cleaning up projects.
* `ContextBar.tsx`, `CropTool.tsx`, and `EditorCanvas.tsx` are large, but each does one job: the bar's layout, the crop screen, and the canvas's gestures.

`EditorScreen` is complex because it composes many parts, not because one problem in it is hard, so it's the one where a refactor pays off most.

## What happens today

Read from `EditorScreen.tsx`, `EditorDock.tsx`, `useToolLifecycle.ts`, `useCanvasInput.ts`, and `useEditorLayout.ts` at `21b6c6c`.

* **One component holds the whole editor.** `ScreenContent` calls about 25 hooks, and many of them take the results of earlier ones: `useEditorMode`, `useToolSession`, `useTextEditing`, `useSavedStickers`, `useStickerSave`, `useEditorLayout`, `useAdjustTool`, `usePreference`, `useDrawTool`, `useRedactTool`, `useFindTool`, `useCutOutTool`, `useCanvasInput`, `useAutosave`, `useEditNotice`, `useAddImage`, `useToolLifecycle`, `useEditorShortcuts`, and its own refs and effects. Then about 270 lines of JSX switch between the phone and wide layouts.
* **The order of the hooks matters, and only comments say so.** `useToolSession` must run before the tool hooks and `useToolLifecycle`, or Cut out's remembered cut lands in the session's starting document, where Cancel can't take it back (comments at `EditorScreen.tsx:193`–`200` and in `useToolLifecycle.ts`). If someone moved one line, every check would still pass.
* **Cancel and Done are chosen twice.** On a phone, `dockFooter` picks the handlers and the title from `tool`, `editingText`, and `selectedLayer` (lines 559–580). On a wide window, the context bar's `onCancel` and `onDone` come from a separate set of nested ternaries on `panelKind` (lines 640–657). The two agree today. AGENTS.md says `ModeActions` keeps the layouts from disagreeing, but `ModeActions` only draws the buttons: it doesn't choose what they do. Titles are listed twice too: `TOOL_TITLES` in the screen, and as string literals in each branch of `ContextBarContent`.
* **`inBar` lists seven of the eight panels.** Lines 382–390 list every `DockPanel` except `"idle"`, so a panel added later would silently leave the bar.
* **The color picker's wiring is written three times.** `colorTarget` (a custom color, which becomes the saved custom color, and the eyedropper) is defined in both `ToolTrays` and `ContextBarContent`, and `TextBar`'s eyedropper writes it out a third time.
* **The tools are built in the screen but used elsewhere.** The draw, redact, find, cut, adjust, and text controllers are created in `ScreenContent` and passed to `useCanvasInput`, `useToolLifecycle`, `ToolTrays`, `ContextBarContent`, and `DockContent`. `stepBrush` (lines 461–472) checks each tool's type to find its size setting. Cut out's `onRedact` (lines 277–289) reaches into Redact's settings and the mode from inside the screen.
* **The layers list is rendered in five places.** It appears as the sheet, as the sidebar, and three more times inside `Inspector` (on its own, inside `FindInspector`, and inside `AdjustInspector`), each placement with its own condition.
* **Stickers spread through the screen.** `stickerActions`, the `afterStickers` ref (which waits for the popover to close on iPad before opening the picker), `stickersDismissed`, and the `stickerAnchor` ref are all in `ScreenContent`. Each one is used by only one part of the screen.
* **One-off effects sit inline.** These are Find's review zoom (lines 255–271), the web `inert` toggle (lines 393–402), and the project title (lines 318–326).

## Decisions

* **Behavior stays exactly as it is.** Each step is a move or a merge, and the app does the same things before and after. If a step turns up a real disagreement between the layouts, it goes into its own `fix:` commit, not into a refactor commit.
* **The editor's mode doesn't change.** `editorMode.ts` and its reducer are already plain TypeScript and tested, and this plan builds on them. The store stays as it is too.
* **Cancel and Done are chosen in one pure function.** `modeChrome` in a new `editorChrome.ts` (plain TypeScript, like `editorMode.ts`) takes the tool, whether text is being typed, whether text is styled, the selected layer's name, Find's chosen count, and `wide`. It returns the panel, the title, which Cancel and Done apply (`"tool"`, `"text"`, `"deselect"`, or none), Done's label, and whether the panel sits in the bar. The screen turns those into handlers once, and both `DockFooter` and `ContextBar` get the same object. `ContextBarContent` takes its title from that object instead of a literal. `layerKindName` stays in `LayerRow.tsx`, and the screen passes in its result, so the test runner never loads React.
* **The order of the hooks is enforced in code.** A new `useEditorTools` hook (at the editor root, since it composes several tools) calls `useToolSession`, then the tool hooks, then `useToolLifecycle`. It returns the `EditorTools` bundle with the lifecycle's starters, Done, and Cancel. The ordering comment moves there, and `ScreenContent` gets one call that can't be put in the wrong order.
* **Each tool's settings know their own size step.** `stepBrush` becomes `stepToolSize(tool, step)` on the bundle `useEditorTools` returns, so the screen no longer branches on each tool.
* **New files only where a part has its own job.** The project's rule is to grow an existing file before adding a single-use one. These parts each have their own job and inputs, so they get files: the rail and the inspector go into `EditorDock.tsx`, which already holds the editor's layout parts. Stickers' actions go to `tools/stickers/`. Find's review zoom goes to `tools/find/useFindTool.ts`. It takes a `{ zoomToArea, fit }` object rather than importing `canvas/`, because only `tools/crop/` may import the canvas.
* **The aim, not a rule:** `ScreenContent` under 350 lines, with each derived value computed once.

## Steps

Each step passes `npm run check` and `npm run typecheck`, plus `npm test` where it adds or touches a pure module. It ends with a commit in Conventional Commits form. After each step, check the editor on web at 390 and 1440 points wide (and 1440 × 800, where the inspector is closed until a panel opens it), on the iOS simulator, and on the iPad Pro 13-inch simulator. In each layout, open every tool, then Cancel and Done it; type text; select a sticker; open the layers; and use Find through review. Steps 3 and 6 move hook calls, so on web they also need a check at 60 frames a second in headless Chrome over CDP (see AGENTS.md on the hidden Browser pane).

### 1. One `inBar`, one `colorTarget`

* `EditorScreen.tsx`: `inBar = wide && panelKind !== "idle"`. Check first that `ContextBarContent` returns an element for every panel except `"idle"` whenever the screen can produce it: `"text"` always comes with `styledText`, and `"layer"` always comes with `layerActions`.
* `EditorDock.tsx`: a single `colorTarget(apply, onCustomColor, dispatchMode)` that `ToolTrays` and `ContextBarContent` both use. `TextBar`'s `onEyedropper` uses it too, with the key bound.

Commit: `refactor: share the editor's color target and bar check`

### 2. Cancel, Done, and the title chosen once

* `editorChrome.ts`: `modeChrome(...)` as described in Decisions, with a doc comment that follows the house style (one sentence on what it is, then a short list).
* `__tests__/editorChrome.test.ts`: each tool; Find with and without chosen regions (Done's label); text being typed (Cancel and Done for text); text selected but not typed (no Cancel, Done deselects, title "Text"); another layer selected (its name, no Cancel); nothing selected (`"idle"`, not in the bar). Also check that `inBar` is false on a phone for every case.
* `EditorScreen.tsx`: `dockFooter` and the bar's `onCancel`, `onDone`, and `doneLabel` all come from the result. `TOOL_TITLES` moves into `editorChrome.ts`.
* `ContextBarContent`: takes a `chrome` prop (title and the action props for `ModeActions`) rather than separate `onCancel`, `onDone`, and `doneLabel` props and literal titles.
* AGENTS.md's context-bar entry: say that `modeChrome` chooses the actions and `ModeActions` draws them.

Commit: `refactor: choose the editor's cancel and done in one place`

### 3. `useEditorTools`

* `useEditorTools.ts` at the editor root takes `document`, `mode`, `dispatchMode`, `targetImage`, `documentSize`, `pickPhoto`, `openStickers`, `visibleArea`, and `onRedacted`. In order, it calls `useToolSession`, `useTextEditing`, `useAdjustTool`, `useDrawTool`, `useRedactTool`, `useFindTool`, `useCutOutTool` (with its `onRedact`, moved from the screen), and `useToolLifecycle`. It returns `{ tools, startTool, done, cancel, finishTool, closeCrop, finishCrop, stepToolSize, adjustedLayer, cutLayer }`.
* `pickPhoto` comes from `useAddImage`, which needs `keysTaken`, which comes from the mode. That's already available before the tools, so `useAddImage` moves above `useEditorTools`. Check that `useAddImage`'s `onImage` reads `canvasRef` only when it's called, not while rendering.
* `useToolLifecycle.ts` stays as the lifecycle's file. Its doc comment points to `useEditorTools` as its only caller.
* `useEditorShortcuts` gets `stepBrush: tools.stepToolSize`.

Watch: Cut out started from a remembered mask, then canceled, must go back to the photo without the mask, in one undo step. That's the case the hook order protects.

Commit: `refactor: build the editor's tools in one hook`

### 4. The inspector and the rail as components

* `EditorDock.tsx`: `EditorInspector({ panel, find, adjust, layerList })` renders `LayersPanel` once, as the child of `FindInspector`, `AdjustInspector`, or nothing. `EditorRail({ chosen, addBusy, hasImage, startTool, stickerAnchor })` takes the card, its styles (`railArea`, `rail`, `railContent`), and the `fromRail` wrapper.
* The rail's chosen tool (`"text"`, `"crop"`, `"sticker"`, or the tool) becomes a small function next to `modeChrome`, with a test case per mode.

Commit: `refactor: give the editor's rail and inspector their own components`

### 5. Stickers out of the screen

* `tools/stickers/useStickerActions.ts` takes `{ addSticker, pickSticker, closeStickers, waitForDismiss }`. It returns the sheet's and the popover's action props, plus `onDismiss`, and owns the `afterStickers` ref. It imports nothing from the editor outside `tools/stickers/`, which keeps to `biome.json`'s override for that folder.
* The screen renders `StickerPopover` or `StickerSheet` with its result spread in.

Watch: on the iPad simulator, Save new from the sticker popover must open the photo picker after the popover has closed (fix `3267402`).

Commit: `refactor: move the sticker actions to the stickers tool`

### 6. The one-off effects

* `tools/find/useFindTool.ts`: `useReviewZoom(review, view)`, where `view` is `{ zoomToArea, fit }`. The screen passes an object built from `canvasRef`. The zoom stays keyed on the reviewed region, as now, so other renders don't undo a pan.
* The `inert` effect and the project title stay in the screen, but move under one comment for the screen's web-only and display-only details. Each is a few lines, and moving them to their own files would only scatter them.

Watch: stepping through Find's review zooms to each region and back to the fit when review stops, including when Find closes partway through.

Commit: `refactor: move find's review zoom into the find tool`

### 7. Docs

* `docs/architecture.md`: in the editor root's line, add `useEditorTools` and `editorChrome`.
* AGENTS.md's editor-root description under Project Structure: the same.
* Count `ScreenContent`'s lines, and note here, under the steps, what it came to.

Commit: `docs: describe the editor's tools hook and chrome`

## Not in this plan

* Splitting `EditorDock.tsx`'s per-tool switches into a registry of tools. `DockContent`, `ContextBarContent`, and `ToolTrays` each switch on the panel, and a table of tools could replace all three. It's a bigger change than this plan's other steps, and it would touch every tool's panel, so it's worth doing only once steps 1–4 have shown what the tools really have in common.
* `projectLifecycle.ts`. Its complexity comes from the domain, and its tests already cover it.
