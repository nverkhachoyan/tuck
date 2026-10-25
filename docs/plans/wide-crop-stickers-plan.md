# Crop and Stickers on wide windows

A plan for bringing Crop and Stickers into the wide editor's layout (1024 points and up: web, and iPad), written October 2026 after a critique of the whole app (snapshot in `.impeccable/critique/`). It's the third of five plans from that critique. It reverses one line of `context-bar-plan.md`: "Crop keeps its own full-screen header, and Stickers keeps its sheet." Phones keep Crop's dock and the sticker sheet exactly as they are.

## What happens today

Checked on web at 1440 and 1280 points wide, by day and at night.

* **Crop is the phone's layout, stretched.** `CropTool` covers the editor with its own `ScreenHeader` (empty but for Reset, so a blank 48-point band), its controls strip, and the phone's `Dock` with a ✕ Crop ✓ footer, all the window's width. The ratio row starts at the left edge while the tabs and footer are centered, so the screen has two alignments. Everything else in the wide editor puts the tool's options in the header and leaves the bottom of the window to the photo.
* **Crop's handles disappear on light edges.** `CropCanvas` draws its corners and outline in white (`#FFFFFF` and 80% white) with no halo. On a light photo's edge over the light table they barely show. The editor's selection already solves this with `SELECTION_HALO`.
* **Nine ratios in one row.** Free, Original, Square, 4:5, 5:4, 3:4, 4:3, 9:16, and 16:9 sit side by side, portrait and landscape interleaved.
* **Stickers open as a phone sheet.** On a wide window the sticker sheet still rises from the bottom, centered, 480 wide, under a scrim that dims the photo, though the button that opened it sits in the rail at the left.

## Decisions

* **Crop's options go in a context bar.** On a wide window, Crop's header carries a `ContextBar` titled "Crop", the same component the tools use: its modes, its options for that mode, then ✕ and ✓ through `ModeActions`, then Reset in the header's actions. The dock and its footer go. Crop still covers the editor (the rail and inspector included), since nothing else can be used while cropping.

  | Mode | Bar |
  |---|---|
  | Crop | `[Crop · Rotate · Fill] ┃ [Free ▾]` |
  | Rotate | `[Crop · Rotate · Fill] ┃ [Rotate 90°] [Flip] [Turn layers]` |
  | Fill | `[Crop · Rotate · Fill] ┃ [Background ●]` |

* **The ratio is a chip.** Its popover groups the nine: Free, Original, Square; then portrait (4:5, 3:4, 9:16); then landscape (5:4, 4:3, 16:9), each group on its own row, the chosen one highlighted. The chip shows the current ratio's name.
* **Turn layers is a check, not a highlight.** In the bar, the highlighter marks the mode only (DESIGN.md). Turn layers is a `BarButton` whose glyph is a checked or empty box, with `accessibilityRole="switch"`. The phone keeps its highlighted toggle.
* **Background is a color chip**, opening `BackgroundPicker` in its popover, as text's colors do.
* **The straighten dial sits under the photo, in Rotate only.** Crop keeps a strip at the bottom of its stage the dial's height (as the phone keeps one so the canvas holds still as tabs change), and the dial shows in it, centered and 360 points wide, while Rotate is chosen and there's a photo to level. A popover can't hold it: it's modal, and straightening is watched on the photo while dragging. See the open question.
* **Crop's handles get the selection's halo.** A 3.5-pixel `SELECTION_HALO` under the outline and the corners, on every layout. The white stays: it reads over the scrim outside the box.
* **Escape still applies the crop**, as it's Done everywhere (the October 4 decision). The shortcuts overlay keeps saying so.
* **Stickers open in a popover beside the rail's Sticker button.** Same content as the sheet (`StickerContent`: the tabs, the grid, Yours), 360 points wide, as tall as five rows. It's modal like every popover, so Escape and an outside click close it, and the photo isn't dimmed. Picking a sticker adds it and closes the popover, as the sheet does.
* **`Popover` learns to open beside its anchor.** Today it hangs below a control, or above it near the window's bottom. A `placement="beside"` puts it to the right, top-aligned with the anchor, kept inside the window, for controls in the rail.

## Open question

The dial's strip takes about 100 points under the canvas in every mode, to keep the photo still when switching modes. The alternative floats the dial as a card over the bottom of the table only in Rotate, and eases Crop's viewport up to make room, as the editor's viewport eases for a tray. That gives Crop and Fill the full height, at the cost of the photo moving when Rotate is picked, and a second viewport inset to keep in step. Settle it before step 4; the plan assumes the strip.

## Steps

Each step passes `npm run check` and `npm run typecheck` (and `npm test` where it touches pure modules), and ends with a commit message handed over. Check on web at 1440, 1280 × 720, and 1024 points wide, by day and at night, and on the iPad Pro 13-inch simulator if the development build launches (otherwise say so when handing over). Check the phone at 390 wide after each step: it must look as it did.

### 1. A halo under Crop's handles

* `CropCanvas.tsx`: draw the outline and corners over a `SELECTION_HALO` stroke 3.5 screen pixels wide, as `SelectionOutline` does (export the halo width from `canvas/SelectionOverlay.tsx` alongside `SELECTION_HALO`). The corners are already a 3-pixel stroke, thicker than that halo, so theirs is wide enough to leave the same dark margin the selection's halo leaves around its line (`SELECTION_HALO_PX - SELECTION_STROKE_PX` beyond the white).

Check on a photo with a white edge and one with a dark edge, at the fit and zoomed, on web and the iOS simulator.

Done. On web, a half-white, half-black photo showed the halo at the fit and in a narrower window, at the same screen thickness. On the iPhone it looked right on a light edge and a dark edge, at the fit and after the view refit.

Commit: `fix: give Crop's handles the selection's halo`

### 2. Popovers beside their anchor

* `ui/Popover.tsx` and `ui/Popover.web.tsx`: `placement?: "below" | "beside"`. Beside measures the anchor as below does, and places the card at its right edge plus a gap, top-aligned, moved up to stay inside the window. Below stays the default.
* Its doc comment, in the short-paragraph-then-list form AGENTS.md asks for.

Check with a throwaway caller near the window's top and bottom, then remove it.

Done on web. A temporary control at the top of the window opened the card at its right edge, top-aligned, and one at the bottom slid the card up to stay inside the window. The control was removed. Nothing in the app opens beside its anchor until Stickers do, so there is no phone check yet.

Commit: `feat: let a popover open beside its control`

### 3. Stickers in a popover on wide windows

* `ToolsPanel` passes a ref to its Sticker button (a prop, threaded to that `ToolButton`'s pressable).
* `StickerSheet.tsx` exports a `StickerPopover`: `Popover` with `placement="beside"`, anchored to that ref, holding `StickerContent`. The grid fits its width already (it measures a view inside its scroll view, per AGENTS.md); check it lands on six tiles across. A 360-point card would measure five: the card and the grid each pad 12, and a classic scrollbar takes about 16 more, so the grid is fixed at six tiles of 56 and the card is wider by the paddings and the scrollbar. The Sticker button's pressable already holds the tooltip's ref, so the anchor ref is assigned beside it.
* `EditorScreen` renders the popover in place of the sheet when `wide`. Opening, closing, adding, saving a new sticker, and deleting one keep their handlers.
* The sheet's doc comment notes it's the phone's.

Check at 1440 and 1024: open from the rail, switch tabs, add a bundled sticker, add one of Yours, save a new one, delete one (hover's delete button), Escape, an outside click. On iPad, check touch and that long-press delete still works inside the popover.

Checked on web at 1440 and 1024: the card opens at the button's right, top-aligned, with six tiles on a row; Hands, adding a bundled sticker, saving one of Yours (which also places it), the hover delete, Escape, and an outside click all work. At 390 the phone's sheet is unchanged. iPad touch and long-press delete are still to check.

Commit: `feat: open stickers beside the rail on wide windows`

### 4. Crop's options in a context bar

* `CropTool` takes `wide`, from `EditorScreen`'s layout.
* Wide, its `ScreenHeader` gets `bar={<ContextBar title="Crop" onCancel={onCancel} onDone={controller.done} doneShortcut="Enter">…</ContextBar>}`, with Reset as the header's action when `controller.changed`. The bar's groups follow the table above:
  * the modes as `OptionSegments` (Crop, Rotate, Fill, with the dock's icons);
  * Crop: an `AspectChip`, a `BarChip` whose popover holds the three groups of ratios as highlighted options;
  * Rotate: `BarButton`s for Rotate 90° and Flip, and Turn layers as a checked `BarButton` (only when there are other layers, as now);
  * Fill: a color chip opening `BackgroundPicker`.
* Wide, no `Dock` and no controls strip, but the dial's strip under the stage, showing the `Dial` in Rotate when `anchor.layer` exists.
* The phone's layout keeps its own components; share what both use (the aspect list, the actions' handlers) rather than branching inside each control.
* Keys: Enter and Escape apply, as now.

Check at 1440, 1280 × 720, and 1024: every mode, every ratio from the chip (including Original after a turn), dragging the dial while watching the photo, Turn layers on and off with a text layer, a background color, Reset, ✕ (nothing changed), ✓ (one undo step), and a canvas without a photo (no dial, no strip's content). Check Escape closes an open popover without applying the crop, then applies it on a second press.

Commit: `feat: put Crop's options in the wide editor's context bar`

### 5. Docs

* `context-bar-plan.md` line 33: Crop and Stickers now follow the wide layout (link this plan).
* DESIGN.md's Layout: from 1024 points, Crop's options sit in the header like a tool's, and stickers open beside the rail.
* AGENTS.md's wide-window learning: Crop and Stickers in the list of what the bar and rail hold; `Popover`'s `placement`.
* `npm run build --prefix docs/interactive`, in case a lesson quotes `CropTool` or `Popover`.

Commit: `docs: describe Crop and Stickers on wide windows`

## Not covered by the browser

* **iPad.** Touch on the bar's chips and the sticker popover, and the dial by finger, on the iPad Pro 13-inch simulator. If the development build won't launch, say so when handing over.

## Risks

* **Crop's header and the editor's.** Crop draws its own `ScreenHeader` over the editor's. The bar must match the editor's in height and insets (the 48-point fine-pointer header and the 56-point touch one), or the photo jumps as Crop opens. Compare screenshots of the header before and after opening Crop.
* **A popover over a modal.** Crop covers the editor; its chips' popovers must still sit above it. `Popover` portals to `document.body` on web and uses a `Modal` on native, so it should; check both.
* **The sticker grid's width.** It measures its own width to fit tiles; inside a popover that measures its content, the two could chase each other. Give the popover a fixed width.
