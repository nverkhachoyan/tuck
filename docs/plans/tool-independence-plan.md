# Tools that stand alone

A plan written October 27, 2026, to take the links between Redact, Find, and Cut out out of the editor, so that no tool opens another or reads another's state. It's the groundwork for the second half of this file, a `defineTool` setup in which each tool is one definition in its own folder, and for moving the editor into a package after that.

Unlike the refactors before it, the first half changes what the user sees: Find gets a button of its own, and neither Find nor Cut out opens Redact any more.

**Status, October 27, 2026:** the first half is built (`608877c` to `7199900`), and so are phases A to D of the second (`6fb597b` to `ce20692`, see [What was built](#what-was-built)). Phase E, the packages, waits until it's asked for. What phase C left central is listed under [Still central](#still-central); [tool-definitions-plan.md](tool-definitions-plan.md) then moved the mode, the canvas's input, and starting a tool into the tools.

## What happens today

Paths are under `src/screens/editor/`, read at `71b4c95`.

Find is one of Redact's tools. It has no dock button (`dock: false` in `shell/toolList.ts`); it's reached from Redact's panel and bar (`onFind`), from a selected photo's layer actions, or with F. Its ✕, Cancel, and Done all go back into Redact. Cut out's Redact goes into Redact too. That takes these links, spread over five files:

| Link | Where |
| --- | --- |
| Find redacts in Redact's style | `findStyle` (`EditorDock.tsx`) reads and writes `redact.chosen`, dressing it as the box tool so `RedactOptions` hides the brush. `finishFinding` (`useEditorTools.ts`) reads `redact.chosen` too. Find's dock glyph is Redact's `EffectGlyph`. |
| Find's Done and Cancel open Redact | `backToRedacting` and `finishFinding` (`useEditorTools.ts`), and `onBackToRedact` in `ToolViewContext`. |
| Redact opens Find | `onFind` in `ToolViewContext`, `RedactPanel`, and `RedactBar`. |
| Cut out's Redact opens Redact | `redactCut` (`useEditorTools.ts`): cancels Cut out's session, adds the masked redaction, sets `redact.chosen`'s tool to the box, and starts Redact. |
| The rail marks Redact while Find is open | `markedWhile: ["redact", "find"]` (`shell/toolList.ts`). |

Redact's settings (`RedactSettings`: `tool`, `effect`, `color`, `strength`, `brushSize`, `eraserSize`) are one preference, `redactSettings`, owned by `useRedactTool` and returned as `chosen` and `setChosen` for the others to use. Half of them are the redaction's look (`effect`, `color`, `strength`, which `shell/redactStyle.tsx` already names `RedactLookSettings`), and half are Redact's own sub-tool and brush sizes.

## Decisions

* **Find is a tool of its own.** It gets a button in the dock and the rail, after Redact, shown only with an image (`needsImage`), and keeps F and its place in a photo's layer actions. `markedWhile` goes, since no tool marks another's button. Redact's panel and bar lose their Find button.
* **The dock fits nine buttons in two rows.** `ToolGrid` caps its columns at 4, so a ninth button would start a third row. It allows 5 when there are more than 8 (5 and 4). Without an image there are six (Find, Adjust, and Cut out hide), so that dock is unchanged. Checked at 360 points wide, the narrowest Android phone, before step 3 lands. If the labels don't fit there, see [Open questions](#open-questions).
* **The redaction look is the editor's, not Redact's.** `RedactLook` (`effect`, `color`, `strength`) and what turns it into a `RedactionEffect` (`BLUR_STRENGTHS`, `PIXEL_SIZES`, `redactionEffect`) move from `tools/redact/redactSettings.ts` to a new pure `shell/redactLook.ts`, which every tool may import. Today only `useEditorTools` turns the look into an effect for Find and Cut out, but once their Done moves into their own folders (phase C) they can't import Redact's. `EffectGlyph` moves from `RedactPanel.tsx` to `shell/redactStyle.tsx`. `RedactSettings` becomes `RedactLook & { tool, brushSize, eraserSize }`.
* **The preference keeps its key and format, owned in one place.** `usePreference` doesn't sync between two callers, so `useEditorTools` owns `redactSettings` and hands Redact all of it, and Find and Cut out its look. The saved format doesn't change, so a user's chosen style carries over. When `EditorContext` arrives (phase B below), the look moves there.
* **Find's Done redacts and closes Find.** It adds the chosen regions in the look, as one undo step (`addRedactionBoxes`, which selects nothing), shows the notice with Undo (`onRedacted`), and ends Find. Its ✕, including the tray's when nothing was found, is Cancel, which ends Find like any tool's.
* **Find shows only the look.** Its tray shows `RedactLookOptions`, the Effect, Strength, and Color rows of `RedactOptions` taken out into `shell/redactStyle.tsx`, which `RedactOptions` then uses too. Its bar already builds from `redactLookItems`. `findStyle`'s box-tool trick goes.
* **Cut out's Redact redacts and closes Cut out.** It cancels Cut out's session (so the photo is whole again, as today), adds the masked redaction in the look (`addMaskedRedaction`, which selects it), and ends Cut out. The user lands on the new redaction, selected, whose layer actions offer Redact to restyle it. The undo steps are the same as today: the cut is gone, and the redaction is one step.
* **Find and Cut out stay two tools.** They share detection (`detection/`), but Find picks many regions and Cut out refines one mask. Merging them is a design question for after `defineTool`, where it would mean combining two definitions.

## Steps

Each step is its own commit and passes `npm run check`, `npm run typecheck`, and `npm test`.

### 1. Share the redaction look

No behavior changes.

* Add `shell/redactLook.ts` with `RedactLook`, `parseRedactLook` (the look's part of `parseRedactSettings`), `BLUR_STRENGTHS`, `PIXEL_SIZES`, `redactionEffect(look, documentSize)`, and the look's `withEffect` and `sameEffect`. Move their tests from `tools/redact/__tests__/` to `shell/__tests__/`. `redactSettings.ts` imports them, and `RedactLookSettings` in `shell/redactStyle.tsx` becomes `RedactLook`.
* Move `EffectGlyph` to `shell/redactStyle.tsx`. Find's dock panel renders it from the look.
* Take the look's rows (Effect, then Color or Strength) out of `RedactOptions` into `RedactLookOptions` in `shell/redactStyle.tsx`. Find's tray becomes `FindOptions`, which shows only those rows, so `findStyle`'s box-tool trick goes. With the box chosen, `RedactOptions` showed only those rows anyway.
* `useEditorTools` owns the `redactSettings` preference. `useRedactTool(documentSize, saved, setSaved)` takes it in place of calling `usePreference`, and stops returning `chosen` and `setChosen`. `useEditorTools` returns `redactLook` and `changeRedactLook` (which merges a change into the saved settings) for the views, and `findStyle`, `finishFinding`, and `redactCut` read those.

`refactor: share the redaction look between Redact, Find, and Cut out`

### 2. Find's Done and Cancel close Find

* `useEditorTools`: `finishFinding` redacts, closes the tool, and calls `onRedacted`. `done` and `cancel` lose their Find branches, and `backToRedacting` goes.
* `ToolViewContext`: `onBackToRedact` becomes `onCancel`, the open tool's Cancel (`cancel` from `useEditorTools`). `FindTray`'s and `FindInspector`'s `onBack` becomes `onCancel` too.
`feat: close Find when it's done, instead of returning to Redact`

### 3. Give Find its own button

* `shell/toolList.ts`: drop `dock: false` and `markedWhile` from the entries and the type, give Find `needsImage: true`, and update `MarkedTool`'s comment. `ToolsPanel` marks `entry.key === tool`.
* `shell/ToolButton.tsx`: `ToolGrid` allows 5 columns above 8 buttons.
* `RedactPanel`, `RedactBar`, and `ToolViewContext`: drop `onFind`.
* Update the comments that call Find Redact's: `ToolsPanel`'s, `railChosenTool`'s (`editorChrome.ts`), and `TOOL_KEYS`' (`shortcuts.ts`).

`feat: make Find a tool of its own`

### 4. Cut out's Redact closes Cut out

* `useEditorTools`: `redactCut` cancels the session, adds the masked redaction in the look, and dispatches `endTool`. It no longer touches Redact's settings or starts Redact.
* `startRedacting` is now only Redact's starter.

`feat: close Cut out when it redacts the cut`

### 5. Docs

* `PRODUCT.md`'s tools line: Find as a tool of its own (faces and text, which it redacts), and Cut out's Redact.
* `docs/architecture.md`: the redaction look in `shell/redactLook.ts`, and Find and Cut out each adding redactions.

`docs: describe Find as its own tool and the shared redaction look`

## Checks

In the web editor at 390, 1024, and 1440 points wide, and at 360 for the dock:

* With a photo, the dock shows nine buttons in two rows, and without one, six. The rail shows Find under Redact.
* Find from its button, from F, and from a photo's layer actions. Choose regions, then Done: they're redacted in the look, the notice offers Undo, and the editor is idle. Cancel and the tray's ✕ after finding nothing both end Find, with no redactions.
* Change the look in Find's tray and bar, including the eyedropper, then open Redact: it has the same look, and its own sub-tool and brush size.
* Cut out a subject, then Redact: the photo is whole, the redaction covers the subject in the look and is selected, and one Undo removes it.
* Reload: the look and Redact's sub-tool are still what they were.

Then the same on the iOS simulator, iPhone and iPad.

## Open questions

* **If nine buttons don't fit at 360 points.** Shorter labels for Find ("Find" is already short) won't help if the icons crowd. The fallbacks are a smaller `ToolButton` in a five-column grid, or Find only in the rail and the layer actions on phones, which is how it's reached today, minus Redact's button.

---

## After this: `defineTool`

Once no tool reaches into another, each tool can become one definition in its own folder, and the files that switch over every tool can iterate over the definitions instead. These phases are planned here only in outline. Each gets its own plan file when it's next.

### What it fixes

A tool's behavior is spread over the editor's root today, in files that each have a case for every tool: `editorMode.ts` (its mode), `useEditorTools.ts` (its hook, starter, Done, and Cancel), `EditorDock.tsx` (`TOOL_VIEWS`), `editorChrome.ts` (its title and Done label), `canvasInputFor.ts` (what the canvas does), `shell/toolList.ts` (its button), and `shortcuts.ts` (its key). The views get everything through `ToolViewContext`, a bag of 14 fields, and adapters like `cutOutProps` and `findResults` that only rename a hook's `change` to a panel's `onChange`.

### What was built

* **Phase A** (`6fb597b`, `f560a12`, and in `fb8dd36`): every tool's panels take its controller. `cutOutProps`, `findResults`, `drawColor`, `redactColor`, and `findStyle` are gone.
* **Phase B** (`fb8dd36`): `editorContext.ts` gives every tool view the custom color, the eyedropper (`useColorTarget`), the redaction look, the tray, the dock's inset, and Cancel. What's left of the old bag is `PanelContext`: the tools, and what text and a selected layer show. Adjust's controller carries its image's adjustments.
* **Phase C** (`c1c4452`): `defineTool.ts`, and a definition in each tool's folder (`drawTool.ts`, `redactTool.ts`, `findTool.ts`, `cutOutTool.ts`, `adjustTool.ts`) holding its views, Done label, Done, whether Done deselects, and size step. `toolDefinitions.ts` lists them. `EditorDock.tsx` became `PanelViews.tsx`, which shows a tool's views from its definition and keeps only text's and a selected layer's. Find's Done (`redact`) and Cut out's Redact moved into their own hooks. `modeChrome` takes the tool's Done label. Cut out's `cutOutTool` setting became `cutToolInUse`.
* **Phase D** (`ce20692`): `EditorHeader.tsx` (with the project's title), `LayerSelectionBar.tsx` (with `useArrangeSelected`), and `useEditorChrome.ts` (the panel, title, Cancel, and Done) came out of `EditorScreen.tsx`, which went from 798 lines to about 660.

### Still central

Phase C moved what each tool shows and how it finishes, and [tool-definitions-plan.md](tool-definitions-plan.md) the mode, what the canvas does, and starting a tool. These still have a case per tool, each for a reason:

* **Calling the tool hooks** (`useEditorTools.ts`). Each hook takes different inputs, so they're called by name. A shared host object would let the list call them.
* **The buttons and keys** (`shell/toolList.ts`, `shortcuts.ts`). They list Text, Sticker, Crop, and Add photo too, which aren't tools in the mode, so they stay one list of buttons.
* **Text and Crop** aren't tools in the mode: text is edited in its own mode, and Crop covers the editor with its own canvas.
* **Merging Find and Cut out**, if wanted, is now a question of two definitions becoming one, with one type for what they select.

### Phase E: packages

npm workspaces, in this order, each its own plan:

1. `packages/document`, from `src/model/`. `docs/interactive` depends on it in place of its `@model` alias.
2. `packages/render`, from `src/render/`, once `Checkerboard` and `LayerContent` take their checker color and cell size as props rather than reading `ui/theme`.
3. `modules/image-analysis`, given a `package.json`, in place of its `tsconfig.json` path.
4. The editor, exporting `<Editor>`, `defineTool`, and the built-in tools. The app hands it what it imports from `projects/` and `photos/` today (opening and saving the project, picking and adding photos, saving stickers), and `ui/` comes with it or becomes a package of its own.

Each package's `package.json` and `exports` then enforce what `biome.json`'s `noRestrictedImports` overrides do today, so those rules shrink as packages land. Check early that `npm test` (Node's type stripping, which refuses files under `node_modules`) runs a workspace package's tests through its symlink.
