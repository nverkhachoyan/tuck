# Tool views registry

A refactoring plan for `src/screens/editor/EditorDock.tsx`, written October 2026. The editor-screen refactor (`editor-screen-refactor-plan.md`) left this out on purpose: "worth doing only once steps 1–4 have shown what the tools really have in common." Those steps have landed (`b98bd4b`), so this plan picks it up. Nothing here changes what the editor does. The goal is one place per tool for what it shows, wherever the editor shows it, and a compile error instead of a blank header when a tool is missing one of its views.

## Is it worth it

Yes, as a small refactor. Line count isn't the reason: `EditorDock.tsx` should go from 406 lines to about 330. These are:

* **A missing bar fails silently.** `ContextBarContent` is a chain of `if (panel === …)` ending in `return null`. On a wide window the header hides the project's title whenever `inBar` is true (`EditorScreen.tsx:473`–`480`), and `inBar` is `wide && panel !== "idle"` (`editorChrome.ts`). So a tool added to `EditorTool` without a bar branch gets a header with no title, no options, and no ✕ or ✓, and every check passes. A `Record` keyed by panel turns that into a type error.
* **A tool's views are far apart, and its wiring is written twice.** Draw's dock panel, bar, and tray are at lines 332, 204, and 88. Each surface works out the same props on its own:
  * Draw's color (`withBrushColor(draw.settings, color)`) is in the tray and the bar. `604d2d3` (the highlighter's own color) had to change both.
  * Redact's color, and Find's chosen style (`redact.setChosen(...)`), are each written twice the same way.
  * Cut out's panel and bar take the same nine props (`settings`, `tool`, `finding`, `onChange`, `onFindAll`, `inverting`, `onInvert`, `redacting`, `onRedact`), listed out twice.
* **The screen passes three overlapping prop sets.** `ContextBarContent`, `ToolTrays`, and `DockContent` each take `dispatchMode`, `tools`, and `customColor`, and `onCustomColor` and `onFind` each go to two of them (`EditorScreen.tsx:483`–`494`, `548`–`556`, `609`–`625`). `EditorInspector` switches on the same `panel` for Find and Adjust, which makes four switches, not three.

What it doesn't fix, and shouldn't try to: adding a tool still touches `editorMode.ts`, `editorChrome.ts` (`TOOL_TITLES`), `useToolLifecycle.ts`, `canvasInputFor.ts`, `ToolsPanel`, and `shortcuts.ts`. Those are plain TypeScript tested under Node, or hooks whose order matters (see Decisions), so they stay out of a table of React views. Not doing this refactor at all would also be reasonable. The switches are readable, and none of them is wrong today. The case for it is the silent failure above, which only gets more likely as tools are added, and the paired edits, which will keep happening.

## What happens today

Read from `EditorDock.tsx`, `EditorInspector.tsx`, `EditorScreen.tsx`, `editorChrome.ts`, and `editorMode.ts` at `b98bd4b`.

What each panel shows, by surface:

| Panel | Dock (`DockContent`) | Bar (`ContextBarContent`) | Tray (`ToolTrays`) | Inspector |
| --- | --- | --- | --- | --- |
| `draw` | `DrawPanel` | `DrawBar` | `BrushOptions` | |
| `redact` | `RedactPanel` | `RedactBar` | `RedactOptions` | |
| `find` | `FindPanel` (with Redact's `EffectGlyph`) | `FindBar` | `RedactOptions` on `redact.chosen`; `FindTray` while no tray is open | `FindInspector` |
| `cutOut` | `CutOutPanel` | `CutOutBar` | `CutOutOptions`, except for the pick tool | |
| `adjust` | `AdjustPanel` | none: the title, ✕, and ✓ only | | `AdjustInspector` |
| `text` | `TextStylePanel` | `TextBar`, with `keepFocus` while typing | | |
| `layer` | `LayerActionsPanel` | `LayerBar` | | |
| `idle` | `ToolsPanel`, passed in as `idle` | never in the bar | | |

* **The three switches don't agree on their key.** `DockContent` switches on `panel`. `ContextBarContent` checks `panel` with `if`s. `ToolTrays` checks `openTray(mode)`, which is non-null only for a tool's mode with `optionsOpen`, so it's always the same as `panel` when set (`modeChrome` puts the tool first). `FindTray` checks the mode and the eyedropper directly.
* **`ToolTrays` also holds two overlays that aren't a tool's.** `TextColorPicker` follows `modeState.textPicker`, and `EyedropperHint` follows `modeState.eyedropper`. Neither depends on the panel. A wide window renders its own `EyedropperHint` (`EditorScreen.tsx:558`–`562`), since `ToolTrays` is phone-only.
* **The bar's wrapper is shared.** Every branch of `ContextBarContent` returns `<ContextBar {...chrome}>`, so React keeps one `ContextBar` mounted as the panel changes, with its scroll position and fades. Only text adds a prop (`keepFocus`).
* **Text and layer depend on data that may be missing.** `"text"` needs `text.styledText`, and `"layer"` needs `layerActions`. Each switch checks that again. `modeChrome` only picks `"text"` when there's styled text and `"layer"` when a layer is selected, so those checks never fail.

## Decisions

* **A table of views, not a table of tools.** The table holds what each panel draws in the dock, the bar, the tray, and the inspector. It doesn't hold titles, starters, Done and Cancel, canvas input, or size steps. Those live in `editorChrome.ts` and `canvasInputFor.ts`, which are plain TypeScript so `npm test` can load them, and in `useEditorTools`, whose hook order protects Cut out's undo session. A single "tool object" with all of them would pull React into tested modules and hooks into a table.
* **One table at the editor root, not an entry in each tool's folder.** Tools don't import each other (`biome.json`'s override for `tools/*`), and Find's views use Redact's `RedactOptions` and `EffectGlyph` and Redact's settings. Entries also need `EditorTools` and `dispatchMode`, which come from the root. The table goes in `EditorDock.tsx`, which already imports every tool's views. Keep the file's name: it's in AGENTS.md, `docs/architecture.md`, and the previous plan, and a rename can come later if wanted.
* **Entries are render functions, not components.** `dock`, `bar`, `tray`, `results`, and `inspector` are plain functions that take the context and return elements. They call no hooks. Their lowercase names keep anyone from reading them as components. Each returns the same element, in the same position, that today's switch does, so React mounts and keeps each panel exactly as now. A component per entry would add a layer to the tree and could change when a panel's own state resets.
* **The table is a `Record` over every panel but `"idle"`.** Its type is `Record<Exclude<DockPanel, "idle">, ToolViews>`. A tool added to `EditorTool` without an entry stops the typecheck. `"idle"` stays outside, since its dock is `ToolsPanel`, which the screen builds and passes in, and it's never in the bar.
* **The renderers keep their wrappers.** `ContextBarContent` still renders the one `<ContextBar {...chrome} keepFocus={…}>` and puts the entry's `bar` inside, so the bar stays mounted across panels. An entry without `bar` (Adjust) gets the title and actions only, as now. `ToolTrays` keeps a slot for the tray, a slot for `results` (Find's tray), and its two overlays (`TextColorPicker` and `EyedropperHint`), which aren't per-tool and don't go in the table.
* **One context object, built once.** `ToolViewContext` holds `tools`, `dispatchMode`, `customColor`, a `colorTarget(apply)` already bound to `onCustomColor` and `dispatchMode`, `optionsOpen`, `toggleOptions`, `closeTray`, `bottomInset`, `onFind` (Redact's way into Find), `onBackToRedact` (Find's ✕), `adjustments`, `layerActions`, `editingText`, and `restoreTextFocus`. The screen builds it once and gives it to the dock, the bar, the trays, and the inspector, instead of a separate prop set for each. It's built fresh on every render, as the props are today. Nothing is memoized now, and this doesn't change that.
* **Wiring shared by an entry's views is computed once in that entry.** Small helpers next to the table: `drawColor(c)`, `redactColor(c)`, `findStyle(c)` (Find's `settings`, `onChange`, and color on `redact.chosen`), and `cutOutProps(c)` (the nine shared props). They're plain functions, like the entries.
* **Text and layer keep their checks.** The text entry returns `null` without `styledText` and the layer entry without `layerActions`, as now. With the wrapper in the renderer, those unreachable cases would show an empty bar instead of none. That's accepted, since `modeChrome` never picks those panels without their data. Step 2 says so in a comment next to the entries.

## Steps

Each step passes `npm run check` and `npm run typecheck`. No step adds a pure module, so `npm test` only needs to stay green. Each ends with a commit in Conventional Commits form. After each step, check the editor on web at 390 and 1440 points wide, and at 1440 × 800 (where the inspector stays closed until a panel opens it). Check it on the iOS simulator and the iPad Pro 13-inch simulator too. In each layout:

* Open every tool, then Cancel and Done it.
* Open and close each tray. Pick a custom color and use the eyedropper from Draw's, Redact's, and Find's trays and bars.
* Use Find through review and back to Redact, including its ✕ after finding nothing.
* Switch Cut out between the pick tool (no tray) and a brush.
* Type text, and style it from the bar. On web, the caret must stay in the text after each press in the bar.
* Select a layer and use its bar.
* On a wide window, scroll the bar, then switch tools: the bar keeps its fades.

### 1. One context for the tool views

* `EditorDock.tsx`: `ToolViewContext` and `toolViewContext({ ... })`, which builds it, binding `colorTarget` to `onCustomColor` and `dispatchMode`. `ToolTrays`, `ContextBarContent`, and `DockContent` each take `context` plus only what's their own: `modeState` for the trays, `chrome` for the bar, `panel` and `idle` for the dock.
* `EditorInspector.tsx`: takes `context` for `find`, `adjust`, `adjustments`, and `onFindBack`, keeping `panel` and `layerList`.
* `EditorScreen.tsx`: builds the context once, after `modeChrome`, and passes it to all four.

No entries yet: each switch reads from `context` where it read its props. This step only moves props.

Commit: `refactor: give the editor's tool views one context`

### 2. The table, with the dock and the bar

* `EditorDock.tsx`: `ToolViews` (`dock`, and optional `bar`, `keepBarFocus`, `tray`, `results`, and `inspector`; only `dock` and `bar` are filled in this step) and `TOOL_VIEWS`, one entry per panel in the order of the table above, with a doc comment in the house style (one sentence, then a line per field). Add the shared helpers (`drawColor`, `redactColor`, `findStyle`, `cutOutProps`).
* `DockContent`: `panel === "idle" ? idle : TOOL_VIEWS[panel].dock(context)`.
* `ContextBarContent`: renders `<ContextBar {...chrome} keepFocus={view.keepBarFocus?.(context) ?? false}>{view.bar?.(context) ?? null}</ContextBar>` for any panel but `"idle"`, and `null` for `"idle"`, which the screen never asks it for.
* Check that `keepFocus` is still on only while text is being typed. It's `editingText` in the text entry and absent elsewhere.

Commit: `refactor: draw each tool's dock panel and bar from one table`

### 3. Trays and Find's results

* `TOOL_VIEWS`: `tray` for Draw, Redact, Find, and Cut out (Cut out's returns `null` for the pick tool), and `results` for Find (`FindTray`, with `onBack: context.onBackToRedact`).
* `ToolTrays`: `tray && TOOL_VIEWS[tray].tray?.(context)` in the first slot, where `tray` is `openTray(mode)`. Then `TOOL_VIEWS[panel].results?.(context)` in the second slot, when no tray is open and the eyedropper isn't running (as `FindTray`'s condition is today). Then `TextColorPicker` and `EyedropperHint`, unchanged. `ToolTrays` now needs `panel`, so the screen passes `chrome.panel`.
* The tray slot can hold different components now (`BrushOptions`, `RedactOptions`, `CutOutOptions`). React only reuses one between panels when the type matches, and Redact's and Find's are both `RedactOptions`. That can't happen: starting a tool always closes the tray (`startTool` sets `optionsOpen: false` in `editorMode.ts`). The doc comment says so.

Watch: Find's options tray hides its results while open, and the results come back when it closes. Cut out's tray doesn't open for the pick tool.

Commit: `refactor: open each tool's tray from the views table`

### 4. The inspector's sections

* `TOOL_VIEWS`: `inspector(context, layers)` for Find (`FindInspector`) and Adjust (`AdjustInspector`), each with `layers` as its child.
* `EditorInspector`: `TOOL_VIEWS[panel]?.inspector?.(context, layers) ?? layers`, with `"idle"` handled first (it has no entry). The layers list still renders once, as the section's child or on its own, as now.

Watch: at 1440 × 800, opening Find or Adjust opens the inspector with its section above the layers, and closing the tool closes it.

Commit: `refactor: draw the inspector's tool sections from the views table`

### 5. Docs

* AGENTS.md's editor-root description under Project Structure: `EditorDock.tsx` holds `TOOL_VIEWS`, what each panel shows in the dock, the bar, the trays, and the inspector. A tool's views go there, while its title and actions stay in `editorChrome.ts`.
* AGENTS.md's wide-window entry: say that `TOOL_VIEWS` is what keeps the dock and the bar showing the same tools, next to what it says about `modeChrome`.
* `docs/architecture.md`: the same in the editor root's line.
* `editor-screen-refactor-plan.md`: point its "Not in this plan" item at this plan.
* Note under these steps what `EditorDock.tsx` came to.

Commit: `docs: describe the editor's tool views table`

### Result

`EditorDock.tsx` came to 453 lines, not about 330: it now also holds `ToolViewContext` (about 50 lines) and the inspector's Find and Adjust sections, while `EditorInspector.tsx` went from 60 lines to 30. Review added a `findResults` helper for what Find's results tray and inspector section share, and typed Find's style change as a whole `RedactSettings`, which made `FindBar` generic like `RedactLook`.

## Not in this plan

* Folding titles, starters, canvas input, or size steps into the table. See Decisions: they're plain TypeScript or ordered hooks, and they're already in one place each (`TOOL_TITLES` is a `Record` too).
* Renaming `EditorDock.tsx` to match its contents. It's a cheap follow-up once the table has settled.
* The wide window's separate `EyedropperHint`. It could move into a layout-independent overlay, but it isn't a tool's view.
* Making each tool's panel, bar, and tray share one props type. They take different props on purpose (the dock's panel opens a tray, the bar's chips open popovers), and the helpers in step 2 already share the wiring.
