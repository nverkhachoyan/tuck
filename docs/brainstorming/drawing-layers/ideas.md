# Ideas

Ten ways to improve how drawing and erasing relate to layers, from small
changes to a larger refactor. Each says what the user sees, what changes in
the code, what it costs, and what it leaves. Sizes are rough: XS is under a
day, S a day or two, M about a week, L more.
[recommendation.md](recommendation.md) picks among them, and
[review.md](review.md) records how review changed them.

- Erasing: 1 (reach every drawing), 2 (make erasing honest), 3 (a stroke eraser), 4 (cut strokes).
- Fewer layers: 5 (continue the drawing on top), 6 (pick the drawing under the finger), 7 (name rows and merge drawings).
- Bigger models: 8 (real groups), 9 (one ink sheet), 10 (selectable strokes).

## 1. The eraser reaches every drawing it crosses

**What the user sees.** Open Eraser and erase. Any ink under the swath goes,
from whichever session drew it, as shapes already do. Nothing needs selecting
first. The swath shows while dragging, wherever there's ink. A locked drawing
is left alone.

**In the code.**

- `drawStroke` (`layers/drawing/drawingEdits.ts`): for an eraser, find every unlocked, visible drawing the stroke crosses, and add the eraser stroke to each (`addStroke` takes it into each layer's own space).
  - The crossing test is `erasesShape`'s (`layers/shape/shapeGeometry.ts`), which samples the eraser's path against `hitTestDrawing`. Make it one helper, taking strokes and a transform, for shapes and drawings alike, and skip drawings whose cached `drawingBox` the eraser misses.
  - Pad the test generously. Visible ink reaches past a stroke's centerline plus half its width: a neon glow (about 0.55 of the width, blurred), a Marker or Highlighter's square-cap corners, and the curve `strokePath` draws between points. Adding an eraser stroke to a drawing it doesn't visibly touch costs nothing visible.
- The live swath: `LiveStroke.targetId` becomes a test of which layers draw the live stroke, and for an eraser `EditorScene` hands it to every unlocked drawing (it already skips hidden layers). The clear reaches only each drawing's own saved layer, so this looks like the result, wherever the padded test agrees. Build the live path once and share it, rather than each drawing's `LivePath` rebuilding it on every pointer move.
- Fade the shapes the eraser will remove as it crosses them, as tldraw does, so removing a whole shape isn't a surprise. That does need a test on the UI thread as the finger moves: `layerTargets` already sends shapes' outlines there, `erasesShape` and `shapeOutline` would become worklets, and only each new eraser segment needs testing.
- Replace the store test `an eraser only erases the selected drawing` with ones for crossing two drawings, a locked drawing, and a hidden one.

**Cost.** S. No saved-file change: drawings already store eraser strokes.

**What it leaves.** With idea 1 alone, more drawings get emptied than today,
and the model's leftovers show more:

1. Erased ink can still be tapped, selecting a drawing nobody can see.
2. A drawing's box keeps the size of ink that's gone.
3. A drawing erased away stays, with a row in the Layers panel.
4. Eraser strokes pile up, now in every drawing they cross.

Idea 2 fixes all four, which is why the recommendation ships them together.
Erasing over a drawing that's under a photo or sticker also erases ink nobody
can see (see [recommendation.md](recommendation.md#open-questions)).

## 2. Make erasing honest

Keep the clear eraser, which erases exactly what's under the swath, pixel for
pixel, and make the model agree with what's on screen.

**What the user sees.** A tap where ink was erased reaches what's under it. A
drawing erased away disappears from the canvas and the Layers panel in the
same step. Selection boxes shrink once whole strokes are gone.

**In the code.** All plain TypeScript in `layers/strokes.ts`, tested in Node:

- **Taps.** `hitTestDrawing` counts a pen stroke as hit only where no *later* eraser stroke covers the point. It's a worklet already; this is one more loop over the strokes above the one hit.
- **Pruning.** When an eraser stroke lands in a drawing, drop each earlier pen stroke the erasing now covers entirely: every point along its drawn curve lies within some later eraser's reach, less the stroke's own visible reach (half its width, or its glow for neon). Then drop each eraser stroke that no longer overlaps any pen stroke drawn before it. The test errs toward keeping strokes, so it never removes visible ink; at worst it leaves a little invisible ink in place.
- **Emptied drawings.** A drawing left with no pen strokes is removed in the same edit, as a shape the eraser crosses is.
- **Boxes.** `drawingBox` and `recenterDrawing` already measure pen strokes only, so a box shrinks as soon as a stroke is pruned. A stroke erased only in part still counts whole.
- Only drawings the eraser crossed need checking, and only their strokes inside the eraser's box.
- The interactive Strokes lesson's "Erase across it" step says erasing never shrinks the box. It changes in the same change.

**Cost.** S.

**What it leaves.** A partly erased stroke keeps its full box, and its
eraser stroke stays saved. That's the honest cost of pixel-exact erasing, and
small: the box is only too big on the sides where something was erased.

## 3. A stroke eraser

**What the user sees.** The Eraser gets two variants, in the flyout Pen and
Shape already have and as segments in its bar (`EraserBar`), as Pen's tips
are:

- **Eraser** (the default): erases what's under the swath, as today, with ideas 1 and 2.
- **Stroke eraser**: removes every stroke it touches, whole, like PencilKit's vector eraser, Markup's Object Eraser, or Goodnotes' Stroke eraser. Undoes a scribble or an arrow in one swipe. Strokes about to go fade as the finger crosses them.

Either way it reaches every drawing, and removes shapes whole.

**Why partial is the default.** Once the eraser reaches every drawing, the
stroke eraser is the more destructive one: a swipe across an old annotation
takes whole strokes from it. Removing the scribble just drawn is already one
Undo.

**In the code.**

- Removing whole strokes writes no eraser stroke: drop every pen stroke within reach of the eraser's path, then remove the drawing if it's empty (idea 2).
- The fade needs a per-stroke test on the UI thread as the finger moves. Keep the set of strokes already hit and test only each new eraser segment. `nearLine` in `layers/strokes.ts` is a worklet but not exported. Fading single strokes means `DrawingLayerView` takes a shared value for which to fade, and the docs/interactive lessons import that view.
- The eraser's settings gain the variant (`eraserSettings.ts` and its parser and tests), and `eraserTool.ts` declares `variants`, `activeVariant`, `selectVariant`, and `variantEntry`, as `penTool.ts` does.

**Cost.** S.

**What it leaves.** Nothing new in the model. Its function should take a
filter for which strokes it may remove, so a highlighter-only eraser
(Goodnotes users ask for one) would cost one condition later.

## 4. Cut strokes (vector erasing)

**What the user sees.** The same as the default eraser after idea 2, except
that what's erased is gone from the model too: every box shrinks to the ink
that's left, and no eraser strokes are saved.

**In the code.**

- A plain TypeScript function replaces each pen stroke the swath touches with the pieces left over (none, one, or several), spliced in where the stroke was, so an older eraser stroke still clears only what was drawn before it.
- Cut the curve that's drawn, not the stroke's points: `strokePath` draws quadratic curves through the midpoints between points, so the points aren't the line. Flatten the curve into a dense polyline first, then cut that. Otherwise each cut end gets a visible hook or shift, worst on a fast stroke with few points.
- For each segment of the dense line, find the parts within the eraser's reach of its path. Against each segment of the eraser's path, that's a segment against a capsule (a rectangle with round ends), and the distance is convex along the segment, so each eraser segment removes one interval. Remove those intervals, and drop pieces shorter than a point unless the stroke was a dot. A one-point eraser path is a disc.

**Why it isn't recommended now.** Cutting changes how ink looks, in ways the
clear eraser doesn't:

- **Round caps over-erase.** With reach equal to the eraser's radius plus half the stroke's width, the cut end's cap stays outside the swath, but ink near the cut that was outside it goes too: about half the width divided by the sine of the angle the eraser crosses at, so a lot at a shallow angle. A smaller reach makes the caps poke into the swath instead.
- **Square caps poke in.** Highlighter and Marker strokes have square caps, whose corners can reach into the swath by up to about 0.2 of the stroke's width.
- **Marker darkens where it didn't.** A Marker stroke is drawn as one path at 45% opacity, so it doesn't darken where it crosses itself. Cut a loop in two, and the pieces darken where they overlap, somewhere nobody erased.
- **Neon's glow comes back.** The glow is blurred around each piece, so it spreads back into the swath.
- **The ink jumps when the finger lifts.** The live preview is a clear swath, and the cut result differs from it as above.

**Cost.** M, most of it the geometry and its tests.

**What it leaves.** Worth it only if idea 2's leftovers (partly erased boxes,
saved eraser strokes) turn out to matter, or if idea 10 needs strokes cut
into separate pieces.

## 5. The pen continues the drawing on top

**What the user sees.** Draw, press Done, add nothing else, then draw again:
the new marks join the same drawing instead of starting another. Add a
sticker or text in between, and the next marks start a new drawing over it.

**In the code.** In `drawStroke`, when nothing joinable is selected, a pen
stroke joins the top layer if that's an unlocked drawing that blends the
same way. Done still lets go of the selection, so a stray drag can't move
anything.

A variant skips shapes when looking for the drawing to join, since each
shape is its own layer and people draw with Pen and Shape together. Its cost:
a new stroke then lands *under* the shapes above that drawing, so a line
drawn across a rectangle's outline goes beneath it. Try both before choosing.

**Cost.** XS.

**What it leaves.** Two sessions' marks can no longer be moved apart, unless
idea 10 can separate them. It keeps rows from piling up in the first place,
where merging (idea 7) only tidies them later, and fewer drawings make
erasing cheaper. It's the version of idea 9 that keeps stacking: ink
collects into one drawing per place in the stack.

## 6. Pick the drawing under the finger

**What the user sees.** The eraser erases the topmost drawing under where the
stroke starts, like Photoshop's Auto-Select or Procreate's Layer Select.

**In the code.** `useToolStroke` hit-tests the stroke's first point (it
already does for a tap with Shape or Redact) and sets the target from there.

**Cost.** XS to S.

**What it leaves.** Overlapping drawings still erase one at a time, and the
pen can't use the same rule without surprising people (a stroke that starts on
old ink would join it). Idea 1 does more for about the same cost. Listed so
it's on record why it wasn't picked.

## 7. Name drawings apart, and merge them

**What the user sees.** Rows in the Layers panel show a swatch of the
drawing's main color and its kind ("Highlight" for a highlighter drawing), so
they can be told apart. Later, a drawing's row could offer **Merge down**
onto an ink drawing directly below it.

**In the code.**

- The label and swatch are `layerLabel` and `LayerRow` (`layers/panel/`). This is the follow-ups' "Layer row polish" entry.
- A `mergeDrawings` edit in `drawingEdits.ts` takes each of the upper drawing's strokes to document space with its transform, then into the lower drawing's with the same math as `addStroke` (widths scale by the ratio of the two `scaleX` values, which is exact since drawings scale uniformly), recentering once at the end. Then it deletes the upper drawing.
- **Eraser strokes in the upper drawing** would clear the lower drawing's ink once they share its saved layer. Merge only when the upper drawing has none, or cut them first with idea 4's geometry.
- **Two highlighter drawings don't merge exactly**: highlights darken where they cross only when each is its own layer. Offer merging for ink drawings only. Ink merges are exact, since drawing over is associative.

**Cost.** XS for the rows, S for merging.

**What it leaves.** Merging is undone with Undo, not split again (idea 10).
It's a power feature most users won't look for; idea 5 does more for them.

## 8. Real layer groups

**What the user sees.** Groups become containers: a Pen session's drawings
and shapes land in one group, which moves, hides, locks, and deletes as one,
can be selected on the canvas, and expands in the Layers panel. The eraser
could be limited to the selected group.

**In the code.** Today's `LayerGroup` is a label on a flat list. A container
needs:

- A tree, or a group transform applied over its children's: every layer edit, hit test, snapping, selection overlay, `framing.ts`, and export learn about a parent.
- Groups that still don't composite. Layers must draw straight onto the canvas (redaction blur, highlighter multiply), so a group can't have its own opacity or blend, only pass its children through, as Photoshop's default groups do.
- Selection that can hold a group, and drill into one.
- A Layers panel that can still reorder: the grouped list can't today.
- A saved-file version bump and an upgrade.

**Cost.** L.

**What it leaves.** It doesn't solve erasing by itself: in Photoshop and
Procreate, a group doesn't change what the eraser reaches. What it does add,
moving several things together, is really multi-select, which the planned
Select tool could provide without groups. Not recommended for this problem.

## 9. Drawings aren't layers: one ink sheet

**What the user sees.** Like Markup or Instagram, the tools Tuck's users
already know, all freehand ink is one sheet over the photo, and the eraser
reaches all of it. The Layers panel shows one "Drawing" row, or none.

**In the code.** The document gets one drawing (two, since a highlighter must
multiply onto the photo, not onto the ink), always above the layers or at a
fixed place. Existing projects with several drawings have to be merged, which
loses their stacking.

**Cost.** M, and a breaking change to saved files.

**What it leaves.** A drawing can't go under a caption or a sticker, and
marks can't be moved apart, which goes against "nothing is final until
export". Ideas 1 and 5 give most of its benefit (an eraser that reaches all
ink, and few drawings) without giving those up. Not recommended.

## 10. Strokes you can select (the larger refactor)

**What the user sees.** The planned **Select** tool (in the follow-ups) picks
strokes as well as layers, by tap or lasso, across drawings. A selection of
strokes can be moved, recolored, deleted, or **separated** into a drawing of
its own; two drawings can be **merged**. Layers become a place to organize,
not something to manage before erasing or moving a mark.

**In the code.**

- Strokes get stable ids. The saved format adds them, with a version bump, and old strokes get ids as they open. If idea 4 is built first, decide then whether a cut stroke's pieces get new ids or keep a shared one.
- A selection becomes layers or strokes. The selection overlay, transform gesture, and stroke hit-testing (already worklets) grow to cover a set of strokes in one or more drawings.
- Separating moves strokes to a new drawing with the same transform. Merging is idea 7.
- The stroke eraser (idea 3) and separating are both "do something to these strokes".

**Cost.** L, and it's the Select tool's design work as much as this one.

**What it leaves.** This is how a vector editor would solve it, and it makes
"one drawing per session" stop mattering at all. It's also the most to build,
and only pays off once Select exists.

## Also considered

- **Wrap each Pen session in a flat group**, so the Layers panel shows one row per session. Today's groups need no new model, but any group switches the panel to its grouped list, which can't reorder by dragging, so nearly every document with ink would lose reordering.
- **Each stroke as its own layer**, folded in the panel. Each drawing is drawn in a saved layer, so hundreds of them cost a lot to draw, and one multiplying layer per highlighter stroke would darken where a session's highlights overlap, which they don't today. Folding them needs groups too.
- **An eraser that only erases the topmost visible ink.** Telling what's visible needs rendering or an occlusion test, and stickers and cut-outs are partly transparent.
- **One Draw tool with pen, highlighter, eraser, and shapes as variants**, so a session spans them all. Pen, Shape, and Eraser were split into separate tools on purpose (docs/architecture.md), and idea 1 makes the session boundary irrelevant to erasing anyway.
- **Flattening drawings into the photo.** Breaks "nothing is final until export".
- **Erasing photos, text, or stickers.** Photo markup tools don't erase the image under the marks (see [prior-art.md](prior-art.md#lessons-for-tuck)). Cut's subtract brush and mask already remove parts of a photo, reversibly.
- **Erasing parts of shapes.** A shape is one mark, and the eraser removes it whole. Turning a shape into strokes so it can be cut would lose its handles and restyling.
- **Undoing one stroke at a time** already works: each stroke is its own undo step while the tool is open, and they become one step at Done.
