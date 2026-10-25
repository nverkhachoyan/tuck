# Polish and copy

A plan for the smaller findings of the October 2026 critique of the whole app (snapshot in `.impeccable/critique/`): one highlight at a time, matching layouts, project names, dead ends, and casing. It's the fourth of five plans from that critique, after `redaction-trust-plan.md`, `export-sheet-plan.md`, and `wide-crop-stickers-plan.md`. Gray labels and button names are in the export plan, since `Segmented` and `Button` change there. Each step here is small and stands alone, so they can go in any order.

## What happens today

* **Two highlights in the wide editor.** With a tool open, the rail's tool and the bar's mode both get the highlighter (Redact and Box, Draw and Brush). DESIGN.md says only one thing is highlighted at a time, and that a tool whose tray is open is marked by its bold label alone.
* **Redact's tools change order between layouts.** The phone's dock shows Box, Brush, Find, Eraser (`RedactPanel.tsx`); the wide bar shows Box, Brush, Eraser, then Find as a button of its own.
* **An empty band over Adjust in the inspector.** `AdjustInspector`'s section has 48 points of top padding, held for the large value that floats above the phone's dock while the dial moves. In the inspector the dial already shows its value, so the band stays empty, and the tabs sit low under it.
* **The wide home has two alignments.** The wordmark and the project prints line up on the column's left edge, while the start buttons (Open a photo, Paste, Blank canvas) are centered between them.
* **Every project without text is "Untitled".** `projectLabel` lists a project by its top text and falls back to "Untitled", so a home of redacted screenshots is a column of identical names, told apart only by their dates.
* **"Already open in another tab" is a dead end.** Opening a project that another tab holds shows "Couldn't open project" with only Try Again, in the editor (`EditorScreen.tsx`) and as an alert from home. Try Again fails the same way until the other tab lets go.
* **Mixed casing.** Most of the app is sentence case ("Blank canvas", "Add photo", "Free resize", "Cut out"), but some labels are title case: "Try Again" (four places), "Back to Projects", "New Canvas", "To Front", "To Back", "Open Settings", "Retry Save", "Copy Details", "Email Support", "Not Found".
* **DESIGN.md is silent on two things the app does.** The drawing swatches (`#FF3B30`, `#FFD60A`, `#34C759`, `#0A84FF`, `#BF5AF2`) aren't listed, so the detector flags them as stray colors. Cut out's red and green preview tints the photo, which the Off-Limits Photo rule doesn't allow for, though it's the right call while choosing what to keep.

## Decisions

* **The rail marks the open tool with its bold label.** The highlighter belongs to the bar's mode. The rail's tool keeps `accessibilityState.selected`, so a screen reader still hears which tool is open. On the phone, nothing changes: the dock shows either the tools or the open tool's modes, never both.
* **Redact's order is Box, Brush, Eraser, Find, everywhere.** The phone follows the bar: the three ways to draw a redaction, then Find.
* **The inspector's Adjust section leads with its value.** A heading row in place of the band: the chosen adjustment's name and its value in the Figure style ("Brightness +12"), as "Layers" heads the list below. The floating value stays on the phone only.
* **The wide home has one left edge.** The start buttons line up with the wordmark and the prints. The links at the foot stay centered, as a footer.
* **A project without text is named by what it holds and when.** "Photo · Oct 24, 3:15 PM", "Screenshot · …" isn't knowable reliably, so it's "Photo" when the bottom layer is a photo and "Canvas" otherwise, with the time the project was made. A name the user gave, and a project's text, still come first. Home already shows the last-changed date under the name; keep both, since one is when it was made and the other when it changed.
* **The lock error says what to do, and offers a way out.** "This project is open in another tab. Close it there, then try again." Home's alert adds "Open a copy", which copies the last saved version into a new project and opens that. The editor's error screen adds "Back to projects" beside Try Again.
* **Sentence case everywhere, alert buttons included.** It's the app's voice, and `showAlert` serves iOS, Android, and web alike. Apple's guidelines title-case alert buttons, so iOS alerts will read slightly unlike other apps', which is the trade.
* **DESIGN.md names the drawing swatches and the Cut out exception.** The swatches are document content, like caption fonts: listed, and excluded from the One Marker Rule's "nothing else is yellow". Cut out's preview tint is the one sanctioned tint over the photo, shown only while choosing and never exported.

Considered and left as is:

* **Draw's Size chip.** The critique said it shows no value. Its glyph is the current size's dot, which was the refinement plan's decision; that is the value.
* **Escape means Done, Find's "Both", and Share's done state.** The first two were settled on October 4; Share's is explained in `export-sheet-plan.md`.

## Steps

Each step passes `npm run check` and `npm run typecheck` (and `npm test` where it touches pure modules), and ends with a commit message handed over. Check on web at 390 and 1440 points wide, by day and at night, unless the step says otherwise.

### 1. One highlight in the wide editor

* `ToolButton`: a `marked` look for the rail, the bold label of `open` without the highlighter, with `accessibilityState.selected` (not `expanded`).
* `ToolsPanel`: the rail (`vertical`) passes the mark that way; the dock keeps `selected`.
* DESIGN.md's Tools: the rail's mark.

Check every tool at 1440 and 1024 (Text, Draw, Redact with Find, Sticker, Crop, Adjust, Cut out), and that the dock on a phone is unchanged.

Checked on web, by night and by day. At 1440 and 1024 the open tool's rail label is bold and selected, with no highlighter, and the bar's mode keeps the one swipe (Brush, Align, Box, the sticker tab, Crop, Brightness, Pick). Find leaves Redact marked. At 390 the dock still highlights its mode, and the idle tools have none. Crop and Stickers had to be passed as the open tool, or the rail never marked them. React Native Web ignores `accessibilityState.selected`, so the button also sets `aria-selected`.

Commit: `fix: mark the rail's open tool by its label, not a highlight`

### 2. Redact's tools in one order

* `RedactPanel.tsx`: Box, Brush, Eraser, Find in the dock.

Check the phone dock, and that F still opens Find.

Commit: `fix: order Redact's tools the same on every layout`

### 3. Adjust's value heading the inspector

* `AdjustInspector`: the section loses its 48-point padding and gains a heading row (name in Label Strong, value in Figure with tabular numerals), live as the dial moves; the section's height follows its content.
* `AdjustPanel` takes a prop to leave out its floating value in the inspector.

Check at 1440 and 1280 × 720 while dragging the dial and pressing its keys, and that the phone's floating value is unchanged.

Commit: `fix: head the inspector's Adjust with its value`

### 4. One left edge on the wide home

* `HomeScreen.tsx`: from 1024 wide, the start row aligns to the column's start, under the wordmark. The empty home, where the start buttons sit with the wordmark, already aligns; check it stays so.

Check at 1440 and 1024 with projects and without, and the phone.

Commit: `fix: line up home's start buttons with the projects`

### 5. Names for projects without text

* `projectLabel` in `projects/projectFile.ts` takes the project's `createdAt` and falls back to "Photo · {date}" or "Canvas · {date}". The date is absolute ("Oct 24, 3:15 PM"), from a small formatter in `lib/` with the locale's `toLocaleString` options. Not home's `formatDate` (`ProjectList.tsx`), which says "Today, 3:08 PM": relative, it would repeat the line under it and go stale. Every caller passes `createdAt`.
* `copyName` keeps working on the label, so a copy of "Photo · Oct 24, 3:15 PM" is "Photo · Oct 24, 3:15 PM copy".
* `__tests__/projectFile.test.ts`: the fallback for a photo, a blank canvas, a project with hidden text, and one with a name.
* The wide editor's header title (`projectTitle` in `EditorScreen.tsx`) uses the same label, so it needs the open project's `createdAt`: keep it beside the name `openProjectName` reads, if the store doesn't hold it already.

Check home with several projects of each kind, rename one, clear its name (it goes back to the label), and duplicate one.

Commit: `feat: name projects without text by what they hold and when`

### 6. A way out of "open in another tab"

* `projectLifecycle.ts`: the error's message, as above, and an error type (or code) the screens can recognize instead of matching text.
* `projectLifecycle.ts`: `copyOpenProject(id)`, which reads the last saved file without claiming the project (another tab holds it) and writes a copy under a new claim, like `duplicateProject` does. Test it in `projects/__tests__/projectLifecycle.test.ts`, with the storage stand-in its other tests use, including a read that races a write (the copy must be a whole saved file, old or new, never a mix).
* `useHomeProjects`: the alert for that error offers "Open a copy" and Cancel.
* `EditorScreen`'s error screen: "Back to projects" beside Try Again.

Check in two browser tabs: open a project in one, open it from home in the other, choose Open a copy, and check the copy opens with the last saved edits while the first tab keeps working.

Commit: `feat: offer a copy of a project that's open in another tab`

### 7. Sentence case

* Every label in the list above, in `src/`. Proper nouns stay ("About Tuck", "Open Tuck").
* Search for title case in labels once more after the change (`grep -rnoE '"[A-Z][a-z]+ [A-Z][a-z]+'` and the same with lowercase joiners, such as "Back to Projects"), skipping credits and license texts.

Check each changed label on screen.

Commit: `fix: use sentence case for every label`

### 8. DESIGN.md

* Colors: the drawing swatches as document content, and the One Marker Rule's note that a yellow stroke or swatch is content, not chrome.
* The Off-Limits Photo Rule: Cut out's preview as its one exception.
* Run `impeccable detect --json src` again: the swatch advisories should be gone.

Commit: `docs: name the drawing swatches and Cut out's preview in DESIGN.md`

## Risks

* **Names with dates in more languages.** The app is English only today; the date follows the device's locale through `toLocaleString`, as home's dates do, so it should read naturally anywhere.
* **Reading another tab's project.** Step 6 reads a file another tab may be writing. Storage writes the project file whole (a single put on web, a write and rename on native, to check), so a read gets one version or the other. If a platform can't promise that, retry once on a file that fails to parse.
