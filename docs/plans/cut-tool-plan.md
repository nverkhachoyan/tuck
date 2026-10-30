# Cut and Remove BG

Written October 29, 2026, from [the brainstorm](../brainstorming/cut-out-flow.md). This plan turns Cut out into **Cut**, a tool that selects first and acts afterward, and adds **Remove BG**, a quick action in the tray that removes a photo's background in one tap.

**Status:** steps 1, 2, and 3 built on October 29, 2026.

What building it found:
* Step 1: the settings stay under the `cutOut` preference key. `usePreference` reads only its own key, so a new key would have dropped everyone's brush sizes. `parseCutSettings` reads Cut out's `pick`, `keep`, `erase`, `keepSize`, and `eraseSize`.
* Step 1: names for the *layer* keep "cut out" (`isCutOut`, `renderCutOut`, "a cut-out"), since an image with a cut is still a cut-out. Only the tool's names changed. `useCutOut`, `cutMask.tsx`, `pickGrowth.ts`, and `isCutOutAvailable` kept theirs too.
* Step 1: the Strokes lesson pointed at `cutout.ts`, which an earlier refactor had already moved into `layers/image/mask.ts`. Fixed.
* Step 2: `ImageLayerView`'s `showRemoved` became `selectionColor`. `EditorScene` passes `colors.selection`, so the layer view still reads no palette (the docs app renders it).
* Step 2: the empty selection's file is made once per session key, when Cut first opens on an uncut image, and `start` waits for it while taps are ignored (one task runs at a time). `AsyncImage` hid the whole photo until a new mask decoded. A cut shown as a selection now draws the photo meanwhile, since it hides nothing.
* Step 2: the brush "Add" and the tap mode "Adds" sit side by side; the tap mode shows only while Tap is in use. The tap-again cycle stayed, beside Smaller and Larger.
* Step 2: Smaller and Larger first rendered as one component, which `FadeGroup` counted as one item, stacking them (the `Children.toArray` learning). They're now sibling elements.
* Step 2: `cutShowsAt` went, since taps take their mode from the UI.
* Step 2: autosave saved the live document, so leaving the app mid-Cut saved the selection as the photo's cut, and an empty selection as an invisible photo. Cut's spec now says it `previews`: its session keeps that, and the app's view of the session (`useSession`, `getSession`, through `selectAppDocument`) is the document from before Cut opened until Done. `Editor` draws the store's own document rather than the one the app hands it, which is the app's view. `finishTool` commits the session at once rather than when the tool unmounts, so Back, which saves before leaving, sees Done's changes. Checked on web: an empty selection reloads as the earlier cut, and a selection after Done reloads as the new one.
* Step 3: saved stickers' storage moved out of `tools/stickers/` into `editor/savedStickers/`, which both Stickers and Cut import, with the cut-out render (`cutOutSticker`). The Stickers hook runs for the editor's whole life and reads the list once, so `saveSticker` tells it through `onStickerSaved`: a sticker saved in Cut shows under Yours without reopening the project.
* Step 3: `addCutCopy` takes the copy's id from the store action, so the copy is selected though it isn't on top (`selectionAfter` selects only a new top layer). The copy starts unlocked and shown, since the document's own photo is locked.
* Step 3: the rules are plain functions in `mask.ts`: `selectsNothing` (moved out of `useCutTool`) and `removalOf`. Remove flattens the cut from before the session too, since it may have strokes. A flattened cut has its mask's pixels, or the image's up to 2048 on a side when strokes refine it.
* Step 3: the actions that close Cut (New layer, Update cut, Keep only, Remove, Redact) show the edit notice, whose toast also announces and offers Undo. "Cut updated" and Keep only show it only when the session changed something, since its Undo would otherwise take back an earlier edit. Save sticker changes nothing to undo, so it announces through Cut's `news` (`useCutOut`'s `announce`) and its menu item turns into Saved until the selection changes.
* Step 3: the Apply popover (a `BarChip`) stays open while Save sticker runs, and the other actions are disabled while one runs. On the phone, the tray shows either the brush's options or the Apply menu (`tray` in the controller).
* Step 3: the phone dock (Subjects, Tap, Add, Subtract, Size, Invert, Apply) no longer fits at 375 points and scrolls, with Apply last; with Tap's mode button it's eight. This answers the open question in part: a later step should move something, such as the tap mode, into the tray.
* Step 3: checked on the web export (wide and 375 points): New layer, Update cut, Keep only, Remove on an uncut photo and on a cut layer, Redact, Save sticker, and one undo step each. Not yet tried on the iOS simulator.

## 1. What changes for the user

- **Cut** (renamed from Cut out) changes nothing when it opens. You build a selection, and the photo shows what's selected under a wash in `colors.selection`.
  - **Subject**: selects every subject.
  - **Tap**: selects the object under the finger. A **Smaller · Larger** stepper then grows or shrinks it through SAM's masks.
  - **Add** and **Subtract** brushes (today's Keep and Erase).
  - A **+ / −** toggle sets whether taps add or subtract. On web, Shift adds and Alt subtracts, as in Photoshop.
  - **Invert**.
- **✓ runs the default action:**
  - **New layer** for a fresh selection: the selection is copied to a new layer above the photo, and the photo stays whole.
  - **Update cut** when Cut opened on a layer that was already cut: the selection starts as that layer's cut and becomes its new cut.
- **An Apply menu holds the other actions:** **Keep only** (today's Cut out result), **Remove** (hide the selection), **Redact**, and **Save sticker**.
- **Remove BG** is a button in the tray and in an image's layer actions. One tap finds the subject and cuts the background away as one undo step. A notice says "Background removed" and offers Undo and **Refine**, which opens Cut on that layer.

## 2. Design

### The selection lives in the session, on the layer

While Cut is open, the working selection is the image layer's own `mask` and `maskStrokes`, as the cut is today. That keeps what already works:

- Undo inside the tool works per stroke and per tap.
- The canvas's live brush stroke (`liveMask`) and the mask math need no new plumbing.
- Cancel (`cancelSession`) puts the layer back exactly as it was.

What changes is how it's drawn and what ✓ does:

- **Drawing.** `ImageLayerView`'s `showRemoved` becomes a `look` of `"selection"` for the image being cut: the whole photo at full strength, a `colors.selection` wash over what's selected, and an outline at the selection's edge. The outline is a morphology dilate of the mask with the mask taken away, which works on Skia web (runtime shaders don't). The red and green tints go.
- **An empty selection.** On an image with no cut, `start` sets the mask to the one black pixel that `invertedMask(undefined)` makes, which means nothing is selected. A Tap on it then adds, as `pick` already decides (`cutShowsAt` reads black there).
- **Actions.** Each action does what Redact already does in `useCutOutTool`: read the selection from the layer, `cancelSession()`, apply its own edit as one undo step, then close. A cancelled session leaves no trace, so each action is exactly one undo step.

The risk to keep in mind: a project autosaved while Cut is open saves the selection as the layer's cut, as it does today with Cut out. This plan doesn't make that worse. Note it in follow-ups if it shows up.

### Actions as edits

| Action | Edit | Where |
| --- | --- | --- |
| New layer | Copy the image layer with the selection as its cut, placed exactly above the photo with no offset, and select it | new `addCutCopy` in `layers/image/imageEdits.ts`, store action `addCutCopy` |
| Update cut, Keep only | `setMask` with the selection (Keep only on a layer that was cut replaces its cut) | existing |
| Remove | The layer's cut from before the session, minus the selection (on an uncut photo, the inverted selection) | `combineMasks(…, "remove")` on the flattened selection, then `setMask` |
| Redact | `addMaskedRedaction` | existing (`useCutRedaction`) |
| Save sticker | `renderCutOut` on the in-session layer, then save the sticker. The document isn't changed, and the tool stays open. | reuse `useStickerSave`'s `cutOutSticker` path (move it into a shared helper if a tool import would cross folders) |

**Flattening.** Remove needs the selection (mask plus strokes) as one mask image. Draw `CutMask` offscreen at the mask's size and encode it as gray PNG, alongside `invertedMask` in `cutMask.tsx`. `maskStrokes` are in the image's own pixels, so a copied layer keeps them unchanged, and New layer doesn't need to flatten.

### ✓ and the Apply menu

The tool definition already has `doneLabel` and `done`:

- `doneLabel`: "New layer", "Update cut", or "Done" (nothing selected).
- `done`: runs the default action. With nothing selected, it cancels the session, so the empty-selection pixel never lands.

Check that `finishTool`'s `closeTool()` after a `done` that has already called `cancelSession()` commits nothing (`commitSession` returns without a session).

The other actions go in an **Apply** button with a popover: `ui/Popover` on the wide bar, and a tray or sheet on the phone (reuse `ToolOptions`, like the brush tray).

### Remove BG as a quick action

The tray has tools that open a session, and one entry of the editor's own (Add photo, `OwnTool`). Remove BG is neither: it belongs with Cut's detection code but has no session. Give the tool definition a run-once shape:

- `ToolSpec` gains an optional `action: true`, documented as: pressing it runs the tool's `run` on its target and opens no mode.
- `ToolDefinition` gains `run?: (controller, image) => void`. It's required exactly when the spec is an action, and such a tool has no `views` and no canvas input.
- `startTool` in `useEditorTools.ts` calls `run` for an action instead of dispatching `startTool`. The chrome (`editorChrome.ts`), shortcuts, and layer actions list it like any other tool.

`removeBgTool` lives in `tools/cut/` beside `cutTool`, so they share `useCutOut` without a tool importing another tool's folder. Its controller:

- runs `findSubjectMask`, keeps the file, then `setMask` as its own undo step,
- reuses `found` (the session's subject cache), and its alerts for nothing found or the model still downloading,
- shows a busy state on its tray button while it runs, as Add photo does (`addBusy`).

**Refine.** `notify` shows a message with Undo. Extend it to take an optional second action (`{ label, onPress }`), and add `startTool` to `ToolEnv` so Remove BG can open `"cut"` on the layer it just cut. If extending the notice is more than a small change, ship without Refine: the layer stays selected, and Cut is in its layer actions.

### Names, keys, settings

- Ids: `cut` and `removeBg`. Folder: `tools/cut/`. Files: `cutTool.ts`, `cutSpec.ts`, `useCutTool.ts`, `cutSettings.ts`, `CutPanel.tsx`, `removeBgTool.ts`, `removeBgSpec.ts`. `useCutOut.ts`, `cutMask.tsx`, `pickGrowth.ts`, and `useCutRedaction.ts` move unchanged.
- Labels: "Cut" (icon `scissors-cutting`) and "Remove BG" (icon to pick, such as `image-filter-center-focus-weak` or `auto-fix`). Measure "Remove BG" in the dock at the narrowest phone width.
- Keys: Cut keeps **B** unless **X** is free in `TOOL_KEYS`. Pick a free letter for Remove BG and list it in the shortcuts.
- Settings: the preference key stays `cutOut` (see step 1's finding), and `CutSettings.tool` becomes `"tap" | "add" | "subtract"`, plus a `tapMode: "add" | "subtract"`. `parseCutSettings` maps the old `pick` / `keep` / `erase` values, so nobody loses their brush sizes.
- Projects: layers keep `mask` and `maskStrokes`, so saved projects need no migration.

## 3. Steps

Each step is one commit, leaves the app working, and is checked with `pnpm check`, `pnpm typecheck`, and `pnpm test`, plus `pnpm build:web` where noted. Each step is tried on the web export and the iOS simulator.

### Step 1: Rename Cut out to Cut

Behavior stays the same.

- Move `tools/cutout/` to `tools/cut/` and rename the files, ids (`cutOut` → `cut`), spec label, settings key and type (with legacy parsing and a test), and `CUT_TOOLS` titles (Pick → Tap, Keep → Add, Erase → Subtract).
- Update `builtInSpecs.ts`, `builtInTools.ts`, `BUILT_IN_TOOLBAR`, `editorMode` and `editorChrome` tests, `canvasTool.ts` names (`cutBrush` and `pickSubject` can stay), and the copy that says "Cut out" (`PrivacyScreen.tsx`, alerts in `useCutOut.ts`, the store listing if it names the tool).
- Docs: `docs/architecture.md` (tool folder list and settings module names), and `docs/interactive`'s Strokes lesson ("Cutting out works the same way") if its wording or paths change. Run `pnpm build:web` and the docs build.

### Step 2: Select first

- Opening Cut no longer runs `find`. On an uncut image, `start` sets the empty-selection mask instead.
- The selection look replaces `showRemoved` in `ImageLayerView` and `EditorScene`: wash in `colors.selection` plus the morphology outline. Check it on web, where filters are limited, and on a P3 iOS canvas.
- **Subject** becomes a chip that *selects* every subject. It combines with the current selection, so it doesn't replace hand work.
- The **+ / −** tap mode, with Shift and Alt on web. `pick` takes the mode instead of `cutShowsAt`. Keep `cutShowsAt` only if the brainstorm's "infer it" behavior is wanted as a default, otherwise delete it.
- The **Smaller · Larger** stepper after a Tap, driven by `Pick.index`. It's shown only when a pick has more than one mask.
- ✓ still just commits (today's result, which is Keep only), so the step ships on its own. With nothing selected, ✓ cancels.

### Step 3: Actions

- Pure edits with tests: `addCutCopy` (layer placed above its source, selected, mask and strokes copied) and the Remove combination's rules (uncut, cut, empty selection).
- Selection flattening in `cutMask.tsx`.
- `doneLabel` and `done`: New layer or Update cut.
- The Apply menu (bar popover, phone tray) with Keep only, Remove, Redact (moved out of the dock row), and Save sticker.
- Announcements for each action (`news`), and alerts on failure, as today.

### Step 4: Remove BG

- `ToolSpec.action`, `ToolDefinition.run`, and `startTool` calling it, with editorChrome and editorMode tests for an action entry: listed, keyed, busy, never a mode.
- `removeBgTool` in `tools/cut/`, its tray button between Adjust and Cut, and its layer action on image layers that aren't hidden.
- Refine in the edit notice, and `startTool` in `ToolEnv`. Drop both if the notice change grows (see Design).
- Try it on a photo with a subject, a photo with none (alert), and on Android, where the model may still be downloading (alert).

### Step 5: Docs and cleanup

- `docs/architecture.md`: the Cut folder's contents, the action kind of tool, and Remove BG.
- `docs/interactive` lessons that mention the cut or tool kinds.
- AGENTS.md if building this taught something worth a learning.
- Mark the brainstorm's decisions as built, and this plan's status.

## 4. Out of scope

- Content-aware fill for Remove.
- A **Select** tool for picking layers and objects (the name is saved for it).
- Hair and fur matting beyond the soft brushes.

## 5. Open questions to settle while building

- Should Remove BG run on a photo that already has a cut? Proposed: yes, replacing the cut as one undo step.
- Is Save sticker worth keeping in the Apply menu, now that New layer then Stickers covers it? Keep it if it costs little.
- Phone layout: does the dock fit Subject, Tap, Add, Subtract, +/−, Invert, and Apply, or does +/− belong in the tray?
