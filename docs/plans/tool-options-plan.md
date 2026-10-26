# Tool options

A refactoring plan for the options of Draw, Redact, Cut out, and Text, written October 2026. Each tool shows the same options three times: in the phone dock's panel, in the wide header's context bar, and in the phone's tray. The three look different on purpose. But the rules behind them are copied out in each one: which options apply to which sub-tool, which size a sub-tool keeps, and what each choice is called and drawn with. Nothing here changes what the editor shows or does. The goal is one place for each rule, so a new tip, effect, or sub-tool is one edit, and the layouts can't disagree about it.

## Why this area

The candidates were compared by size, by how often they changed in the 50 commits up to `9702faf`, and by how much the copies in them have already cost:

* `EditorScreen.tsx` (716 lines, 18 edits) has had two refactors (`b98bd4b`, `9702faf`). What's left composes the editor's parts. Another pass would mean splitting the two layouts, which the editor-screen plan chose not to do.
* `ContextBar.tsx` (763 lines, 11 edits) is mostly the bar's measured fade. Its geometry (`rowEdges`, `leafEdges`, `fadeCut`, `fadeCutLeft`) is pure and has no tests. That's worth doing, but it's a small move. See "Not in this plan".
* `CropTool.tsx` (744 lines, 3 edits) lays out the phone and the wide window in one component, and writes the straighten dial's props out twice. It's rarely edited, and its geometry is already split out and tested.
* `projectLifecycle.ts`, `EditorCanvas.tsx`, and `useLayerTransformGesture.ts` are large, but each is one documented job, with one or two edits each. The project lifecycle's tests cover it.
* The tool option files are the most edited area after the screen: `DrawPanel.tsx` 8 edits, `RedactPanel.tsx` 6, `shell/redactStyle.tsx` 6, `shell/ToolOptions.tsx` 6, `CutOutPanel.tsx` 5, `TextStylePanel.tsx` 5. They're also where the copies have already cost something:
  * `a9a0744` added the see-through Marker tip in five places in `DrawPanel.tsx` alone: `TOOL_ICONS`, `BRUSH_NAMES`, `PEN_TIPS`, the list in `BrushOptions`, and `isBrush`. `brushSettings.ts` has a sixth list (`BRUSH_TOOLS`), and `penTip` a seventh.
  * `604d2d3` (the highlighter's own color) made the same three changes in `DrawBar` and in `BrushOptions`: the color's value, its `onPick`, and the size dot's color.
  * `701b230` fixed the layouts disagreeing: the dock put Find before Eraser, and the bar put it after. Each lists Redact's sub-tools in its own way.
  * `PenTipChip`'s doc comment still says it opens "Pen, Highlighter, and Neon". The Marker was added to its list but not to its comment.
  * `[` and `]` don't change Cut out's size when a saved Pick has been swapped for Erase (see "What happens today"). The views use the tool in use, but the size step uses the saved one.

So this is the next candidate. It isn't the biggest file, but its copies have already caused a bug and two sets of paired edits.

## What happens today

Read from `DrawPanel.tsx`, `RedactPanel.tsx`, `CutOutPanel.tsx`, `TextStylePanel.tsx`, `shell/redactStyle.tsx`, `shell/ColorPicker.tsx`, `shell/ColorSwatches.tsx`, `shell/ToolOptions.tsx`, the three settings modules, and `EditorDock.tsx` at `9702faf`.

Each tool's three views, all in one file per tool:

| Tool | Dock | Bar | Tray |
| --- | --- | --- | --- |
| Draw | `DrawPanel` | `DrawBar`, `PenTipChip`, `ShapeKindChip` | `BrushOptions` |
| Redact | `RedactPanel` | `RedactBar`, `redactLookItems` (shell) | `RedactOptions`, `EffectChoice` |
| Find | `FindPanel` | `FindBar`, `redactLookItems` | `RedactOptions` on Redact's `chosen` |
| Cut out | `CutOutPanel` | `CutOutBar` | `CutOutOptions` |
| Text | `TextStylePanel` (tabs) | `TextBar`, `FontChip` | `TextColorPicker` |

What's copied:

* **The size slot of the sub-tool in use.** Redact keeps `brushSize` and `eraserSize`. `brush ? settings.brushSize : settings.eraserSize` is in `RedactPanel.tsx` twice, and the matching write is there twice more (`pickSize` in `RedactBar` and `RedactOptions`). `stepRedactSize` and `maskBrush` in `redactSettings.ts` work out the key themselves too. Cut out has the same pattern with `keepSize` and `eraseSize`: three reads and two writes in `CutOutPanel.tsx`, plus `stepCutSize` and `cutBrush`. Draw has `brushSizeIndex` for the read, but its write (`pickSize`) is written out in `DrawBar` and `BrushOptions`.
* **Which options apply.** Each bar and tray works out for itself which options the sub-tool has:
  * Draw shows the tip for a brush, the kind for a shape, the color unless it's the eraser, and the size always.
  * Redact shows the look unless it's the eraser, and the size unless it's the box.
  * Cut out decides "is a brush" four ways: `tool !== "pick"` (dock), `tool === "keep" || tool === "erase"` (bar), `cut.tool !== "pick"` (`EditorDock.tsx`'s tray entry), and `settings.tool === "pick"` (`stepCutSize`). `CutOutOptions` then takes `tool: "keep" | "erase"`, which the caller narrows by hand.
  * One of those disagrees. Where the device can't find subjects, `cutOutTool` swaps a saved Pick for Erase, and `useCutOutTool` hands that out as `cut.tool`. The dock, the bar, and the tray all use `cut.tool`, so they show Erase and its size, and the bar's size chip shows `[ ]` in its tooltip. `stepToolSize` in `useToolLifecycle.ts` calls `stepCutSize(cut.settings, step)`, which sees `settings.tool === "pick"` and does nothing. So the keys don't change a size the bar says they change. This comes from reading the code. Step 1 starts by reproducing it.
* **The lists of choices, and their names and icons.**
  * Draw's brushes: the seven lists above.
  * Redact's sub-tools: three `ToolButton`s in the dock, `REDACT_TOOLS` (titles and icons) in the bar, a literal `["box", "brush", "eraser"]` for the bar's `onSelect`, and a ternary for its `selected`.
  * Redact's effects: `EFFECT_NAMES` in `RedactPanel.tsx`, `EFFECTS` (titles and icons) in `redactStyle.tsx`, and `EFFECTS` (ids, for parsing) in `redactSettings.ts`.
  * Cut out's sub-tools: three `ToolButton`s, and an `options` array built in `CutOutBar`.
  * Cut out's edges: `BRUSH_EDGES` in the bar, and an inline `[true, false]` in the tray with its own names ("Soft edge") and icons.
* **Whole controls drawn twice.** Redact's strength choices (three `RingChoice`s with a `StrengthDot` or a `PixelSquare`) are the same in `RedactOptions` and in the effect chip's popover in `redactLookItems`. The custom swatch's rule (pick the custom color again unless the value is already custom, then open the picker) is in `ColorOptions.toggleCustom` and again in `TextStylePanel`'s `custom(key)`.
* **Dead code.** `RedactLook` in `redactStyle.tsx` has had no callers since `FindBar` switched to `redactLookItems`.

What differs on purpose, and stays:

* **Choosing the sub-tool already in use.** In the dock, that opens the tray, except Cut out's Pick, which has no tray. In the bar it does nothing, since the options are already in view. Draw's dock has one Brush button that brings back the last brush, and the bar has the same in its first segment.
* **How a choice is drawn.** The dock has `ToolButton`s. The bar has `OptionSegments` and `BarChip`s, whose popovers close once a choice is made. The tray has `RingChoice`s under `ToolOption` labels. Redact's tray draws Solid as a tile of the color, and the bar's chip draws it as a fill icon.
* **Labels.** The tray says "Soft edge" because its choices sit side by side. The bar says "Soft" inside a popover labeled "Edge".

## Decisions

* **Share the rules, not the views.** Each view keeps its own components and its own props. `tool-views-registry-plan.md` already ruled out one props type for a tool's panel, bar, and tray, and this plan doesn't revisit that: they take different props because they behave differently. A generic options schema rendered three ways was considered and rejected. It would be a small framework, it would have to express every difference listed above, and it would be harder to read than the components it replaced.
* **Rules about settings go in the settings modules.** `brushSettings.ts`, `redactSettings.ts`, and `cutOutSettings.ts` are plain TypeScript, tested under Node, and already hold each tool's `step…Size`. Each gets a read and a write for the size slot in use, and the step functions are rebuilt on them:
  * Draw: `withBrushSize(settings, index)`, beside `brushSizeIndex`. `isBrush` moves here from `DrawPanel.tsx`, next to `BRUSH_TOOLS`, and `penTip` uses it.
  * Redact: `redactSizeIndex(settings)`, which is `null` for the box, and `withRedactSize(settings, index)`. `maskBrush` and `stepRedactSize` use them.
  * Cut out: `isCutBrush(tool): tool is "keep" | "erase"`, `cutSizeIndex(settings, tool)` (`null` for Pick), and `withCutSize(settings, tool, index)`. These take the tool on its own, because the tool in use isn't always `settings.tool`: without subject finding, `cutOutTool` swaps a saved Pick for Erase. That's why the views and `cutBrush` already take `tool` beside `settings`. `stepCutSize`, `cutBrush`, the three views, and `EditorDock.tsx`'s tray entry all use these, so `CutOutOptions`'s `tool` is narrowed by the guard instead of by hand.
* **One table per list of choices, beside the views that draw it.** Names and icons are presentation, and icon names are typed from `@expo/vector-icons`, so the tables stay in the `.tsx` files rather than in the settings modules. That keeps `npm test` free of React. Each table holds the id, the title, and the icon, and every view maps over it:
  * `BRUSHES` in `DrawPanel.tsx` replaces `TOOL_ICONS`, `BRUSH_NAMES`, `PEN_TIPS`, and the list in `BrushOptions`.
  * `REDACT_TOOLS` in `RedactPanel.tsx` gains its ids. The dock maps over it, with Find inserted after it, and the bar's `selected` and `onSelect` use its index.
  * `EFFECTS` in `shell/redactStyle.tsx` is exported. `RedactPanel.tsx` reads its titles there, and `EFFECT_NAMES` goes. Shell can't import the tool, so the table stays in shell, where Find already reads it.
  * `CUT_TOOLS` and `BRUSH_EDGES` in `CutOutPanel.tsx`. The tray's labels become `` `${title} edge` ``, which reads the same as today.
  * `redactSettings.ts`'s `REDACT_TOOLS` and `EFFECTS` (ids for parsing) and `brushSettings.ts`'s `BRUSH_TOOLS` stay. They're the saved-value lists that parsing checks against, typed with each union, and the settings tests cover them.
* **A control drawn the same way twice becomes one component, in shell.** `StrengthChoices` in `redactStyle.tsx` takes `effect`, `strength`, `nowrap`, and `onPick`, and Redact's tray and the effect chip's popover both draw it. `customSwatch(value, customColor, pickCustom, open)` in `ColorSwatches.tsx` returns the `CustomSwatch`, and `ColorOptions` and `TextStylePanel` both call it.
* **The differences stay where they are.** What a press on the sub-tool already in use does, how each layout draws a choice, and each label stay in their views. Each dock panel keeps its own `pickTool` (three lines), since that's where its behavior differs from the bar's.
* **Behavior doesn't change.** Each step is a move, and the app does the same before and after. A real disagreement found along the way gets its own `fix:` commit before the refactor commit, as in the earlier plans. Cut out's size keys are one already (step 1). The stale `PenTipChip` comment is only a comment, so step 2 corrects it in place.
* **The aim, not a rule.** The three panel files should each lose about 30 to 50 lines, and the settings modules gain about 15 lines each, plus tests. Line count isn't the reason for any of this. A new pen tip still needs its saved id, sizes, and drawing in the settings and the model, but the editor's views should need one edit (`BRUSHES`) instead of five.

## Steps

Each step passes `npm run check`, `npm run typecheck`, and `npm test` (step 1 changes the settings modules and their tests, and the later steps must leave them green). Each ends with a commit in Conventional Commits form. After each step, check the editor on web at 390 and 1440 points wide, and on the iOS simulator and the iPad Pro 13-inch simulator, for the tool the step touched:

* Every sub-tool from the dock, from the bar, and with the tray open.
* Press the sub-tool already in use: in the dock it opens the tray (except Pick), and in the bar it does nothing.
* Every choice in the tray and in each chip's popover. Chips close once a choice is made, and the color picker stays open while it's dragged.
* `[` and `]` step the size of the sub-tool in use, and the bar's size chip and the tray show the new size.
* A size set for one sub-tool (Redact's brush, Cut out's Keep, Draw's pen) stays when another sub-tool's size changes.

### 1. Sizes in the settings modules

First, the fix, in its own commit:

* Reproduce it first. On web, save Cut out's tool as Pick, then make `useCutOut`'s `canFind` false for the check (don't commit that). Open Cut out: Erase is chosen. Press `]`: the size chip doesn't change.
* `cutOutSettings.ts`: `stepCutSize(settings, tool, step)` steps the size of `tool`, the tool in use, and does nothing for Pick.
* `useToolLifecycle.ts`: `stepToolSize` passes `cut.tool`.
* `__tests__/cutOutSettings.test.ts`: a saved Pick stepped as Erase changes `eraseSize`. Stepped as Pick, it changes nothing.

Check: the same steps as above now step Erase's size, and on a device that finds subjects, `]` with Pick chosen still does nothing.

Commit: `fix: step Cut out's eraser size when it stands in for Pick`

Then the refactor:

* `brushSettings.ts`: `withBrushSize`, and `isBrush` (moved from `DrawPanel.tsx`). `stepBrushSize` uses `withBrushSize`.
* `redactSettings.ts`: `redactSizeIndex` and `withRedactSize`. `stepRedactSize` and `maskBrush` use them.
* `cutOutSettings.ts`: `isCutBrush`, `cutSizeIndex`, and `withCutSize`. `stepCutSize` and `cutBrush` use them, each with the `tool` it's given. Test that a saved Pick swapped for Erase reads and writes `eraseSize`.
* Tests in each tool's `__tests__/…Settings.test.ts`:
  * Each read gives the sub-tool's own slot, and `null` for the box and for Pick.
  * Each write changes only that slot.
  * `isBrush` and `isCutBrush` agree with `BRUSH_TOOLS` and with `penTip`.
  * The existing step tests still pass unchanged.
* `DrawPanel.tsx`, `RedactPanel.tsx`, `CutOutPanel.tsx`, and `EditorDock.tsx`'s Cut out tray entry: read and write sizes through these, and test for brushes with `isBrush` and `isCutBrush`. `CutOutOptions` takes the narrowed tool from the guard.

Commit: `refactor: keep each tool's size slot in its settings`

### 2. Draw's brushes in one table

* `DrawPanel.tsx`: `BRUSHES` (`tool`, `title`, `icon`) replaces `TOOL_ICONS`, `BRUSH_NAMES`, `PEN_TIPS`, and `BrushOptions`'s list. The dock's Brush icon, `PenTipChip`, and the tray's tip row read from it. The sub-tools' segments in `DrawBar` come from a small `DRAW_SUB_TOOLS` list, so `selected` and `pickTool` index into it instead of chaining `if`s. Its Brush entry still means `lastBrush`.
* `PenTipChip`'s comment: it opens the four tips, which it lists from the table instead of by name.

Watch: the dock's Brush button shows the last brush's icon after a shape or the eraser. The tip chip and the tray's tip row both show Pen, Highlighter, Marker, and Neon, in that order.

Commit: `refactor: list Draw's brushes once`

### 3. Redact's sub-tools, effects, and strengths

* `RedactPanel.tsx`: `REDACT_TOOLS` gains `tool`. The dock maps over it, with Find after it, as `701b230` fixed. The bar's `selected` and `onSelect` use its index. `EFFECT_NAMES` goes: `RedactOptions` reads titles from shell's `EFFECTS`.
* `redactStyle.tsx`: export `EFFECTS`. Add `StrengthChoices`, which `RedactOptions` and `redactLookItems` both draw. Delete `RedactLook`, which has no callers.

Watch: Find's tray and bar change Redact's `chosen` style, not Redact's own settings. Choosing Blur in a chip's popover keeps it open on the strengths, and a strength closes it.

Commit: `refactor: list Redact's tools and effects once`

### 4. Cut out's sub-tools and edges

* `CutOutPanel.tsx`: `CUT_TOOLS` (`tool`, `title`, `icon`), with Pick left out without `onFindAll`, as now. The dock and the bar map over it. `BRUSH_EDGES` goes to the top of the file, and the tray's edge row reads it, with labels `` `${title} edge` ``.

Watch: where the device can't find subjects (`onFindAll` is undefined), neither the dock nor the bar shows Pick or Subjects, and Erase is chosen, with its own size. To check this without such a device, leave `onFindAll` out in `cutOutProps` for the check, and don't commit that.

Commit: `refactor: list Cut out's tools and edges once`

### 5. The custom swatch's rule

* `ColorSwatches.tsx`: `customSwatch(value, customColor, pickCustom, open)` returns the `CustomSwatch`. Its doc comment describes the rule: it picks the custom color again unless the value is already custom, then opens the picker.
* `ColorPicker.tsx`'s `ColorOptions` and `TextStylePanel.tsx`'s `TabContent` both call it. `TabContent`'s `open` dispatches the text picker, as `onOpenPicker` does now.

Watch: on a phone, with a custom color saved, a press on Text's custom swatch makes the text that color and opens the picker over the canvas. With text already in a custom color, it only opens the picker. Draw's tray behaves the same.

Commit: `refactor: share the custom swatch's rule`

### 6. Docs

* AGENTS.md's Project Structure entry for `screens/editor/`: a tool's settings module holds its rules (which size the sub-tool in use keeps, and what counts as a brush), and its panel file holds one table per list of choices. Its dock, bar, and tray read both.
* `docs/architecture.md`: the same, in the tools' line.
* Note under these steps what the panel files came to.

Commit: `docs: describe where a tool's options are defined`

## Not in this plan

* **The context bar's fade geometry.** `rowEdges`, `leafEdges`, `fadeCut`, and `fadeCutLeft` in `ContextBar.tsx` are pure and untested, and `8c1a506` rewrote them. Moving them to `shell/barFade.ts` with tests is the natural next refactor. It's separate because it shares nothing with the tools' options.
* **`TextStylePanel`'s `ScrollRow`.** It's a simpler scroll fade than the bar's, for the dock's font and swatch rows. It could share the bar's once that geometry is out of `ContextBar.tsx`. Not before.
* **Crop's two layouts.** The straighten dial's props are written out in `CropTool` and in `DialStrip`. That's a small cleanup inside one file, worth doing when Crop next changes.
* **Selection state on web.** `RingChoice`, `Chip`, and Redact's `EffectChoice` mark the chosen option only with `accessibilityState.selected`, which React Native Web ignores (see AGENTS.md). So on web, a screen reader isn't told which tray choice, aspect ratio, or font is chosen. That affects every tray, and it isn't a refactor. It wants its own `fix:` change, choosing between `aria-pressed` and `aria-selected` for a button, and checking `ToolButton`'s use of `aria-selected` at the same time.
* **Find's views.** `FindPanel.tsx` is the third largest tool file, but most of it is its results and the review row, which only Find has. Its options already come from `redactLookItems`.
