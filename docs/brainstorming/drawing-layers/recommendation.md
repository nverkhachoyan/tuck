# Recommendation

Keep one drawing per Pen session as a layer, and stop making the eraser
depend on layers. Most of the problem comes from one rule, "an eraser only
erases the selected drawing", not from drawings being layers. Ink people
drew should erase the way it does in the markup and note apps they've used.

## In order

### Step 1: The eraser reaches all ink, honestly (ideas 1 and 2)

Open Eraser and erase anything you drew, from any session, without
selecting it first. Ship it with idea 2, so the model agrees with the screen:
erased ink can't be tapped, a drawing erased away disappears from the canvas
and the Layers panel, and boxes shrink once whole strokes are gone. Without
idea 2, idea 1 empties more drawings than today and leaves them invisible
but tappable, with rows in the panel.

Erasing stays pixel-exact (the clear eraser), so nothing about how ink looks
changes. No saved-file change. Both parts are small.

With it:

- The swath shows while dragging, wherever there's ink.
- Shapes about to be removed fade while dragging, so the eraser removing a rectangle near an arrow's tail isn't a surprise.
- A locked drawing is left alone, but Undo is the real safety net: Lock is only in the Layers panel, and most people won't find it.

### Step 2: A stroke eraser (idea 3)

**Stroke eraser** joins **Eraser** in the Eraser's flyout and bar, and
removes every stroke it touches, whole. Eraser, the partial one, stays the
default, since once the eraser reaches every drawing the stroke eraser is
the more destructive of the two.

### Step 3: Fewer, clearer drawing rows (ideas 7 and 5)

Give drawing rows a color swatch and a kind ("Highlight"), which the
follow-ups' "Layer row polish" already asks for. Then try idea 5 (the pen
continues the top drawing) on a phone, in both its forms, and keep it if it
feels right. It's tiny, and it stops rows piling up rather than tidying them
afterwards.

### Later

- **Selectable strokes, with the Select tool (idea 10).** When Select is designed, let it select strokes across drawings, and separate or merge them. That's the "major refactor": layers stop being something to manage at all. Nothing in steps 1 to 3 blocks it.
- **Merge down (idea 7)**, for ink drawings without eraser strokes, if idea 5 isn't enough.
- **Cutting strokes (idea 4)**, only if partly erased boxes or saved eraser strokes turn out to matter. It changes how cut ends look in several ways (idea 4 lists them).

### Not recommended

- **Real layer groups (idea 8).** No editor we looked at uses groups to decide what an eraser reaches. Tuck's layers must draw straight onto the canvas, so groups could only organize. That would cost a tree through every edit, gesture, and the saved format. Moving several things together is multi-select, which belongs to Select.
- **One ink sheet (idea 9)** gets erasing right by giving up stacking and moving marks apart. Steps 1 and 3 get there without that.
- **Picking the drawing under the finger (idea 6)** still erases one drawing at a time.
- **Wrapping each session in a flat group** would turn off reordering in the Layers panel (see [ideas.md](ideas.md#also-considered)).

## Details for step 1 and 2

What the reviews added, to build in from the start:

- **On web, a ring at the eraser's size follows the pointer**, so its reach shows before the click. Tuck has no brush cursor yet; Pen and Redact's brush would want the same.
- **When a swipe removes a whole drawing or shape**, show the edit notice ("Drawing erased · Undo"), as other deletions do. Ordinary partial erasing shows nothing.
- **Screen readers** announce removals ("Shape removed", "Drawing removed") through `Announcement`. The eraser itself has no accessible equivalent; deleting from the Layers panel is the way there.
- **A light haptic tick** on iOS and Android when a shape or stroke is marked for removal, with the fade.
- **Locked ink** under the swath stays as it is, and the swath doesn't show over it (the live clear is only drawn into drawings it can change), so it reads as untouched, not broken.
- **With nothing to erase** (no drawings or shapes), the Eraser could be disabled, so it never looks broken. Nothing in the toolbar works that way yet; `available` only hides tools a device can't run.
- **The selection outline.** Switching from Pen to Eraser leaves the new drawing selected and outlined, which suggests the eraser works only on it. Let go of the selection when Eraser opens (see open question 1).

## Open questions

1. **Does a selected drawing narrow the eraser?** Illustrator erases only what's selected, if anything is. The reviews split:
   - *No* (leaning this way): one rule nobody has to know about. The Pen-to-Eraser switch leaves a drawing selected without anyone meaning it, and narrowing would bring back today's behavior there. Clipping old ink while fixing a fresh stroke is what Markup does, and Undo covers it. Eraser lets go of the selection when it opens.
   - *Only when Eraser was opened from that drawing's actions*: that's a clear choice, unlike the Pen-to-Eraser switch, and it gives people a way to protect ink without finding Lock. The cost is a second rule that nothing on screen shows, unless the outline stays to show it.
   Decide by trying both on a phone.
2. **Should ink hidden under a photo or sticker be erased?** Leaning yes: it's rare, and it keeps one rule. The eraser can't tell what's visible without rendering. The cost is real, though: the gap shows only when the photo or sticker is moved, maybe much later, when the erase is many undo steps back.
3. **Do both variants keep removing shapes whole?** Yes, as any eraser does today, with step 1's fade.
4. **Does a highlighter-only eraser earn a place?** Goodnotes users ask for "erase the highlight, keep the ink". Hold until someone asks; the stroke eraser's filter makes it one condition.
5. **Is Canva's behavior what we assume?** Canva is the best-known product with Tuck's model (a drawing element per session), and the sources disagree on whether its eraser reaches older drawings. Worth ten minutes by hand before building.

## What building it touches

For whoever builds steps 1 and 2:

- Model: `layers/drawing/drawingEdits.ts` (`drawStroke`), `layers/strokes.ts` (the crossing test, `hitTestDrawing`, pruning, removing whole strokes), `layers/shape/shapeGeometry.ts` (`erasesShape` and `shapeOutline` share the crossing test, and become worklets for the fade).
- Canvas: `canvas/LiveStrokeOverlay.tsx` (`LiveStroke.targetId` becomes a test, and one shared live path), `EditorScene.tsx` (which layers draw the live stroke), `canvas/useToolStroke.ts`, `canvas/canvasTool.ts` (`canAddTo`), `canvas/layerTargets.ts` (outlines for the fade), `layers/drawing/DrawingLayerView.tsx` and `layers/LayerContent.tsx` (fading single strokes).
- Eraser: `tools/eraser/eraserSettings.ts`, `eraserTool.ts` (variants), `EraserPanel.tsx` (`EraserPanel`, `EraserBar`).
- Tests: `layers/drawing/__tests__/drawingEdits.test.ts`, `layers/__tests__/strokes.test.ts`, `layers/shape/__tests__/shapeGeometry.test.ts`, `tools/eraser/__tests__/eraserSettings.test.ts`, and `store/__tests__/editorSlice.test.ts`'s `an eraser only erases the selected drawing`.
- Docs: docs/architecture.md's Highlighter paragraph ("an eraser joins either"), and the interactive Strokes lesson (`docs/interactive/src/lessons/model/StrokesLesson.tsx`), whose "Erase across it" step models one target layer and teaches that erasing never shrinks the box. Any change to `DrawingLayerView`'s props has to keep the lessons that import it building.
- To check by hand, on web and the iOS simulator: an eraser across two drawings and a shape, a locked drawing, a Highlighter drawing under a Pen drawing, a neon stroke's glow, a drawing under a sticker, erasing a drawing away and then Undo, and a project saved before the change.
