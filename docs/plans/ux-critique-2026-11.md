# UX critique, November 2026

Written November 11, 2026, at `9e0470a`. A week of ordinary use compressed into one pass: five jobs a developer or designer brings to Tuck, done on a phone-sized window and on a 1440-point window with keyboard and mouse. It follows the whole-app critique of October 24 and covers what landed since (drawing layers, marks, the Stroke eraser, flyouts, the context bar). Nothing here is fixed yet. Remove this file once its findings are built or filed, as with other plans.

## What was run

- **Web, 390 points wide** (the dev server in the browser pane, 390 × 760): marking up a bug screenshot and redacting a chat screenshot in the night palette; a meme caption and a cut-out in the day palette; Pen and the Eraser's flyout in passing.
- **Web, 1440 × 900, mouse-sized controls**: the bug markup by keyboard in the day palette; Find on the chat screenshot and Remove BG by its key in the night palette.
- **iOS simulator** (iPhone 17 Pro, the development build): opening the chat screenshot from the picker and running Find's Text on it.
- **Images**: the store listing's `settings.jpg`, `chat.jpg`, and `scene.jpg` (1179 × 2556 and 1080 × 1350), and a macOS system photo of a parrot scaled to 1536 × 1536.

Not run, so nothing below speaks for them: Android; Find's Faces; the meme and the full redaction at 1440; markup, meme, and cut-out on the simulator; a real phone; a real clipboard (the browser pane denies clipboard writes). The meme's second caption was counted from the first one's steps, not typed. Download was not pressed; what an export contains was read from the export sheet's preview and from the code.

## Scores

A step is one tap, drag, key chord, or run of typing, counted from home to the image leaving the app. Discoverability and trust are out of 5.

| Flow | Phone steps | Desktop steps | Discoverable | Trust the export | In short |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Mark up a bug screenshot (box, arrow, label, copy) | 14, or 13 and a ruined box | 13 | 4 | 4 | Every tool is in sight. The second shape reshapes the first unless you tap away (finding 2), and each change of tool costs a ✓ or Esc. |
| Redact a chat screenshot (name, address, code, phone, a second name) | 16 at best on web; it took 23. 13 on iOS | 15 | 3 | 3 | Find's taps land on the wrong line (1), the web misses white-on-dark text (3), and a missed name means leaving Find for Redact. Solid boxes are real pixels in the file. |
| Meme with two captions | 13 | 11 | 4 | 5 | Type, ✓, drag. The caption style is right the first time. The second caption needs Deselect first on a phone (11). |
| Cut out a subject | 7 through Cut, 6 through the flyout | 4 (⌘V, G, ⌘E, a click) | 3 on a phone, 4 on desktop | 4 | The fastest flow in the app. Cut's words take a moment (10), and Remove BG can't be seen on a phone until a long-press. |

What already works and should stay as it is: paste straight into the editor; projects named from their caption; the toasts with Undo ("5 text regions redacted · Undo", "Background removed · Refine · Undo"); Find's honest "Detection can miss some"; PNG chosen by itself for a cut-out, with "Fills transparency black" under JPEG; G on desktop.

## Findings, ranked

Ranked by how much each costs the flows above, with the redaction ones first, since a miss there harms someone. Sizes: S is an afternoon, M a few days, L a plan of its own. None is L.

### 1. In Find, a tap on one line of text toggles the line beside it (S)

- **Where:** `regionAt` in `src/editor/canvas/hitTest.ts:86`, called from `src/editor/canvas/useRegionTap.ts:46` with 10 screen pixels of padding.
- **Seen:** on the chat screenshot at fit zoom, tapping the middle of "48 Linden Street, Apt 4B" toggled "Riverside, CA 92501" under it. Tapping "Gate code is 4471…" toggled the address line above. Choosing five regions took twelve taps, knowing the rule. The same tap did the same on the iOS simulator.
- **Why:** every region is padded so small ones stay tappable, and where padded regions overlap the smallest wins, even when the tap is squarely inside a larger one. Lines of text on a fitted phone screenshot are about 10 points tall and stacked, so each sits inside its neighbours' padding. One of two equal lines can only be chosen by tapping outside it.
- **Cost:** the redaction flow's taps and its trust. The wrong line changes state a few points from the finger, at a size where the difference is hard to see.
- **Direction:** a region that contains the point unpadded wins; padding only decides among regions the point is outside of, nearest first. Plain TypeScript with a Node test. Filed as [#120](https://github.com/nverkhachoyan/tuck/issues/120).

### 2. Choosing the next shape reshapes the one just drawn (S)

- **Where:** `change` in `src/editor/tools/shape/useShapeTool.ts:60`, with `shapePatch` in `shapeSettings.ts:97`. The hook's own comment says it "deselects when geometry changes (line vs box)"; it doesn't.
- **Seen:** drew a rectangle around a settings row, tapped Arrow for the next mark, and the rectangle became an arrow lying across the row. A shape stays selected after it's drawn, and the panel restyles the selection. At 390 the selection's handles hadn't shown yet, so nothing said the box was still held. By the same code a new color or size repaints the last shape too (not tried).
- **Cost:** a box and then an arrow is the commonest markup there is. Today it's undo, tap an empty spot, choose Arrow again: three extra steps, found by accident.
- **Direction:** while Shape is open from the toolbar, choosing another kind lets go of the selection and sets the kind for the next drag. Restyling stays for a shape selected with no tool open (`isStylingSelected`), where it's what the panel is for. Decide whether color and size follow the kind or keep restyling, as Redact's effect usefully does on the box just drawn.

### 3. On web, Find's Text misses white text on dark bubbles (M)

- **Where:** `modules/image-analysis/src/tesseractText.ts` (the web's text finder).
- **Seen:** on `chat.jpg` the web found 14 regions and missed "Perfect, see you at 7!", "Can I bring Sam?", and the first line of a two-line dark bubble. Apple Vision on the simulator found 17, those included. "Sam" is a name, and it stayed readable until a Redact box went over it by hand.
- **Cost:** dark bubbles are the sender's own messages in most chat apps, and dark-mode screenshots are all light on dark. The tray's warning is honest, but the fallback is ✓, Redact, drag, ✓.
- **Direction:** read the image a second time inverted (or per block, by its background) and merge the lines, and measure what it adds to the time a pass takes. Filed as [#121](https://github.com/nverkhachoyan/tuck/issues/121). Until it's good, this is the strongest reason to build "Find and Redact together" from follow-ups §4: a box drawn from Find's own tray.

### 4. A tool's key does nothing while another tool is open (S)

- **Where:** `shortcutCommand` in `src/editor/editorMode.ts:221`: in a tool, only Escape, Enter, the brackets, and Delete act.
- **Seen:** with Shape open at 1440, T did nothing, and the caption typed after it went nowhere. Clicking Text in the rail at the same moment switched tools at once. Pressing S again doesn't step to the next shape either, so no key reaches Arrow.
- **Cost:** a key between every pair of tools on desktop, and a silent failure for anyone coming from another editor, where a letter always switches.
- **Direction:** where the open tool's spec doesn't cancel (Pen, Shape, Eraser, Redact, Stickers), a tool key does what the rail click does. Crop, Cut, Find, and Adjust hold a draft, so they keep ignoring it. Then decide whether a tool's own key steps through its variants.

### 5. Copying the result has no keyboard path, and the export sheet starts with focus nowhere (S)

- **Where:** `src/screens/export/ExportScreen.tsx:91` (only Escape is handled).
- **Seen:** after ⌘E, focus is on the page body. The first Tab lands on the scrim ("Close export"), then Close, the two sizes, the two formats, Download, and Copy: eight Tabs and Enter to copy. Enter alone does nothing.
- **Cost:** the developer's loop is paste, mark, copy, paste into the issue. Its last step is the only one that needs the mouse.
- **Direction:** focus the main action when the sheet opens, so Enter downloads or saves. Give Copy a key in the sheet (⌘C) and list it in the shortcuts. A copy shortcut from the editor itself would save the sheet entirely; weigh it against copying without seeing the preview.

### 6. Find's Text starts with every line chosen, and only whole lines can be chosen (S for the default, M for words)

- **Where:** `src/editor/tools/find/useImageDetection.ts:98` (all chosen); `TextRegion` already carries `words` beside `line` (`modules/image-analysis/src/ImageAnalysis.types.ts:4`), which Find doesn't use.
- **Seen:** 14 of 14 chosen, the clock and the battery among them, so the first step is always None. To hide "4471" the whole line "Gate code is 4471. Call me if it" goes, and the sentence with it.
- **Cost:** a step on every text redaction, and screenshots that lose more than they need to, which pushes people back to drawing boxes.
- **Direction:** start Text with nothing chosen and keep Faces as it is (a face found is nearly always wanted). Then try word boxes once zoomed in, or a second tap that narrows a chosen line to the word under it. PRODUCT.md already says detection proposes and the user picks.

### 7. A failed copy shows the browser's own error (S)

- **Where:** `runAction("copying", "Copy failed", …)` in `src/screens/export/ExportScreen.tsx:286`; `copyImage.web.ts`.
- **Seen:** "Copy failed. Failed to execute 'write' on 'Clipboard': Write permission denied." The browser pane refuses clipboard writes, so this says nothing about how often a real browser does; the wording is what a person would get when one does.
- **Direction:** say what happened and what to do, in Tuck's voice ("Couldn't copy the image. Download it instead."), and keep the raw message for the console.

### 8. The selection bar sits on the photo, beside the thing being marked (M)

- **Where:** `src/editor/chrome/LayerSelectionBar.tsx`, placed from `src/editor/Editor.tsx:431`.
- **Seen:** after ✓ on a caption the bar (Edit, Free resize, Arrange, Duplicate, Delete) opened over the row the box and arrow point at. Dragging the caption away moved the bar over the next row. At 1440 it still covers the screenshot, with the header's context bar holding only the text options and Deselect, and empty table on both sides.
- **Cost:** on a tall screenshot there's always content under it, and it appears just when you look to see whether the label sits right.
- **Direction:** on a wide window, put the layer's actions in the context bar with its style options. On a phone, prefer the side of the selection with less of the document under it, or the table when the photo doesn't fill the width (a tall screenshot leaves 70 points each side).

### 9. Find's title runs under its "Redact N chosen" button on a phone (S)

- **Where:** the dock's footer, `ModeActions` in `src/editor/shell/modeActions.tsx`.
- **Seen:** at 390 the footer reads "Fin" and then the pill. On the simulator at 402 the word touches the pill.
- **Direction:** drop the centered title when the done label is a phrase; the highlighted tab already says where you are.

### 10. Cut's words need a second read, and Remove BG is out of sight on a phone (S)

- **Where:** `CUT_TOOLS` and the mode pill in `src/editor/tools/cut/CutPanel.tsx:36` and `:48`; `removeBgSpec.ts` grouped under Cut.
- **Seen:** Cut opens on Tap with a pill reading "Adds / Subtracts" over a row holding "Add" and "Subtract", which are brushes. Nothing says what to do first, where Find opens with a line that does. The header's Undo is lit before anything has been done. Remove BG, one of the product's headline jobs, shows on a phone only after a long-press on Cut; the corner mark is small and gray.
- **Direction:** a first line in the tray, as Find has ("Tap what to cut out, or choose Subjects"). Name the brushes for what they are ("Brush +", "Brush −", or "Paint in", "Paint out"). Consider listing Remove BG among Cut's Actions so it's reachable from inside the tool.

### 11. On a phone, a second caption needs Deselect first (S)

- **Where:** `modeChrome` in `src/editor/chrome/editorChrome.ts`: a selected text layer's panel takes the dock.
- **Seen:** after ✓ the caption stays selected and the dock shows its style, so Text is gone until Deselect or a tap on empty canvas. A two-caption meme is 13 steps where 11 would do. On desktop T works with a caption selected.
- **Direction:** small either way. Either ✓ on a new caption leaves nothing selected (drag still picks it up), or the style panel gets an "Add text" beside Deselect. Try the first on a phone before choosing.

### 12. On a wide window, Find's card takes height from a tall screenshot while the sides are empty (M)

- **Where:** `ToolCard` in `src/editor/chrome/PanelViews.tsx`; `cardOpen` in `useEditorLayout`.
- **Seen:** at 1440 × 900 the chat screenshot shrank to about 295 points wide to clear the card, so a line of text is about 7 points tall, with 500 points of table on each side. That's where finding 1 bites hardest with a mouse.
- **Direction:** when the document is much taller than the stage is wide, dock the card beside the photo. The card was put with the photo on purpose (architecture.md, "Editor Layouts"), so it should stay next to it, not go back to the bar.

### 13. PNG says "Keeps transparency" when there's none to keep (S)

- **Where:** `src/screens/export/ExportScreen.tsx:158`.
- **Seen:** on an opaque screenshot the choice reads "JPEG, Smaller file" against "PNG, Keeps transparency".
- **Direction:** on an opaque canvas say what PNG is for there: "Sharper text".

### 14. Reloading a photo before editing it ends at "This project no longer exists" (S)

- **Where:** `closeProject` in `src/projects/openProjects.ts:504` (an unedited project isn't kept, on purpose); the message at `:69`; the screen in `src/screens/editor/EditorScreen.tsx:53`.
- **Seen:** on web, opened a photo, reloaded twenty seconds later with no edits, and got the message with a "Try again" that can't work.
- **Direction:** send a missing project home, or say "Nothing was changed, so this photo wasn't kept", without the retry.

## Noticed, not proposed

- **The export preview of a tall screenshot is about 68 points wide**, and a black box on a dark bubble can't be told from the bubble. Pinch to zoom there was considered and left (follow-ups, "Considered and left"), and the canvas behind the sheet shows the same picture, so this is only recorded.
- **Exports carry no location or camera data**: import re-encodes the photo and export encodes fresh pixels. The app never says so, while iOS's picker says "Location Is Included" as the photo is chosen. An export privacy check was declined on October 24; a line on the privacy page or the sheet would be a smaller thing, noted in case it's wanted.
- **Caption defaults are a meme's** (Anton, white, black outline, dead center), which is heavy for a label on a screenshot. Text remembers its settings, so it's one change, once.
- **Opening a tray refits the photo** on a phone: Redact's Style shrank the screenshot from 242 to 170 points wide. Wide windows hold the photo still for a card; the phone doesn't.
- **Tool keys aren't guessable** (B for Cut, D for Pen, E for Adjust, A for Sticker), but every tooltip shows its key.
- **The canvas took a few seconds to refit** after the window changed size (390 to 1440, and 844 to 760 tall). The pane was running slowly, so this isn't counted; follow-ups §1 already lists resizable iPad windows.

Already filed and not repeated: Highlighter's label breaking mid-word ([#118](https://github.com/nverkhachoyan/tuck/issues/118)), and deleting what a tool just drew on touch ([#102](https://github.com/nverkhachoyan/tuck/issues/102)).

## Checks left for a phone or a real browser

Filed together as [#122](https://github.com/nverkhachoyan/tuck/issues/122).

- Choosing neighbouring lines in Find with a finger at fit zoom on a tall screenshot, before and after finding 1's fix.
- Whether the selection bar gets in the way with a thumb, and where it lands on the smallest phone.
- Whether the flyout corner mark is noticed at all, and Remove BG found, by someone who hasn't been told.
- Find's footer at 375 points wide and at larger Dynamic Type sizes.
- An export of a photo taken with location on, read with `exiftool`, to confirm what the code says about metadata.
- Copy in Safari, Chrome, and Firefox on a real desktop, for when a write is refused.

## The five to do first

1. **Find's tap rule (finding 1).** It's the one place the app does something other than what the finger asked, in the flow where a mistake matters most, on every platform, and it's a few lines with a Node test.
2. **Shape's next kind (finding 2).** Box then arrow is the first thing a developer does with Tuck, and today the second tap destroys the first mark. It also makes the hook match its own comment.
3. **Tool keys while a tool is open (finding 4).** One rule in `shortcutCommand` removes a key between every pair of tools and the only silent failure the keyboard has.
4. **Copy by keyboard and a plain failure message (findings 5 and 7).** Together they finish the paste, mark, copy loop without the mouse, and they're both in `ExportScreen.tsx`.
5. **White-on-dark text on web (finding 3).** The largest of the five and the only M, but it's the difference between Find working on chat screenshots on web and half-working. If the second pass doesn't hold up, building Redact into Find's tray (follow-ups §4) is the fallback, and finding 6's default goes with either.

The first four are small, independent, and testable without a device. The fifth needs measuring before it's built.
