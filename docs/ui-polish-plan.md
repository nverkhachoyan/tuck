# UI polish plan

An audit of every screen, done on 2026-09-27, and the changes agreed from it. With the promised features in place, the work now is making Tuck feel clean, modern, and quick: a Swiss army knife for photos and screenshots, where every tool is obvious and every edit takes seconds.

The audit ran the web build at iPhone width (390 × 844) and at desktop width. The foundations are sound and stay: the neutral grays with one warm accent (`theme.ts`), the frosted dock, the welcome screen, and the New Canvas and Export screens. What's wrong is mostly inconsistency between tools, controls without names, and two layout bugs.

## How to work through it

* One step at a time, in the order below. After each step, verify it, stop, and hand over a Conventional Commits message. The user reviews and commits each step themselves; don't run `git commit`.
* Steps marked **Propose first** have a direction but not a settled layout. Before building one, show the user a screenshot or a quick mockup and describe it in a few sentences, then wait for their OK.
* Verify at phone width (390 × 844) and desktop width on web, and on the iOS simulator for anything touching gestures, safe areas, the keyboard, or native modules. Run the checks from AGENTS.md: `npm run check`, `npm run typecheck`, `npm test` for pure modules, and `npm run build:web` after changing platform files.
* When a step changes a behavior the code documents, update that documentation: component comments, AGENTS.md learnings, and VISION.md's status.

## Decisions already made

* **Every tool finishes with Done at the top right.** This reverses the earlier choice of putting a tool's way out at the ends of the dock (`d1dc3a9`, `7f2ee0f`). It gives one rule everywhere: the top right holds the next step, which is Export in the editor and Done inside a tool. It also frees a slot in the dock. Text editing already works this way.
* The user approved every item below, including the clipboard features and the new `expo-clipboard` dependency they need.

## Step 1 — Fix what's broken (done)

### 1a. The Find card crushes its text on a phone

`src/features/editor/redact/DetectionOptions.tsx`. The card's content is a row: the text column (`styles.copy`, `flexShrink: 1`) beside the buttons, which can't shrink. At 390 points the Faces, Text, and Close buttons take nearly the whole width, and with no `minWidth` the text column shrinks to about one letter. "Find to redact" wraps as "Find / to / redac / t", and the description runs one word per line.

Fix it for every state the card shows (choosing, working, found, empty, failed), not just the first: when the card is narrow, stack the text above the buttons, with the text at full width and the buttons in a row under it. Measure the card itself (`onLayout`) rather than the window, because the layers sidebar can narrow the canvas on web. Step 5 reworks this card's content, so keep the fix in the card's container, where it will survive.

### 1b. Projects lose their thumbnails when a session ends without Back

The editor renders a project's thumbnail only in `closeProject` (`src/projects/projectLifecycle.ts`), which runs when the user leaves with Back. Reloading the page, closing the tab, or the OS killing the app leaves a project with no thumbnail, or with one from before its latest edits. Home then shows a generic image icon on the card until the project is opened and closed again. `refreshThumbnail` can't help, because it only works on open projects.

When home lists projects, bring each missing or stale thumbnail up to date. A thumbnail is stale when its `updatedAt` differs from the project's. Render with the `renderThumbnail` home already hands to `closeProject` (from `render/`). Render them one at a time after the list has appeared, updating each card as its thumbnail lands, and write through the same per-project queue the lifecycle uses. Skip a project that is open in the editor. A failure only logs, as `refreshThumbnail`'s does. Add tests to `projectLifecycle.test.ts`.

## Step 2 — One way to finish every tool (done)

Today there are three ways to finish:

* **Text (typing):** Done at the top right, over the screen's header (`text/TextEditor.tsx`).
* **Draw, Redact, and Adjust:** a ‹ at the dock's left end (`DockButton` in `Dock.tsx`, wired in `EditorScreen.tsx` as `finishTool`). Meanwhile "‹ Projects" stays in the header, so two back arrows are on screen, and the top one leaves the editor.
* **Crop:** ✕ at the dock's left end and ✓ at its right (`crop/CropTool.tsx`), with an empty bar where the header was.

Change them all to one pattern:

* While Draw, Redact, or Adjust is open, the header is the tool's header. It shows the tool's name as its title and hides "‹ Projects". (Built with the title at the left, in Back's place: centered, it ran into undo, redo, and Done at 390 points.) At the right it keeps undo and redo, then a primary **Done** button, styled like the text editor's (`Button` with `variant="primary"` and `size="small"`). Adjust keeps its Reset button, placed before undo.
* Crop's header shows **Cancel** at the left, "Crop" as the title, and **Done** at the right. Crop has no undo of its own, so its header has none.
* Remove the dock's back button and Crop's ✕ and ✓. If nothing else uses `DockButton` or the dock's `start` and `end` slots afterwards, delete them.
* Keep every keyboard shortcut: Escape finishes Draw, Redact, and Adjust. In Crop, Escape cancels and Enter applies. Show them in the Done and Cancel tooltips on web, as the dock buttons do now.
* The header keeps `HEADER_HEIGHT` in every state, so the canvas never moves as tools open and close.
* The text editor's header is dealt with in step 3, along with the rest of text.

A tool header could be a variant of `ScreenHeader` (a title, optional start and end content, and no back button) rather than a new component. Choose whichever reads better.

## Step 3 — Text (Propose first) (done)

Built as the alternative below: a floating selection bar (`panels/SelectionBar.tsx`) with Edit (text), Stretch (text and images), Arrange, Duplicate, and Delete for every layer type, placed by `canvas/selectionBarPlacement.ts` and hidden while a gesture moves the layer. The dock keeps what only one kind of layer does: the style panel for text (Font, Color, Outline, Box, and Align tabs across the width), and Draw, Redact, Adjust, or Sticker for the rest. Typing shows "Text" and Done in the header. Arrange (step 6) came with it.


Four problems, all in `text/TextStylePanel.tsx` and `text/TextEditor.tsx`:

* While typing, the alignment button sits at the header's top left and looks like a hamburger menu (≡). It's the text's alignment, drawn as three bars (`AlignIcon`).
* The selected text's actions (Edit, Stretch, Duplicate, Delete) are icons without labels, while the other layer panels (`panels/LayerActionsPanel.tsx`) label every action. Stretch's icon (`resize-outline`) reads as "full screen".
* At 390 points the Box tab and the Typewriter font are off-screen. Their rows scroll sideways with no hint that they can.
* The dock has a fixed height (`DOCK_HEIGHT` = 104 in `Dock.tsx`), shared by every panel so the canvas never shifts. It fits two rows: the tabs and actions, then the choices.

Recommended direction, to propose:

* Typing: the header follows step 2's pattern: the title "Text" and Done at the right, with nothing at the left. Alignment moves into the style panel.
* The style panel's first row is a full-width segmented control with Font, Color, Outline, Box, and Align, which fits without scrolling at 390 points. Align's content row holds Left, Center, and Right, drawn with proper alignment icons (`format-align-left` and so on in MaterialCommunityIcons). The fonts row still scrolls, but it should look like it can: let a font chip run past the edge, or fade the edge.
* A selected text that isn't being typed shows labeled tiles like every other layer: Edit, Style, Stretch, Duplicate, and Delete (Arrange too, from step 6). Style opens the style panel in the dock as a small mode with the "Text" header and Done. Tapping the text still edits it, and typing still shows the style panel directly, so a new meme's text is styled without an extra tap.

An alternative to show alongside: keep the style panel in the dock whenever text is selected, and move Duplicate, Delete, Stretch, and Arrange for every layer type into a small labeled bar that floats by the selection. It's more modern, but much more work with the Skia canvas and its gestures.

## Step 4 — Draw: Brush, Shape, Eraser, Style

Today the dock shows Pen, Marker, Neon, Shape, and Eraser (`draw/DrawPanel.tsx`). Color and size open only when the tool in use is tapped a second time, which a small colored dot on its tile is meant to hint at. Redact, by contrast, has a visible Style button. Make Draw match Redact:

* **Brush** shows the brush type in use (pen, marker, or neon) as its icon.
* **Shape** stays as it is, showing the shape it will drag out.
* **Eraser** stays as it is.
* **Style**'s tile shows the current color as a swatch, as Redact's Style tile does. It opens the options card (`BrushOptions`), which gains a labeled row for the brush type (Pen, Marker, Neon) while Brush is in use. The card keeps the shape row for Shape and the color and size rows it already has; the eraser gets size only.
* Tapping the tool in use can still open the card, but it's no longer the only way.

`draw/brushSettings.ts` is a saved preference. Keep reading what older builds wrote: `tool` can still be "pen", "marker", or "neon". Add whatever field remembers the last brush type, so that Brush → Shape → Brush returns to the neon pen, and give it a parser default. Cover it in `brushSettings.test.ts`.

## Step 5 — Redact

* **Label the effects.** The Style card's Effect row (`redact/RedactPanel.tsx`) shows three icons with no names. Give them visible captions: Solid, Blur, and Pixelate. Check that the captions still leave room for the color row on a phone.
* **One tap finds everything.** Today Find asks "Faces or Text?" first. Instead, Find looks for faces and text together, using whichever detectors this device has, and shows every region it finds, all selected (`useImageDetection` already preselects). The card says how many it found and how many are selected, offers All and None, and has a primary "Redact 5" (today it says "Add 5"). Run the two detectors one after the other, not at once, because on web MediaPipe and Tesseract are both heavy. If one detector fails or isn't available, still show what the other found, and mention it in one line. If both find nothing, show "Nothing found" with Try Again. This changes `detection/useImageDetection.ts`'s state from one `feature` to both; regions could carry their kind, if faces and text should be outlined differently. Keep detection's rule from VISION.md: it proposes redactions and never applies them by itself.
* Out of scope: on web, Tesseract missed white text on a gradient in the test image (`modules/image-analysis/src/tesseractText.ts`). That's detection quality, a separate task.

## Step 6 — Arrange (Propose first) (done in step 3)

Arrange lives in the selection bar: it swaps the bar's actions for To Front, Forward, Backward, and To Back, each disabled when it can't apply, until Back.


Forward and Backward take two of the five to seven tiles in `LayerActionsPanel` for every selected layer. For a quick tool, layer order is occasional. Fold them into one **Arrange** tile that opens a small card with Bring to Front, Forward, Backward, and Send to Back, each disabled when it can't apply. The ⌘] and ⌘[ shortcuts stay. Make this match whatever step 3 settles for text: if the floating bar was chosen there, Arrange lives in it.

## Step 7 — Clipboard (done)

Built Copy on Export (PNG clipboard images on web and native) and native Home Paste through the normal JPEG import pipeline. Export now keeps Save primary with Share and Copy paired below on phone; Home shows Paste beside Choose Photo whenever the native clipboard holds an image.

These are small features that complete the quick screenshot loop: copy a screenshot, paste it into Tuck, redact it, copy it out, and paste it into a chat.

* Add `expo-clipboard` with `npx expo install expo-clipboard`, then run `npm run format` (AGENTS.md explains why). It's a native module, so rebuild the development build: `npx expo prebuild --clean`, then `npx expo run:ios` and `npx expo run:android`. Use `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for iOS.
* **Copy on export** (`features/export/ExportScreen.tsx`, next to Save and Share): copies the rendered image, then confirms with "Copied", as Save does with its saved state.
  * On web, use `navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })])`. Create the `ClipboardItem` synchronously inside the click handler and give it a promise: Safari refuses otherwise. Browsers only take `image/png` reliably, so copy PNG even when the export is JPEG.
  * On native, call `Clipboard.setImageAsync` with base64 PNG.
  * On a phone the buttons are stacked full-width, so lay them out as Save (primary) over Share and Copy side by side.
* **Paste on the native home screen**: when the clipboard holds an image, show a Paste action beside Choose Photo. Web already opens a pasted image. `Clipboard.hasImageAsync()` doesn't trigger iOS's paste prompt, but `getImageAsync()` does, and only on the user's tap. Check again whenever home comes into focus or the app returns to the foreground. Write the pasted image to a cache file and send it through the same import as a picked photo, which re-encodes to JPEG (AGENTS.md explains why Skia needs this).

## Later, not in this plan

* First-use hints for gestures that are hard to discover, such as pinching to resize and tapping selected text to edit it.
* Offering detected regions as soon as Redact opens on a photo.
* Web text detection quality (see step 5).

## Testing tips

* Web: start the `web` server from `.claude/launch.json`. If the Browser pane is hidden, drive headless Chrome over CDP instead (see the memory notes). To open the editor without the file picker, paste a generated image: draw it on an `OffscreenCanvas`, wrap it in a `File` and a `DataTransfer`, and dispatch `new ClipboardEvent("paste", { clipboardData })` on `window`. Don't use photos from the user's folders: they include personal documents.
* iOS: the app runs in the development build, not Expo Go. AGENTS.md has the commands and the simulator tool's quirks: lost taps, stale screenshots, and text that lands late.
* Watch these AGENTS.md learnings, which bite in this kind of work:
  * Reanimated drops `pointerEvents: "box-none"` on web.
  * RNW's `Pressable` fires on clicks that bubble up from its children.
  * Each screen pads its own bottom safe area.
  * `flex: 0` behaves differently on web.
  * Hermes has no `toSorted`.
  * Buttons need real `hitSlop`.
