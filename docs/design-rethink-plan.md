# Design rethink plan

A second design pass, from a review on 2026-09-28 of every screen and tool on the web build at 390 × 844 and 1440 × 900. The review, with screenshots beside mockups of the proposed screens, is at https://claude.ai/artifact/9kVVNJQzK8yFjLEDTZ5dyf.

It follows `ui-polish-plan.md`, whose seven steps are done. That plan made each tool work; this one makes them all work the same way. The foundations stay: the flat editor, the opaque dock in the screen's color, neutral grays with one warm accent, ✓ at the bottom within the thumb's reach, the labeled selection bar, and detection that proposes and never applies.

## How to work through it

* One step at a time, in order. After each step, verify it, stop, and hand over a Conventional Commits message. The user reviews and commits each step; don't run `git commit`.
* Steps marked **Propose first** need a screenshot or quick mockup and the user's OK before building.
* Verify at phone width (390 × 844) and desktop width on web, and on the iOS simulator for anything touching gestures, safe areas, the keyboard, or native modules. Run the checks from AGENTS.md: `npm run check`, `npm run typecheck`, `npm test` for pure modules, and `npm run build:web` after changing platform files.
* When a step changes documented behavior, update the component comments, AGENTS.md, and VISION.md to match. Tick steps off here as they land.

## The rules

Every step below applies one of these.

1. **One bottom bar.** Every mode other than the main editor, whether a tool or a selected layer, ends in the same footer row: ✕ at the left, the mode's name in the middle, ✓ at the right. The footer is a row of its own under the dock's content, so tabs, chips, and the dial get the full width. The mode's name moves from the header to the footer; the header keeps undo and redo.
2. **Trays, not glass cards.** A tool's options rise out of the dock as an opaque tray in `colors.surface`, with a hairline top edge and `radii.large` top corners. The canvas refits above an open tray, so the photo is never under chrome. Only the selection bar floats over the canvas, as an opaque pill. `GlassView` and the glass colors retire.
3. **One way to show a choice.** A chosen option gets a 1.5px outline in `colors.chosen` with `radii.small` corners. A chosen color gets a ring with a gap, and every swatch has a hairline ring so black and white both show on any background. A chosen tab is semibold with a 2px underline. Nothing is marked by a white or gray fill.
4. **A scale.** Text uses five sizes and two weights from `theme.ts`, shapes three radii, spacing a 4-point scale. Controls, tool names, and screen titles use the system font; Instrument Serif is kept for the wordmark and home's headings.
5. **✕ cancels.** Every tool is a session. ✕ puts the document back as it was when the tool opened; ✓ keeps it. Either way the session is one undo step.

## Decisions

Taken from the review's recommendations. The user can overturn any of them before the phase that depends on it.

* **The canvas refits when a tray opens or closes**, animated over about 250ms. Selection changes still never move it. (Phase 3.)
* **Export becomes a sheet over the editor**, not a screen. The editor already shows the result. (Phase 4.)
* **Every tool gets ✕**, not only Crop. A selected layer's footer has no ✕, since there's nothing to cancel; typing gets one, which throws away the text being written. (Phase 2.)

## Phase 1: Fixes and foundations

### 1.1 Fix what's broken (done)

Built as described. The dock's end columns are now as wide as their button (48pt), which fits Redact's five tools at 390pt; the text tabs size to their labels. The adjusted image is outlined only when the document has other images, where it could be mistaken for one of them. MediaPipe's info lines are demoted to `console.info` in `modules/image-analysis/src/mediaPipeFaces.ts`, since `LogBox.ignoreLogs` is a no-op on web.

* **Redact's fifth tool is clipped at 390pt**, and **the text style tabs collide while typing.** The dock's end columns (`end` in `Dock.tsx`, `BUTTON_SIZE + 12` each) leave 270pt, and five 56pt tools don't fit. Phase 2's footer is the real fix; until then, narrow the end columns so the rows fit at 390pt.
* **Share and Copy don't fill their row on a phone** (`features/export/ExportScreen.tsx`): `actionWide` (`flex: 1`) only applies when the layout is wide. Apply it in the narrow row too.
* **A black swatch disappears on the dock**: Redact's Style tile draws its color with no ring. Give it the hairline ring every swatch gets (rule 3).
* **Find takes two taps**: the dock's Find opens a card whose only action is a second Find (`redact/DetectionOptions.tsx`, the "choosing" state). Start detection from the dock's Find.
* **Adjust**: the photo keeps its blue selection outline while it's being adjusted, as if it were being moved. Hide it in Adjust. Make the value under the icons readable (primary text).
* **Dev only**: MediaPipe logs "INFO: Created TensorFlow Lite XNNPACK delegate" through `console.error`, so the development overlay shows a red toast over the dock after every first Find. Keep it out of `console.error`.

### 1.2 Tokens (done)

Built with `typography`, `radii`, and `space` in `theme.ts`. `label` came out regular (400) rather than medium: 13pt running text in cards read heavy at 500, so medium is left to `caption`, the tool labels. `extraLarge` was folded into `large` (20), and what used `large` (16) for buttons and cards moved to `medium` (12). Spacing isn't applied yet.

Add to `theme.ts`, then replace literal values:

* **Type**: `caption` 12/500 (tool labels, hints), `label` 13/500 or 600 (chips, tabs, rows, small buttons), `body` 15/400 (cards and sheets), `title` 17/600 (buttons, screen and mode titles), and `display` for the serif sizes. Today's 10, 11, and 12 become caption; 13 and 14 label; 15 and 16 body; 17 title.
* **Radii**: `small` 8 (controls, chips, the chosen outline), `medium` 12 (buttons, cards, the selection bar), `large` 20 (trays and sheets). `extraLarge` folds into `large`. `panel` stays until phase 3 removes the glass panels that use it.
* **Spacing**: 4, 8, 12, 16, 24, 32. Use it in code each step touches rather than rewriting every padding at once.

Tool labels grow from 11 to 12pt: check that Redact's five tools still fit at 390pt.

### 1.3 One way to show a choice (done)

Built with `chosenOutline` and `chosenUnderline` in `theme.ts`, which every outlined or underlined choice now uses. `RingChoice` gained an `outline` variant for icons (Draw's brush types and shapes); colors, sizes, and Redact's strengths keep the ring. Header toggles (Layers) and Crop's Turn layers switch are outlined too. `chosenSoft` and `onChosen` are gone.

Apply rule 3 everywhere:

* Text style panel (`text/TextStylePanel.tsx`): the chosen font chip is outlined, not filled white; the tabs use the underline.
* Export's size chips (`ExportScreen.tsx`): outlined.
* Redact's Effect row (`redact/RedactPanel.tsx`): Solid, Blur, and Pixelate are outlined when chosen, not a gray tile.
* The Add sheet's category tabs (`add/AddSheet.tsx`): underlined.
* Swatches (`ColorSwatches.tsx`, `ui/RingChoice.tsx`, `ui/BackgroundPicker.tsx`, the Style glyphs in Draw and Redact): hairline ring on every swatch, gap ring when chosen.
* Give the outline one home (a style in `theme.ts` or a small helper in `ui/`) so tools, crop ratios, and adjustments share it rather than each spelling out the `boxShadow`.

### 1.4 Headers (done)

Built as described. Back's label now names its destination ("Back to projects", "Back to editor"), since it's only heard or seen as a tooltip. Layers already sat beside undo and redo; the 22pt gaps between them made it look adrift, so they're 14pt now, with a little more before Export.

* Screen and mode titles use the system font at `title` size (`ui/ScreenHeader.tsx`). Home's "Recent" and the wordmark keep the serif.
* Back is an icon with a 44pt target, with its label kept for accessibility and shown as a tooltip on web, instead of "‹ Projects", "‹ Edit", or "‹ Back".
* In the editor's header, Layers moves beside undo and redo on the right, before Export.

## Phase 2: One bottom bar

### 2.1 The footer (done)

Built as described, with the review's mockup as the proposal. The dock is 144pt: a 100pt panel row and a 44pt footer row, which the main tools leave empty so their row sits where every mode's does. A selected layer's footer names its kind (`layerKindName` in `panels/LayerRow.tsx`). ✕ appears only in Crop until 2.2.

* `Dock` gains a footer row under its content: ✕ at the left, the mode's name in the middle, ✓ at the right. It replaces the `start` and `end` slots and `DockButton`'s side columns, giving the content the full width. The main editor has no footer: its tool row takes the dock's whole height, so the canvas doesn't move as modes open and close.
* Every tool uses it: Draw, Redact, Adjust, and Crop, and text while typing. The header drops the tool's title and keeps undo and redo (and Adjust's Reset).
* A selected layer is a mode too: its footer shows the layer's kind ("Text", "Photo", "Sticker", "Shape", "Redaction") and ✓, which deselects. This is how the user gets back to the tools.
* Keep the shortcuts: Escape finishes Draw, Redact, and Adjust (and deselects); in Crop, Escape cancels and Enter applies. Show them in the footer buttons' tooltips on web.
* While typing, the footer rides the keyboard with the style panel, as the dock does now.

### 2.2 Tool sessions (done)

Built in `store/editorSlice.ts` as `beginSession`, `commitSession`, and `cancelSession`, tested in `editorSlice.test.ts`. The editor begins a session when Draw, Redact, or Adjust opens and commits it when the tool closes, from an effect on `tool`, so leaving the editor commits too. Undo stops at the session's start; ✕ is the way back from there. Crop keeps its own cancel, which never touched the document. Typing's ✕ discards the draft, which was never in the document either.

* Opening a tool records the document and the undo history's length. ✕ restores that document; ✓ keeps it. Either way the session collapses to one undo step, so ⌘Z after ✓ undoes the whole session. This belongs in `store/editorSlice.ts` (say `beginSession`, `commitSession`, `cancelSession`), tested in `editorSlice.test.ts`.
* Crop already cancels; move it onto the same mechanism if that simplifies `crop/useCropController.ts`, otherwise leave it.
* Typing's ✕ removes a new text layer, or restores an existing layer's text.
* Leaving the editor with a tool open commits the session, as it does today.

## Phase 3: Trays

### 3.1 Trays replace the floating cards (done)

Built with the review's mockup as the proposal. `Tray` in `ToolOptions.tsx` sits on the dock and reports its height through the `TrayHeight` context, and the editor fits the canvas above the dock and the tray. `EditorCanvas` eases what it draws to any new fit over 250ms (so the keyboard and the layers sidebar ease it too), while gestures use the new fit at once. Crop's aspect row already sat on the dock's color above it, so it stays. `ToolButton` takes `open` for Style and Find.

* Draw's and Redact's Style cards (`ToolOptions.tsx`, `draw/DrawPanel.tsx`, `redact/RedactPanel.tsx`), the Find card (`redact/DetectionOptions.tsx`), and Crop's aspect row become trays that rise out of the dock, opaque, in `colors.surface`.
* The canvas refits above an open tray, animated over about 250ms (`useDockInset` grows by the tray's height). Selection changes never move it.
* Style's tile shows it's open with a bold label, not a second outline: only the tool in use is outlined.

### 3.2 Opaque everywhere else (done)

`ui/Surface.tsx` replaced `GlassView`: an opaque panel in `colors.surface` with a hairline border and the floating shadow. The web alert, tooltip, and drop overlay lost their backdrop blurs too, and `expo-blur` was uninstalled (the development build still carries it until the next rebuild, harmlessly).

* The selection bar (`panels/SelectionBar.tsx`) becomes an opaque pill in `colors.surfaceHover` with a `borderStrong` hairline and `radii.medium` corners.
* The Add sheet (`add/AddSheet.tsx`, `ui/BottomSheet.tsx`) and the layers panel (`panels/LayersPanel.tsx`) become opaque; the color picker and the save error banner too.
* Delete `GlassView` and the `glass*` colors, `radii.panel`, and anything else only they used.

### 3.3 Adjust (done)

Each adjustment is an icon over its name. While the dial moves, the value shows at `typography.figure` (28pt, a new token) in a small dark plate just above the dock, fading out when the finger lifts; the controller exposes `changing` for it. The dial's own readout is the value alone now that the chosen name is lit.

* Label every adjustment (icon over name, as in the other tools), and dot the ones that aren't at zero.
* While the dial moves, show the value large above it (`title` size or bigger, tabular figures).

## Phase 4: Export and home

### 4.1 Export as a sheet (done, except quick copy)

The export route stays and is presented as a `transparentModal`, so the editor shows behind the sheet and features still don't import each other. Sizes are named Full size (or Largest), Medium, and Small; picking JPEG for a transparent canvas says it fills transparency black. A saved export offers Back to Projects. Opened from a link or a reload, the route still sends the user to the editor, without the sheet. Long-press to copy is deferred (see Later): it needs export's sizing and clipboard code in a shared module and a toast to confirm.

* Export opens a sheet over the editor instead of navigating. It holds size as a two-way choice with names ("Full size", "Smaller") and pixels as the detail, format (JPEG or PNG, defaulting as `exportFormatFor` does, with "keeps transparency" under PNG), then Save (Download on web) as the primary action and Share and Copy side by side.
* The `/projects/[id]/export` route still has to work from a link or a reload: send it to the editor with the sheet open, and keep `vercel.json`'s rewrite. Update AGENTS.md's routing learning.
* Long-press Export (⌘⇧C on web) copies the full-size image without opening the sheet.

### 4.2 Home (done)

Built with the review's mockup as the proposal. Paste now works on web too, reading the clipboard with the browser's permission, and says what to do when there's no image. Rename stays in Edit mode, which the long-press menu's Rename turns on: a long press can't take typing everywhere (only iOS has a text prompt). With a mouse, hovering a thumbnail shows its name, date, and the Duplicate and Delete buttons.

* The three ways to start are equal tiles: Photo (accent), Paste, and Canvas. Below 1024pt they sit at the bottom, under the thumb, with the grid fading out above them; wider, where a mouse makes reach moot, they head the projects. Paste stays visible on every platform and says what to do when the clipboard has no image.
* Projects are a bare three-column grid of thumbnails with no card around each. Long-press (right-click on web) offers Duplicate and Delete, replacing Edit mode.
* A project named from its text is shown in sentence case, not the text's own capitals.
* The empty state keeps today's welcome, with the three tiles in its lower half.

## Phase 5: Desktop

### 5.1 Rail and inspector (done, except the project's name)

Built with the review's mockup as the proposal. From 1024pt, `EditorScreen` puts `ToolsPanel` in a rail at the left (the tool in use outlined; picking another finishes it) and renders the `Dock` as an `inspector` at the right: the footer heads it, then the mode's panel, then any tray, which `TrayPlacement` sends there, over `InspectorBackdrop`. At rest it shows the layers (`LayersPanel`'s `inspector` layout), and the header drops its Layers button. `EditorCanvas` fits between them with `leftInset` and `rightInset`. Crop keeps its own full-width layout. The header doesn't show the project's name yet: the editor only knows the document, not a name given by renaming, so it needs the name carried into the session first.

* From 1024pt wide, the dock's tools become a rail at the left and trays become an inspector at the right (about 300pt). The canvas takes the space between.
* The inspector's resting state is the layers list, replacing the floating layers panel.
* The header shows the project's name.

### 5.2 Shortcuts (done)

`?` (with or without Shift) opens `ShortcutsOverlay`, listing `SHORTCUT_GROUPS` from `shortcuts.ts` in each platform's notation (`formatShortcut`, now exported by `ui/Tooltip`). Escape or `?` closes it, and other shortcuts wait while it's open.

* `?` opens an overlay listing the keyboard shortcuts from `features/editor/shortcuts.ts`.

## Later, not in this plan

* Long-press Export (⌘⇧C on web) to copy the full-size image without opening the sheet. Move `exportSizes` and `copyImage` somewhere the editor can import (say `render/`), and add a small toast for "Copied".

* First-use hints for pinch and tap-to-edit (carried over from `ui-polish-plan.md`).
* Offering detected regions as soon as Redact opens.
* One-tap looks (presets) in Adjust.
