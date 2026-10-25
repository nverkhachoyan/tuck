# Context bar

A plan for the wide editor (1024 points and up: web, and iPad), written October 2026. Opening a tool there swaps the inspector's layers for the tool's footer, its row of sub-tools, and an options tray, so the layers go away while you add to them, and a color is three clicks off (the tool, Style, a swatch). Those pieces are the phone's dock turned on its side: `Dock layout="inspector"` and `INSPECTOR_TRAY` place the phone's parts in a card.

Instead, the header becomes a **context bar**, as in Photoshop's options bar, and the inspector shows only the layers.

## The layout

```
┌──────┬─────────────────────────────────────────────────────┬──────────────────────┐
│  ‹   │ Draw  [Brush|Shape|Eraser]  ● color  ·•●⬤  Pen ▾  ✕ ✓ │ Reset  ↶ ↷  Export  │
├──────┼─────────────────────────────────────────────────────┴──────────┬───────────┤
│ rail │                         canvas                                 │  layers   │
```

* **The rail** picks a tool, as now.
* **The bar** sits between Back's column and the header's actions, in the header's 56 points. It holds what's in context, in this order: the context's name, its sub-tools as a segmented row, its options inline, then ✕ and ✓, set off from the header's actions by a divider. With nothing in context, the project's title and save status show there, as now.
* **The inspector** always shows the layers, with two exceptions that need its height: Adjust's dial and sliders, and Find's results, each a section above the layers.
* **Popovers** hold what a bar can't show inline: the color palette (with the picker and eyedropper), shape kinds, fonts. Each opens from a chip in the bar that shows its current value.

What goes in the bar:

| Context | Sub-tools | Inline options | Popovers |
|---|---|---|---|
| Draw | Brush · Shape · Eraser | size dots; pen tip (Pen, Marker, Neon) while a brush is in use | color; shape kind |
| Redact | Box · Brush · Eraser, and Find as a button | effect, strength; size for the brush | color, for a solid effect |
| Find | | effect, strength (the style of what Done redacts) | color |
| Cut out | Pick · Keep · Erase, and Subjects as a button | size, soft edges for the brushes; Invert, Redact | |
| Text (selected or typed) | | align | font; text color, outline, box (a chip each) |
| A selected layer | | its actions (`layerActionsFor`) and Sticker | |
| Adjust | | | (the inspector section) |

Crop and Stickers follow the wide layout too (see [wide-crop-stickers-plan.md](wide-crop-stickers-plan.md)): Crop's options sit in this bar, and stickers open beside the rail. Phones and narrow windows keep Crop's dock and the sticker sheet, and the dock and trays otherwise.

## Decisions

* **Sub-tools go in the bar, not in flyouts off the rail.** Photoshop hides a tool's siblings behind a long press, which few people find. A segmented row at the bar's start keeps them one click away and visible.
* **✕ and ✓ stay.** Tuck's tools are sessions that ✕ cancels, unlike Photoshop's, which are always on. The footer's title, ✕, and ✓ move into the bar, keeping Escape as Done.
* **Options apply at once and stay visible**, so on wide screens there's no Style button and no `optionsOpen`. `editorMode`'s tray state (`toggleToolOptions`, `closeToolOptions`, `openTray`) stays for phones; the wide layout ignores it.
* **A popover's open state belongs to its chip**, not to `editorMode`: it's one control's state. Starting the eyedropper from one closes it, as the tray does now.
* **iPad gets it too.** The wide layout is chosen by width, not platform, and iPad landscape gains as much as a desktop. Every target in the bar and its popovers stays 44 points.
* **Overflow scrolls.** Between 1024 and about 1200 points Text's chips might not fit. The bar's row then scrolls sideways with a fade at its end, as the text panel's `ScrollRow` does, rather than wrapping or dropping options.

## Steps

Each step builds, passes `npm run check`, `npm run typecheck`, and `npm test`, and leaves both layouts working, with a commit message handed over at the end.

### 1. A popover in `ui/`

`ui/Popover.tsx` and `ui/Popover.web.tsx` (same extension, see AGENTS.md): a card anchored below a control, or above it near the window's bottom, kept inside the window's edges.

* Web portals it to the body, as `Tooltip.web.tsx` does, and positions it from the anchor's `getBoundingClientRect`. Native uses a transparent `Modal` and `measureInWindow`.
* An outside press closes it, through an `absoluteFill` `Pressable` behind the card as a sibling (a wrapping `Pressable` would close it on any click inside, on web). Escape closes it before the editor sees the key, so Escape inside a popover doesn't also finish the tool.
* It's a dialog for screen readers. On web, focus moves into it and back to its anchor when it closes.
* It takes colors from `colors`, its corners from `radii`, and its shadow from `floatingShadow`.

Nothing uses it yet. Check it by temporarily mounting one in the editor, in the browser pane and on the iPad simulator, then remove the mount.

Commit: `feat: add an anchored popover`

### 2. Options built from shared parts

Split the trays' contents into parts both layouts can arrange, with no visible change on phones:

* `ColorChip` in `shell/ColorPicker.tsx`: a swatch showing the current color that opens `ColorOptions` in a popover, with the custom color and eyedropper as now.
* `SizeChoices` in `shell/ToolOptions.tsx`: the five `SizeDot`s as `RingChoice`s, which `BrushOptions`, `RedactOptions`, and `CutOutOptions` each build today.
* Each tray (`BrushOptions`, `RedactOptions`, `CutOutOptions`, `TextColorPicker`) arranges the parts with its `ToolOption` labels, as now.

Compare phone screenshots of every tray before and after; they should match.

Commit: `refactor: build tool options from shared color and size parts`

### 3. The bar, and Draw in it

* `shell/ContextBar.tsx`: the bar's frame (the context's name, a scrolling row for its children with a fade, ✕ and ✓ with their shortcuts and tooltips), as a `toolbar` for screen readers. `DockFooter`'s logic for which ✕ and ✓ show is shared, not copied.
* `ScreenHeader` takes the bar in place of its title while there is one. The header's actions stay at the right; Reset stays among them.
* `EditorDock.tsx` gains `ContextBarContent`, choosing what goes in the bar as `DockContent` does for the dock. Draw's goes in `DrawPanel.tsx` beside its panel: `DrawBar`, with the sub-tools, `SizeChoices`, the pen tips, a `ColorChip`, and a shape-kind popover.
* On wide screens with Draw open, the inspector keeps the layers, no tray opens, and the canvas's tap no longer has a tray to close. The other tools still use the inspector as now.
* Plain `[` and `]` (free today; ⌘ with them reorders layers) step the brush size down and up while a sized tool is open, and the shortcuts list says so.

Check on web at 1024 and 1440 points wide and on the iPad Pro 13-inch simulator: draw, change color and size mid-session, ✕ takes the strokes back, ✓ keeps them, Escape closes an open popover first and then finishes.

Commit: `feat: show Draw's options in the wide editor's header`

### 4. Redact and Find

`RedactBar` and `FindBar` beside their panels. Find's results (`FindTray`) move into an inspector section above the layers on wide screens, so its found faces and text sit beside the list they'll join. Done's label (`Redact 3 selected`) stays on ✓'s tooltip and screen-reader label.

Commit: `feat: show Redact and Find in the wide editor's header`

### 5. Cut out

`CutOutBar`: Pick, Keep, Erase, Subjects (busy while finding), the brushes' size and soft edges, Invert, and Redact, each with its busy state. The green and red wash on the canvas is unchanged.

Commit: `feat: show Cut out in the wide editor's header`

### 6. Text

`TextBar`, for a selected text layer or the text being typed: a font chip (its popover shows `FontPicker`'s previews), three color chips (text, outline, box, each opening `ColorOptions` for its key), and align inline. The tabs stay on phones. While typing, the bar must not take focus from `TextEditor`'s hidden input: pressing a chip keeps the caret, and closing a popover returns focus to the input, not the chip.

Check with a hardware keyboard on web and iPad: type, change the outline color from its popover, keep typing without clicking back into the text.

Commit: `feat: show text style in the wide editor's header`

### 7. A selected layer, and Adjust

* A selected photo, drawing, shape, or redaction shows its actions in the bar, with its kind as the name and ✓ to deselect. `SelectionBar`, floating by the layer, is unchanged.
* Adjust moves into an inspector section above the layers: its choices and the dial, as `AdjustPanel` lays them out now. The bar shows its name, ✕, and ✓.

The inspector now shows only the layers and these sections, so `Dock`'s `inspector` layout, `InspectorBackdrop`'s use for trays, and `INSPECTOR_TRAY` have nothing left to place.

Commit: `feat: show selected layers and Adjust in the wide editor's header`

### 8. Clean up

* Remove `Dock`'s `inspector` layout, `INSPECTOR_TRAY`, `TrayPlacement`, and `useEditorLayout`'s `trayPlacement`. The inspector becomes a plain card holding `LayersPanel` and the sections.
* Make sure no wide code path reads `optionsOpen` or renders `ToolTrays`, apart from the eyedropper's hint.
* Update the doc comments that describe the inspector (`Dock`, `useEditorLayout`, `ToolsPanel`, `HeaderActions`), `docs/architecture.md`, and AGENTS.md's Project Structure for `ContextBar` and `ui/Popover`. Add any learnings from steps 1–7.
* `npm run build --prefix docs/interactive`, in case a lesson renders something that moved.
* Release screenshots for iPad come from a Release build (see `docs/store-listing/listing.md`); retake them if the store listing shows the editor with a tool open.

Commit: `refactor: remove the inspector's tray layout`

## Risks

* **Focus while typing (step 6).** On web, any press in the bar can blur the hidden `<textarea>` and end the keyboard's input. The bar's controls may need to prevent their pointer-down default on web so focus stays put; prove this before building the rest of step 6.
* **Popovers on iPad.** A native `Modal` covers the window, so the canvas can't be touched while one is open. That's the expected behavior for a popover, but it differs from web if the web version lets canvas clicks through; keep both modal.
* **Two layouts per tool.** Each tool gets a bar and keeps its phone panel. The shared parts from step 2 keep the logic in one place; what's duplicated is only arrangement. If a tool's bar and panel start to disagree about behavior (what a second press on the active sub-tool does, say), move that rule into the tool's hook.
* **Header width at 1024.** About 700 points remain after Back's column and the actions. Draw needs about 570. Text is the tightest and relies on chips with popovers; the scrolling row is the fallback, not the design.
