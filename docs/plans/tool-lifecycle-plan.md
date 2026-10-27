# How the editor's tools open and close

A refactoring plan for the editor's tool lifecycle, written October 27, 2026. It's the next step in the series that gave each tool one description of its views (`TOOL_VIEWS`, `9702faf`), its options (`bdb2805`), and its canvas input ([canvas-input-plan.md](canvas-input-plan.md), `eb0e554` to `b87e7f6`). After those, the one per-tool question still answered outside the tools, across several files, is how a tool *opens and closes*: what it needs to start, what its mode carries, whether it has a tray or a size, what Done and Cancel do, and which list names it.

This plan changes APIs (`EditorModeAction`, `useEditorTools`'s return, `ToolsPanel`'s exports), not behavior. Nothing the user sees or does changes.

## Why this area

Ranked against the other large files, read at `b87e7f6`:

| Candidate | Size | Why not first |
| --- | --- | --- |
| **Tool lifecycle** (this plan) | `useToolLifecycle.ts` 306, `editorMode.ts` 346, plus parts of 5 others | The most-changed part of the editor (`EditorScreen.tsx` had 15 of the last 50 commits), and the only per-tool knowledge left outside a table. It also holds the editor's one effect-order trap. |
| `projects/projectLifecycle.ts` | 736 | Four concerns in one closure (the open-project registry, the autosave timer and its error, closed-project operations, image files), but cohesive, rarely changed, and covered by 1,023 lines of tests. Splitting out the autosave scheduler is a good later step. |
| `tools/crop/CropTool.tsx` | 744 | Builds its own header, context bar, dock, Escape/Enter handling, and Android back, rather than going through `modeChrome` and `TOOL_VIEWS`. Crop covers the editor with its own canvas, so folding it in is a design change, not a refactor. |
| `shell/ContextBar.tsx` | 763 | Its pure fade geometry is already listed in `follow-ups-plan.md` §3, and is a small move with tests. |
| `EditorCanvas.tsx`, `store/editorSlice.ts` | 656, 593 | Already split by concern; the slice is thin wrappers over `model/edits/`. |

## What happens today

Paths are under `src/screens/editor/`. Outside `tools/`, the tool names `"draw"`, `"redact"`, `"find"`, `"adjust"`, and `"cutOut"` appear 14 times in `useToolLifecycle.ts`, 13 in `editorMode.ts`, and 11 in `shell/ToolsPanel.tsx`. Some of that is the tables themselves. The rest is the same fact written in more than one place:

| Fact | Where it's decided |
| --- | --- |
| A tool's name | `TOOL_TITLES` (`editorChrome.ts`) and `TOOLS` (`shell/ToolsPanel.tsx`): the same five labels twice. |
| Which tools a button can mark | `OpenTool` (`shell/ToolsPanel.tsx`) and `RailTool` (`editorChrome.ts`): the same union twice. Find marking Redact is `TOOLS`' `markedWhile`, and `railChosenTool`'s doc comment restates it. |
| What starting a tool puts in the mode | Three reducer actions, `startTool`, `startAdjust`, and `startCutOut`, whose bodies differ only in the mode they build. |
| Whether a tool has a tray | `hasTray` (`tool !== "adjust"`), though the mode union already says so: only tray tools have `optionsOpen`. |
| Whether a tool has a size for `[` and `]` | `shortcutCommand`'s list (draw, redact, cutOut) and `stepToolSize`'s `if` chain (`useToolLifecycle.ts`), which also calls each tool's step function by name. |
| Whether a tool opens the inspector | `EditorScreen.tsx`: `tool === "find" \|\| tool === "adjust"`, which is exactly the tools with an `inspector` in `TOOL_VIEWS`. |
| What Done and Cancel do | `useToolLifecycle`: Draw and Redact deselect on Done; Find's Done and Cancel go back to Redact. Cut out's way into Redact is in `useEditorTools`, a different hook. |

### Two hooks, one lifecycle

`useEditorTools` builds the tool hooks, then calls `useToolLifecycle` with eight of its own twelve inputs again, plus the hooks it just built. The file is `useToolLifecycle.ts`, but the screen imports `useEditorTools` from it.

Their order matters. `useToolSession`'s effect has to begin the undo session before `useToolLifecycle`'s effect starts Cut out's cut, or a remembered mask lands in the session's starting document, where Cancel can't take it back. Today that's held by call order across the two hooks and explained in both doc comments.

The two ways back into Redact are in different hooks and work differently. Find's (`backToRedacting`) resets Find and calls `startRedacting`, which picks Redact's sub-tool from the selection. Cut out's (`onRedact`) cancels its session, adds the masked redaction, sets the sub-tool to the box itself, and dispatches `startTool`. `chooseTool` would read the selection from before the redaction was added, so Cut out can't call `startRedacting` and get the same result. Both are right as written, but nothing next to either one explains why they differ.

## Decisions

* **One list of the shell's tools, in a pure file.** `TOOLS`' data (key, label, icon, `needsImage`, `dock`, `markedWhile`) moves from `shell/ToolsPanel.tsx` to `shell/toolList.ts`, with no React import (the icon name stays a type-only import). `editorChrome.ts` is tested in Node, so it can read labels from there but not from a `.tsx`. `TOOL_TITLES` goes, and `modeChrome` reads `toolLabel(tool)`. `OpenTool` and `RailTool` become one `MarkedTool` in `toolList.ts`. The root may import `shell/`, and `toolList.ts` imports only `../shortcuts.ts`, which `biome.json` already allows, so no lint rule changes. `ToolKey` and `TOOL_KEYS` stay in `shortcuts.ts`: `HeaderActions`, `RedactPanel`, and the stickers tool import from there too.
* **One action starts a tool, carrying what it needs.** `EditorModeAction` gets `{ type: "startTool"; start: ToolStart }`, where `ToolStart` is `{ tool: "draw" | "redact" | "find" } | { tool: "adjust" | "cutOut"; layerId: string }`. A small `toolMode(start)` builds the mode: tray tools get `optionsOpen: false`. One reducer case replaces three. `startAdjust` and `startCutOut` go.
* **The mode union stays the source for trays and targets.** `hasTray` becomes `mode.type === "tool" && "optionsOpen" in mode`, and `settle` checks `"layerId" in mode` for Adjust and Cut out. Both then follow the union, so a new tool with a tray or an image gets them by its shape, not by a second list. No per-tool table in `editorMode.ts`: the union already is one, and the other facts each have one reader.
* **Each sized tool steps its own size.** `useDrawTool`, `useRedactTool`, and `useCutOutTool` each return `stepSize(step)`, the `stepBrushSize`, `stepRedactSize`, or `stepCutSize` call and the `change` that follows it. `editorMode.ts` exports `SIZED_TOOLS`, which both `shortcutCommand` and `stepToolSize` read. `stepToolSize` becomes a lookup: `{ draw, redact, cutOut: cut }[tool]?.stepSize(step)`.
* **The inspector follows `TOOL_VIEWS`.** `EditorDock.tsx` exports `hasInspectorSection(panel)`, and `EditorScreen` asks it in place of its own list. A tool that gains an inspector section opens the inspector with no second change.
* **One hook opens and closes the tools.** `useToolLifecycle` folds into `useEditorTools`, and the file becomes `useEditorTools.ts`. The order constraint becomes local and visible, top to bottom: `useToolSession`, the tool hooks, the starters, then the pending-cut effect. `useToolSession` stays its own exported hook. Its doc comment keeps the reason it runs first.
* **The two ways back into Redact sit side by side, not merged.** Both move into `useEditorTools` beside each other, each with a line on why it differs: Find picks Redact's sub-tool from the selection, while Cut out sets the box itself because the selection it would read is stale. Merging them would change which sub-tool Cut out lands on in a corner case, which this plan avoids.
* **`ToolStarters` stays a record, built once.** `mapStarters` keeps its shape. Its body can map over `TOOL_KEYS`' keys so a new key can't be missed, typed back with one cast.

## Steps

Each step is its own commit and passes `npm run check`, `npm run typecheck`, and `npm test`.

### 1. List the shell's tools once

* Add `shell/toolList.ts` with `ToolEntry`, `TOOLS`, `MarkedTool`, and `toolLabel(key)`. `ToolsPanel.tsx` and `LayerActionsPanel.tsx` import `TOOLS` from there.
* `editorChrome.ts`: drop `TOOL_TITLES` and `RailTool`. `modeChrome` uses `toolLabel`, and `railChosenTool` returns `MarkedTool | null`. `EditorRail.tsx` takes `MarkedTool`.
* `__tests__/editorChrome.test.ts` should pass with only its imports changed. That's the check that the labels match.

`refactor: list the editor's tools once for the dock, rail, and chrome`

### 2. Open the inspector for the tools with a section there

* `EditorDock.tsx`: export `hasInspectorSection(panel: DockPanel): boolean`, reading `TOOL_VIEWS`.
* `EditorScreen.tsx`: `inspectorRequested: layersOpen || (tool !== null && hasInspectorSection(tool))`. Keep the comment above it.

`refactor: open the inspector for the tools that have a section there`

### 3. Start every tool with one mode action

* `editorMode.ts`: add `ToolStart` and `toolMode`. Replace the three start actions with one `startTool` case. `hasTray` and `settle` read the mode's own fields, as decided.
* `useToolLifecycle.ts` (still separate here): `startAdjusting` and `startCutOut` dispatch `{ type: "startTool", start: { tool, layerId } }`. Cut out's `onRedact` in `useEditorTools` dispatches the new shape too.
* `__tests__/editorMode.test.ts`: update the 14 uses of `startAdjust` and `startCutOut`. Every expectation stays the same.

`refactor: start every tool with one mode action`

### 4. Keep each tool's size step with the tool

* Add `stepSize(step: 1 | -1)` to `useDrawTool`, `useRedactTool`, and `useCutOutTool`. Each leaves its settings alone when the step changes nothing, as `stepToolSize` does now.
* `editorMode.ts`: export `SIZED_TOOLS`. `shortcutCommand` checks it in place of its three comparisons.
* `stepToolSize` becomes the lookup, guarded by `SIZED_TOOLS`.
* `__tests__/editorMode.test.ts`'s `brushSize` cases pass unchanged.

`refactor: keep each tool's size step with the tool`

### 5. Open and close the tools from one hook

* `git mv useToolLifecycle.ts useEditorTools.ts`. Fold `useToolLifecycle`'s body into `useEditorTools` after the tool hooks, and drop its parameter list. Return the same object, so `EditorScreen` changes only its import path.
* Put Find's `backToRedacting` and Cut out's `onRedact` next to each other, with their comments, as decided.
* Update the imports in `EditorScreen.tsx` and `EditorDock.tsx` (`EditorTools`).
* Update `AGENTS.md` (`useToolLifecycle.ts`: `useEditorTools`) and `docs/architecture.md` (`useToolLifecycle`: `useEditorTools`) to name `useEditorTools.ts`. Grep `docs/interactive/` for both names; no lesson quoted either at `b87e7f6`.

`refactor: open and close the editor's tools from one hook`

### 6. Verify

* Run `npm run build:web` (imports moved) and `npm run build --prefix docs/interactive`.
* In the web editor, at 390 and 1440 points wide:
  * open each tool from the dock, the rail, its key, and a selected layer's actions, then Cancel and Done it;
  * Draw and Redact deselect on Done, and the other tools don't;
  * `[` and `]` step Draw's, Redact's, and Cut out's sizes, do nothing for a box or Find, and are left alone outside a tool;
  * Find opens the inspector on a short window, and Adjust does too; Find's Done redacts what's chosen and goes back to Redact, and its ✕ goes back without redacting;
  * Cut out's Redact lands in Redact's box tool with the masked redaction selected, and Cancel there leaves the redaction;
  * start Cut out on a photo with a remembered cut, then Cancel: the photo goes back to how it was (the effect-order case);
  * hide the image Adjust or Cut out is working on: the tool closes, and stays closed when it's shown again;
  * the rail marks Redact while Find is open.
* Add this plan's commits to the simulator pass in `follow-ups-plan.md` §1.

## Result

* Each of a tool's facts is written once: its label in `shell/toolList.ts`, its tray and target in the mode union, its size step in its own hook, its inspector section in `TOOL_VIEWS`.
* One reducer action starts any tool. `editorMode.ts` drops two actions and its `hasTray` rule.
* One hook, `useEditorTools`, builds the tools and opens and closes them, with the session's ordering visible in one function.
* Adding a tool with a tray, a size, or an inspector section needs its mode member, its `TOOLS` entry, its `TOOL_VIEWS` entry, and its starter, with no lists elsewhere to keep in step.

## Not in this plan

* **Crop through the shared chrome.** `CropTool` keeps its own header, bar, dock, and keys. Folding it into `modeChrome` and `TOOL_VIEWS` is worth its own plan, after this one gives every other tool one way in and out.
* **A per-tool table in `editorMode.ts`.** Weighed and left: the union already says which tools have a tray or an image, and each remaining fact has one reader.
* **Merging the two ways back into Redact.** They differ for a reason (see above).
* **Splitting `projectLifecycle.ts`'s autosave scheduler** and **the bar's fade geometry.** Both are listed in "Why this area" and stand on their own.
