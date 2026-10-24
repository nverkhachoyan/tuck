# Redaction trust

A plan for making redaction safe to rely on, written October 2026 after a critique of the whole app (26/40, snapshot in `.impeccable/critique/`). It's the first of five plans from that critique, and the one to build first. Redaction is the one edit where a miss can do real harm, and today Find says the job is done when it may not be.

## What happens today

Checked on web at 390, 1280, and 1440 points wide, on the 1927 Solvay group photo (29 faces).

* **Find sounds finished when it isn't.** It found 28 of the 29 faces, and the tray said "28 of 28 selected". The missed face, a bearded man in the back row, stayed uncovered.
* **✓ leaves Find and Redact.** `finishFinding` (`useToolLifecycle.ts`) redacts what was chosen, closes the tool, and deselects. Nothing asks the user to look again, and adding a box over the missed face means opening Redact again.
* **The check badges smother small faces on a phone.** `MARKER_PX = 8` in `canvas/SelectionOverlay.tsx` is a radius, so each badge is 16 screen pixels across. At phone zoom the faces are smaller than that, so the badges overlap one another and cover what they mark. Picking out one region by tapping is close to impossible. DESIGN.md says the badges are "8px across".
* **Regions can only be toggled with a pointer.** A keyboard or screen reader gets All and None, nothing in between.
* **"No faces found" points nowhere.** It says "Try another photo or scan again", when what the user needs is a box drawn by hand.
* **Bug: Cancel in Cut out keeps a remembered cut.** Open Cut out (the background comes off), Undo, open Cut out again, press ✕: the photo stays cut out. `startCutOut` calls `cut.start` in the same step that switches the mode. When `useCutOut` already has the photo's mask, its `find` calls `onMask` before its first `await`, so the mask lands before `useToolSession`'s effect calls `beginSession`. The session's starting document already holds the cut, and `cancelSession` puts it back the same. The first time, detection takes a while, so the session is open by the time the mask arrives. No other tool writes the document at the moment it opens: Text keeps its draft in the mode, and Draw and Redact only pick settings.
* **Small selected layers can drown in their handles.** With a mouse, `shownHandles` gives every layer all eight handles and the knob, whatever its size, so a selected face redaction at the fit is mostly handles. On touch, handles already hide below 44 points. A phone-sized capture showed the same pile-up, but it came from a headless browser that may have reported a fine pointer, so check that on a device before changing anything for touch.

## Decisions

* **Find's ✓ goes back to Redact, as its ✕ already does.** Find is one of Redact's tools, so both ways out land in Redact, with the sub-tool it last used (Box by default), ready to draw over anything that was missed. Redact's own ✓ then goes back to the tools as it does now. This reverses part of the October 4 decision that Find's Done goes back to the tools. It's one more press for someone who's sure, and the press comes at the moment they should be checking.
* **A toast says what was done, with Undo.** "28 faces redacted · Undo" (or "text", or "regions" for both), through the same note as "deleted · Undo". It goes after five seconds or at the next change, like the delete note.
* **The tray is honest about detection.** Its title counts what was found and what's chosen ("28 found", or "26 of 28 chosen" once some are left out), and its line says "Detection can miss some. Check the photo, then ✓ to redact." Find's "No faces found" says "Draw a box over anything you want hidden." and offers "Back to Redact", in place of the Try Again row, which stays for errors.
* **Badges size to their region.** The radius is a share of the region's shorter side on screen, from 4 up to today's 8 pixels. Below about 12 pixels across, a region shows no badge: its fill and outline (already thicker and blue when chosen) carry the state. The hit area stays the box plus its padding.
* **"Review" steps through what was found, one region at a time.** It's one control in the tray that serves the keyboard, screen readers, and small faces on a phone: `‹ 3 of 28 ›` with an Include switch. Each step zooms the canvas to that region, and the switch toggles it. On web, Tab reaches it like any control, the arrow keys step while it has focus, and Space toggles. A screen reader hears "Face 3 of 28, included". It replaces nothing: taps on the canvas, All, and None stay as they are.
* **With a mouse, small layers get fewer handles.** The same rule as touch, at the mouse's sizes: side handles only once the box is four handle-widths long between them, and the corners and knob only once it's two. A layer too small for any can still be moved by dragging it and scaled with the keyboard or the selection bar.
* **Cut out's session starts before its edit.** The cut is started from an effect that runs after `useToolSession`'s, so every change it makes, remembered or not, lands inside the session.

## Steps

Each step passes `npm run check` and `npm run typecheck` (and `npm test` where it touches pure modules), and ends with a commit message handed over. Check on web at 390 and 1440 points wide, by day and at night, and on the iOS simulator for steps that change the canvas or the tray. Use headless Chrome over CDP for anything timed against drawing (see AGENTS.md).

### 1. Cut out's Cancel takes back a remembered cut

* `startCutOut` in `useToolLifecycle.ts` only switches the mode, keeping the layer to cut in a ref.
* An effect in `useToolLifecycle`, keyed on the cut-out mode's `layerId`, calls `cut.start` with it. `EditorScreen` calls `useToolSession` before `useToolLifecycle`, so this effect runs after `beginSession`. Note the order in a comment on both hooks, since moving either call would bring the bug back.
* `useToolSession`'s doc comment says no tool writes the store from an effect. Change it to say which one does and why that's safe (it runs after the session's).

Check: Cut out, Undo, Cut out, ✕ leaves the photo whole; Cut out, Undo, Cut out, ✓ keeps the cut as one undo step; the first open still cuts out as before; switching from Draw to Cut out on a wide window keeps Draw's strokes as their own step.

Commit: `fix: start Cut out's undo step before a remembered cut lands`

### 2. Find's words

* `FindPanel.tsx`: the title and line above, for the tray and the inspector. The screen reader's announcement follows the title.
* "No faces found" (and "No text found", "No faces or text found") says "Draw a box over anything you want hidden." with a "Back to Redact" button that does what ✕ does. "Try Again" stays for a scan that failed.
* ✓'s label for screen readers (`findDoneLabel` in `EditorScreen.tsx`, "Redact 28 selected" today) reads "Redact 26 chosen", to match.

Check every state in the tray and the inspector: idle, working, found with all and with some chosen, nothing in the visible crop, nothing found, and an error.

Commit: `fix: say that Find can miss faces and text`

### 3. ✓ goes back to Redact, with a note

* `finishFinding` redacts what was chosen, then goes back to Redact the way `backToRedacting` does, and keeps nothing selected.
* `useDeleteNotice` becomes `useEditNotice` (same file, renamed): it keeps `deleted`, and gains `redacted(count, feature)`, shown with Undo on the same terms. Undo takes back the group of boxes, which was committed as Find's step when the tool changed.
* The doc comments that say Find's Done goes back to the tools (`useToolLifecycle.ts` above `backToRedacting`).

Check: ✓ in Find lands in Redact with its last sub-tool and the toast; drawing a box then takes the toast away; Undo in the toast removes the boxes and leaves Redact open; Redact's ✓ then goes back to the tools. On a wide window, check that Find's inspector section closes and the layers show the new group.

Commit: `feat: go back to Redact after Find, with a note and Undo`

### 4. Badges that fit their region

* `DetectionOutline` in `canvas/SelectionOverlay.tsx`: the radius comes from the region's shorter side on screen (`min(width, height) × viewScale`), clamped to 4–8 pixels, and the badge is left out below 12. It's a derived value already, so zooming updates it.
* DESIGN.md's Selection Over the Photo: the badge's size rule, in place of "8px across".

Check on the Solvay photo at the fit on a phone (390 wide) and zoomed in, on web and the iOS simulator, that chosen and left-out regions read apart with and without badges, and that taps still toggle the region under them.

Commit: `fix: size Find's check marks to the regions they mark`

### 5. Review, one region at a time

* `useCanvasZoom` gains `zoomToArea(rect)`: the viewport that fits a document rectangle, with some margin, eased like any other viewport change (`viewport.ts` has the math; test the new function in `canvas/__tests__/viewport.test.ts`).
* `FindBody` shows a Review row once something is found: previous, "3 of 28", next, and an Include switch. Stepping zooms to the region; leaving Review, or finishing, zooms back to the fit.
* On web, the row takes the arrow keys and Space while focused, without reaching the editor's shortcuts. `Announcement` reads "Face 3 of 28, included" on each step.
* The order is reading order: top to bottom, then left to right, by each region's center, so a row of faces steps across.

Check with the keyboard alone on web: Tab to Review, step through, leave one out, ✓; then the same with VoiceOver on the iOS simulator. Check that a tap on the canvas while reviewing still toggles, and moves Review to that region.

Commit: `feat: review Find's results one at a time`

### 6. Fewer handles on small layers with a mouse

* `shownHandles` in `canvas/handleMetrics.ts` applies its size rule to a fine pointer too, with the mouse's handle size. It's a worklet, and `handleUnder` already shares it, so the cursor and the gesture follow. Its doc comment changes to match.
* First, check on the iOS simulator whether a small selected layer shows handles on touch. If it does, the rule isn't doing what it says, and that's a separate fix to make here.

Check at 1440 with a small redaction at the fit and zoomed in, by mouse: handles appear as it grows, and dragging still moves it. Run `npm test` for the canvas tests.

Commit: `fix: show fewer handles on small layers with a mouse`

## Not covered by the browser

* **Detection on native.** Vision and ML Kit find different faces than MediaPipe. Run Find on the Solvay photo on the iOS simulator and an Android emulator after step 2, and check that the words fit what they find.
* **VoiceOver and TalkBack.** Step 5 is checked with VoiceOver on the simulator; TalkBack waits for an Android device.

## Risks

* **Two ✓ presses to finish.** Someone who's sure now presses ✓ in Find and again in Redact. If that grates in use, a long press or ⌘↩ on ✓ could finish both, but don't add that until it's missed.
* **Effect order is load-bearing.** Step 1 depends on `useToolSession` running first. A comment on each hook says so; a test can't, since tests don't render React.
* **Zooming while reviewing.** Review moves the view on its own. With Reduce Motion it should jump, not ease. `shownViewport.ts` eases every change today, whatever the setting, so step 5 adds the check there, which covers the other eased changes too (a tray opening, the keyboard rising).
