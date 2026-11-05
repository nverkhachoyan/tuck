# Recommendation

Keep one drawing per Draw session as a layer, and stop making the eraser
depend on layers. Most of the problem comes from one rule, "an eraser only
erases the selected drawing", not from drawings being layers. Ink that people
drew should erase the way it does in every markup tool they've used.

## In order

### Step 1: The eraser reaches all ink (idea 1)

Small, no saved-file change, and it fixes the complaint: open Eraser, erase
anything you drew. It also makes drawings follow the rule shapes already
follow. With it:

- The live swath is drawn into every drawing the eraser can change, so it shows wherever there's ink.
- Shapes about to be removed fade while dragging.
- Locking is how to keep a drawing from being erased.

### Step 2: Vector erasing, with two variants (idea 2)

Erasing changes the strokes instead of adding clear strokes on top. That
removes the leftovers step 1 can't: boxes shrink to the ink that's left,
taps stop hitting erased ink, emptied drawings go away, and saved projects
stop growing with every swipe. **Erase parts** and **Erase strokes** go in
the Eraser's flyout, like Pen's and Shape's variants.

Step 1's targeting and live swath carry over; only what happens when the
finger lifts changes. If step 2 is planned at once, step 1 can ship as its
first half.

### Step 3: Tell drawings apart, and merge them (idea 5)

Name and mark the Layers panel's rows by color and kind, which the follow-ups
already ask for, then add **Merge down** for drawings that blend the same
way. Small, and it answers "why are there five Drawing rows" without
changing how drawing works.

### Later: Selectable strokes, with the Select tool (idea 8)

When the Select tool is designed, let it select strokes across drawings, and
separate or merge them. That's the "major refactor" version: layers stop
being something to manage at all. Step 2's geometry is the base it needs.
Nothing in steps 1 to 3 blocks it.

### Not recommended

- **Real layer groups (idea 6)** don't change what an eraser reaches in any editor we looked at, and Tuck's layers have to draw straight onto the canvas, so groups could only organize, at the cost of a tree through every edit, gesture, and the saved format. If several things need to move together, that's multi-select, which belongs to Select.
- **One ink sheet (idea 7)** gets the eraser right by giving up stacking and moving marks apart. Step 1 gets it right without that.
- **Picking the drawing under the finger (idea 4)** still erases one drawing at a time.
- **Continuing the drawing on top (idea 3)** is cheap but only tidies the panel once erasing no longer depends on layers. Step 3 does that more predictably. Reconsider it if people still find too many rows.

## Open questions

These need a decision before step 1 is built.

1. **Does a selected drawing narrow the eraser?** Illustrator erases only what's selected, if anything is. That's useful for erasing one of two overlapping drawings, but it brings back the hidden state step 1 removes: someone who drew, didn't press Done, and switched to Eraser would erase only that drawing. Tuck's Pen keeps the drawing it made selected until Done. **Leaning no**, and lock is the way to protect a drawing. If this proves wrong, a selected drawing could narrow the eraser only when the Eraser was opened from that drawing's actions.
2. **Should ink hidden under a photo or sticker be erased?** The eraser can't tell what's visible without rendering. Erasing it is simplest and matches "erase anything I drew", but it can remove ink nobody can see. **Leaning yes**, since it's what the swath preview already implies (the clear draws in every drawing), and undo brings it back.
3. **Should erasing a whole stroke cross into shapes?** Today any eraser removes shapes whole. With **Erase parts**, it still would. That's consistent with now, and both variants should keep it.
4. **Does a highlighter-only eraser earn a place?** Goodnotes users ask for "erase the highlight, keep the ink". With vector erasing it's one condition. Hold until someone asks.

## What building it touches

For whoever builds step 1 or 2:

- `layers/drawing/drawingEdits.ts` (`drawStroke`), `layers/strokes.ts` (the crossing test, and step 2's cutting), `layers/shape/shapeGeometry.ts` (`erasesShape` shares the crossing test).
- `EditorScene.tsx` and `canvas/LiveStrokeOverlay.tsx` (which layers draw the live stroke), `canvas/useToolStroke.ts` (`targetId`), `canvas/canvasTool.ts` (`canAddTo`).
- `tools/eraser/` (variants for step 2: `eraserSettings.ts`, `eraserTool.ts`, `EraserPanel.tsx`).
- Tests: `layers/drawing/__tests__/drawingEdits.test.ts`, `layers/__tests__/strokes.test.ts`, and `store/__tests__/editorSlice.test.ts`'s `an eraser only erases the selected drawing`.
- docs/architecture.md's Highlighter paragraph ("an eraser joins either"), and the interactive Strokes lesson for step 2 (`docs/interactive/src/lessons/model/StrokesLesson.tsx`).
- To check by hand: an eraser across two drawings and a shape, a locked drawing, a highlighter under a pen drawing, a drawing under a sticker, undo after erasing a drawing away, and a project saved before the change, on web and the iOS simulator.
