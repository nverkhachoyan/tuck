# Crop's UI

A refactoring plan for `screens/editor/tools/crop/CropTool.tsx`, written October 26, 2026. Crop lays out the phone and the wide window in one 744-line component. Some of its options are listed once per layout, and it has its own copies of controls the shell already has. The tool-options refactor (`bdb2805`) gave Draw, Redact, and Cut out one table for each list of choices, and left Crop for later. This plan does the same for Crop, fixes three small bugs the copies hide, and splits the file along the lines the other tools use. Nothing here changes what Crop shows or does, apart from the three fixes.

## Why this area

The candidates were compared by size, by edits in October, by hooks per file, and by whether a refactor had just been through them:

* `EditorScreen.tsx`, `EditorCanvas.tsx`, and `editorSlice.ts` are large, but the editor-screen, tool-views, and canvas-input refactors went through them this week (`b98bd4b` to `b87e7f6`). They each hold one documented job now.
* `ContextBar.tsx` (763 lines) is mostly the bar's measured fade. Moving its geometry out is already item 3 in `follow-ups-plan.md`.
* `projectLifecycle.ts` (736 lines) is one factory doing three jobs: keeping track of open projects, the autosave timer, and the library's operations on closed projects. Taking the autosave out (`createAutosave(save)`, tested with fake timers) is a fair next refactor. It ranks second because it already has 45 tests, it's had three refactors, and a mistake there loses edits.
* `ExportScreen.tsx` (522 lines, 11 `useState`s) does its sheet's sizing math inline. That's untidy, but the screen stands alone.
* `FindPanel.tsx` was considered and set aside in the follow-ups plan.
* `CropTool.tsx` (744 lines) is the largest tool file. It's the one tool whose options are listed once per layout, and the copies have already let bugs through: `21b6c6c` closed every chip's popover once a choice was made, but missed Crop's background chip, which isn't a `BarChip`. The follow-ups plan has two notes waiting on it: the dial's props written twice, and Crop on iPad still unchecked on a device.

## What happens today

From reading `CropTool.tsx`, `useCropController.ts`, `shell/ContextBar.tsx`, `shell/ColorPicker.tsx`, `shell/Dial.tsx`, `ui/BackgroundPicker.tsx`, and `EditorScreen.tsx` at `95250ef`.

`EditorScreen` mounts `CropTool` over the whole editor while the mode is `crop`, with `wide`, `onCancel` (`closeCrop`), and `onDone` (`finishCrop`). Crop has its own canvas (`CropCanvas`), its own state (`useCropController`, where nothing reaches the document until Done), and its own header. `takesKeys` gives it the keyboard. The component returns one of two trees:

| | Wide window | Phone |
| --- | --- | --- |
| Header | `ScreenHeader` holding `ContextBar` with `CropBar`, and Reset | `ScreenHeader` with Reset only |
| Modes | `OptionSegments` from `TABS` | `ToolButton`s from `TABS` in the `Dock` |
| Crop | `AspectMenu`, a `BarChip` with `ASPECT_GROUPS`' three rows of `AspectChoice` | A scrolling row of `AspectChoice` in `ASPECTS` order |
| Rotate | Three `BarButton`s | Three `ActionButton`s, under the dial |
| Straighten | `DialStrip` under the photo, its own `Dial` | A `Dial` above the actions |
| Fill | `BackgroundChip`, a swatch opening `BackgroundPicker` in a `Popover` | "Background" and `BackgroundPicker` in a row |
| ✕ and ✓ | The context bar's | `DockFooter` |

What's written twice:

* **Rotate's actions.** Rotate 90°, Flip, and the turn-layers switch are written out as `BarButton`s in `CropBar` and as `ActionButton`s in the phone tree: their icons, their labels, and the rule `onlyText ? "Turn text" : "Turn layers"`, shown only when `hasOtherLayers`. The two differ on purpose in one way: the bar shows a switch as a checkbox glyph, and the phone highlights its own icon.
* **The straighten dial.** Its eleven props (`max`, `scale`, three labels, `readout`, `valueText`, and the handlers) are written out in the phone tree and in `DialStrip`. `DialStrip` types its props as `ComponentProps<typeof Dial>[...]` one by one.
* **The background's names.** `BackgroundChip` works out "White background", "Black background", or "Transparent background" from the value, and `ui/BackgroundPicker`'s `BACKGROUNDS` lists the same three.
* **A swatch chip.** `BackgroundChip` is `ColorChip`'s pressable again: a word, a 20-point swatch, its own open state and `Popover`, and the same hover and pressed styles. They drifted apart:
  * `BackgroundChip` doesn't close once a background is chosen. `ColorChip` closes on a swatch (`onSwatch`), and `BarChip` hands its children `close`.
  * `ColorChip` doesn't set `aria-expanded`, so on web a screen reader isn't told its palette is open. `BackgroundChip` and `BarChip` do. AGENTS.md notes React Native Web ignores `accessibilityState.expanded`.

Other things in the file:

* **The phone's turn-layers switch** (`ActionButton` with `selected`) sets `accessibilityState.checked` but not `aria-checked`, so on web at phone width a screen reader isn't told whether it's on. `BarButton` sets both.
* **Pure rules inside components.** `hasOtherLayers` and `onlyText` are worked out in `CropTool` from the document and the anchor. `ASPECTS` and `TURNED` live in `useCropController.ts`, which imports React and Reanimated, so they can't be tested. `ASPECT_GROUPS` lists the ids again in `CropTool.tsx`, and nothing checks that it holds each one once.
* **Keys.** Crop's web `keydown` effect has no dependency list, so it removes and adds its listener on every render. Behavior is right, since each listener reads the newest `controller.done`. `isInteractiveElement` is Crop's own, and `useEditorShortcuts` has a narrower `isEditable` for its own purpose.

What differs on purpose, and stays:

* The phone shows each tab's controls above the dock, in a fixed height (`CONTROLS_WITH_DIAL`, `CONTROLS_WITHOUT_DIAL`) so the canvas holds still. The wide window keeps a `DIAL_STRIP` under the photo for the same reason.
* The phone's ratios are one scrolling row. The bar's are a menu of three rows, with the free shapes, then portrait, then landscape.
* The bar's switch is a checkbox glyph, and the phone's is a highlighted icon.
* The phone labels the fill "Background" beside the picker. The bar's chip says it beside its swatch.

## Decisions

* **Crop stays its own overlay.** Moving it into `TOOL_VIEWS` and `modeChrome` was considered and rejected. Those entries draw options around the editor's canvas, and Crop replaces the canvas, the header, and what Done means: it commits a framing in one undo step. Hosting the crop controller and `CropCanvas` in `EditorScreen` would undo the editor-screen plan's split, for one tool. `editorChrome.ts`'s `cropping` already marks Crop in the rail, which is all the shared chrome needs.
* **Crop's rules go in a plain module, `tools/crop/cropOptions.ts`**, tested under Node like the other tools' settings modules. It holds:
  * `ASPECTS`, `AspectId`, and `turnedAspect(id)` (today's `TURNED`), moved from `useCropController.ts`.
  * `ASPECT_ROWS`, today's `ASPECT_GROUPS`, so a test can check it holds every id once.
  * `aspectRatio(id, size)`: the ratio for a choice, with "original" read from the turned photo's size. `pickAspect` uses it.
  * `turnLayersLabel(layers, anchorLayer)`: `null` when no other visible layer can choose, otherwise "Turn text" or "Turn layers". It replaces `hasOtherLayers` and `onlyText`. Redactions always turn with the photo, so they don't count, as today.
* **One list per set of choices, beside the views.** Names and icons are presentation, so they stay in a `.tsx` file, as in the tool-options plan:
  * `CROP_TABS`, today's `TABS`.
  * `rotateActions(controller, turnLabel)` returns Rotate's actions as `{ key, icon, label, checked?, onPress }`, the switch last, only when `turnLabel` isn't `null`. The bar maps each to a `BarButton`, with the checkbox glyph where `checked` is set. The phone maps each to an `ActionButton`. `Children.toArray` flattens an array of keyed elements, so each action is still its own child of `BarGroup`. The comment about fragments there stays true.
  * `StraightenDial`, the `Dial` with Crop's scale, labels, and readouts, taking the value and the three handlers. The phone and `DialStrip` both draw it.
* **A swatch chip is one component in shell.** `SwatchChip` in `shell/ColorPicker.tsx` holds the pressable, the word, the swatch, the open state, and the `Popover`, and hands its children `close` as `BarChip` does. It sets `aria-expanded`. Its swatch draws `null` as a slash (no color) or as the checkerboard (transparent), chosen by a prop. `ColorChip` becomes `SwatchChip` around `ColorOptions`. Crop's `BackgroundChip` becomes `SwatchChip` around `BackgroundPicker`, closing once a background is chosen.
* **`ui/BackgroundPicker.tsx` exports `backgroundLabel(value)`**, read from `BACKGROUNDS`. The chip's label comes from it.
* **The file splits the way the other tools do.** `CropTool.tsx` keeps the overlay: the controller, the keys, Android's back button, the stage, and the choice between the two layouts. `CropPanel.tsx` holds the tables and the views that read them: the phone's tab controls, `CropBar`, `AspectMenu`, `AspectChoice`, `StraightenDial`, and `ActionButton`. That matches `DrawPanel.tsx`, which holds Draw's dock panel and bar. `CropCanvas`, `useCropController`, `useCropGesture`, and the geometry don't change apart from imports.
* **The keys become `useCropKeys(done)`** in `CropTool.tsx`, with a dependency list, and keep their behavior: Escape applies from anywhere, Enter applies from outside a control, and a key a popover has handled is left alone. Folding them into `useEditorShortcuts` was considered and rejected. Crop takes the keyboard from the editor on purpose (`takesKeys`), and its two keys don't need the editor's table.
* **`ActionButton` stays Crop's own.** `ToolButton` is close, but it has no switch role, and it's sized as a tool in the dock. Rotate's actions sit above the dock in a smaller style.
* **Behavior doesn't change, except for three fixes.** Each fix is its own `fix:` commit, before the refactor commits, as in the earlier plans.
* **The aim, not a rule.** `CropTool.tsx` should end around 250 lines, and `CropPanel.tsx` around 400. Line count isn't the reason for any of this. The reason is that a new ratio, a Rotate action, or a change to the dial is one edit, and the two layouts can't disagree about it.

## Steps

Each step passes `npm run check` and `npm run typecheck`, and `npm test` from step 2 on. Each ends with a commit in Conventional Commits form. After each step, check Crop on web at 390 and 1440 points wide, on the iOS simulator, and on the iPad Pro 13-inch simulator:

* Open Crop with a photo, and with a blank canvas (no photo to level: no dial, and the phone's controls are shorter).
* Each tab, from the dock on a phone and from the bar's segments on a wide window. The canvas doesn't move as the tab changes.
* Every ratio, from the phone's row and from the bar's menu, which closes once one is chosen. Rotate 90° with 4:5 chosen: 5:4 is chosen after.
* Rotate 90°, Flip, and the switch, which reads "Turn text" with only text over the photo, "Turn layers" with other layers, and isn't there with none (or with only redactions).
* Drag the straighten dial, and step it by keyboard on web.
* Each background, from the phone's picker and from the bar's chip.
* Reset, Cancel, and Done. Done is one undo step. On web, Enter on the canvas applies, Enter on a button presses it, and Escape applies unless a popover is open, which it closes. On Android (when the emulator is up), Back applies.

### 1. Three fixes

* `CropTool.tsx`: `BackgroundChip` closes its popover once a background is chosen.

  Check: on web at 1440, open Fill, choose White. The popover closes, and the canvas fill is white.

  Commit: `fix: close Crop's background popover once a fill is chosen`

* `CropTool.tsx`: `ActionButton` sets `aria-checked` when it's a switch.

  Check: on web at 390, with a text layer, the switch's element has `aria-checked="false"`, then `"true"` once pressed.

  Commit: `fix: tell screen readers on web whether Crop turns the layers`

* `shell/ColorPicker.tsx`: `ColorChip` sets `aria-expanded`.

  Check: on web at 1440, in Draw, the color chip has `aria-expanded="false"`, then `"true"` while its palette is open.

  Commit: `fix: tell screen readers on web when a color chip is open`

### 2. Crop's rules in `cropOptions.ts`

* `cropOptions.ts`: `ASPECTS`, `AspectId`, `turnedAspect`, `ASPECT_ROWS`, `aspectRatio`, and `turnLayersLabel`. It imports only `model/` types and functions by relative `.ts` path, so Node can load it.
* `useCropController.ts`: imports them. `pickAspect` uses `aspectRatio`, and `rotate` uses `turnedAspect`.
* `CropTool.tsx`: `ASPECT_GROUPS` goes. `hasOtherLayers` and `onlyText` become `turnLayersLabel(document.layers, anchor.layer)`.
* `__tests__/cropOptions.test.ts`:
  * `ASPECT_ROWS` holds every id in `ASPECTS` once.
  * `turnedAspect` pairs each fixed ratio with its inverse, both ways, and gives nothing for Free, Original, and Square.
  * `aspectRatio` gives `null` for Free, the turned photo's ratio for Original (a quarter turn swaps it), and each fixed ratio's value.
  * `turnLayersLabel`: `null` with no other layers, with only hidden ones, and with only redactions. "Turn text" with only text, and "Turn layers" with any other kind. With no anchor (a blank canvas), every layer counts.

Commit: `refactor: keep Crop's ratios and turn rule in cropOptions`

### 3. Crop's views in `CropPanel.tsx`

A move, with no change to what any view draws:

* `CropPanel.tsx`: `CROP_TABS`, `CropBar`, `AspectMenu`, `AspectChoice`, `ActionButton`, and the phone's tab controls as `CropControls` (the `Animated.View` keyed by tab, and its three branches), with their styles.
* `CropTool.tsx`: keeps the overlay, `DialStrip`, and the layout constants, and adds `useCropKeys(done)` with a dependency list. `isInteractiveElement` stays beside it.

Watch: the phone's controls keep their fixed height and fade in over 160ms as the tab changes.

Commit: `refactor: move Crop's options into CropPanel`

### 4. Rotate's actions and the dial, once

* `CropPanel.tsx`: `rotateActions(controller, turnLabel)` and `StraightenDial`. `CropBar` and `CropControls` map over `rotateActions`, each drawing a switch its own way. `CropControls` and `DialStrip` draw `StraightenDial`. `DEGREES` moves with it.
* `DialStrip` takes the value and the three handlers as one `dial` prop, typed from `StraightenDial`'s props.

Watch: the bar's switch shows the checkbox glyph and the phone's shows the highlighted icon, as before. Actions keep their order: Rotate 90°, Flip, then the switch.

Commit: `refactor: list Crop's rotate actions and dial once`

### 5. One swatch chip

* `shell/ColorPicker.tsx`: `SwatchChip` (`label`, `title`, `value`, `empty: "none" | "transparent"`, `restoreFocus`, `children(close)`). `ColorChip` draws it around `ColorOptions`, passing `close` as `onSwatch` and before the eyedropper, as today.
* `ui/BackgroundPicker.tsx`: `backgroundLabel(value)`.
* `CropPanel.tsx`: `BackgroundChip` becomes `SwatchChip` with `title="Background"` and `empty="transparent"`, around `BackgroundPicker`, whose `onPick` closes it. Its own styles go.

Watch: every color chip (Draw, Redact, Find, Text) looks and behaves as before, at both pointer sizes (`compactControls`). Its popover stays open while the custom color is dragged. The background chip's checkerboard swatch is unchanged. The chip's label follows the background chosen.

Commit: `refactor: share one swatch chip between colors and Crop's fill`

### 6. Docs

* `docs/architecture.md`: `tools/crop/` holds `CropTool` (the overlay), `CropPanel` (its options on both layouts), and `cropOptions.ts`.
* `AGENTS.md`: name `cropOptions.ts` with the other tools' settings modules, and `CROP_TABS` with their tables.
* `docs/plans/follow-ups-plan.md`: drop the Crop dial note from "Small ones", and keep the iPad check, now pointing at this work.
* Remove this plan, as the earlier ones were.

Commit: `docs: describe Crop's files and remove its plan`

### Result

* `CropTool.tsx` is the overlay: about 250 lines.
* `CropPanel.tsx` holds Crop's options for both layouts, each list written once: about 400 lines.
* `cropOptions.ts` holds the ratios and the turn rule, with tests.
* Shell has one swatch chip, and on web every chip tells a screen reader when it's open.

## Not in this plan

* **Crop in `TOOL_VIEWS`.** See Decisions. Revisit it only if another full-screen tool appears.
* **The autosave in `projectLifecycle.ts`.** The runner-up above. It's its own plan, with fake-timer tests before any move.
* **`ExportScreen`'s sizing.** A `useSheetFit` hook could hold the preview strip's math. It's small, and only the export sheet uses it.
* **The context bar's fade geometry.** Already in `follow-ups-plan.md`, item 3.
* **Selection state on web.** `AspectChoice` is a `Chip`, which marks the chosen ratio only with `accessibilityState.selected`. That's `follow-ups-plan.md`'s item 2, and it covers every `Chip`. It isn't fixed here.
