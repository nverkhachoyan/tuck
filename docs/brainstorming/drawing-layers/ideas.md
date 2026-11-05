# Ideas

Eight ways to improve how drawing and erasing relate to layers, from small
changes to a larger refactor. Each says what the user sees, what changes in
the code, what it costs, and what it leaves. Sizes are rough: XS is under a
day, S a day or two, M about a week, L more.
[recommendation.md](recommendation.md) picks among them.

## 1. The eraser reaches every drawing it crosses

**What the user sees.** Open Eraser and erase. Any ink under the swath goes,
from whichever session drew it, as it already does for shapes. Nothing needs
selecting first. A locked drawing is left alone, so locking is how to protect
one. The swath shows while dragging, wherever there's ink.

**In the code.**

- `drawStroke` (`layers/drawing/drawingEdits.ts`): for an eraser, find every unlocked, visible drawing the stroke crosses, and add the eraser stroke to each (`addStroke` already takes it into each layer's own space). The crossing test is `erasesShape`'s, which samples the eraser's path against `hitTestDrawing`. Make it one helper that takes strokes and a transform, and use it for both shapes and drawings.
- The live swath: `EditorScene` hands the live stroke only to the layer whose id is `targetId`. For an eraser, hand it to every drawing the eraser can change. The eraser's clear only reaches each drawing's own saved layer, so drawing the live path into all of them looks exactly like the result. Nothing has to be hit-tested on the UI thread while dragging.
- Fade the shapes the eraser will remove as it crosses them, as tldraw does, so removing a whole shape isn't a surprise.
- Selection: the eraser no longer needs one. Whether a selected drawing *narrows* it (Illustrator) is an open question (see [recommendation.md](recommendation.md#open-questions)).
- The Eraser's `actsOn` (opening it from a selected drawing's actions) still works; with this change it opens on everything.
- Replace the test `an eraser only erases the selected drawing` with ones for crossing two drawings, a locked drawing, and a hidden one.

**Cost.** S. No saved-file change: eraser strokes are already stored in
drawings.

**What it leaves.** The four leftovers from [current-model.md](current-model.md#what-follows-from-that): erased ink still counts for boxes and taps, an emptied drawing stays, and eraser strokes pile up, now in every drawing they cross. Erasing over a drawing that's under a photo or sticker also erases ink nobody can see. Idea 2 fixes the first three.

## 2. Erase by changing the strokes (vector erasing)

**What the user sees.** The eraser offers two variants, in the flyout that
Pen and Shape already have:

- **Erase parts** (the default): cuts strokes where the swath passes, like Goodnotes' Standard eraser or Figma Draw's.
- **Erase strokes**: removes every stroke it touches, whole, like PencilKit's vector eraser, Markup's Object Eraser, or Goodnotes' Stroke eraser. Undoes a scribble or an arrow in one swipe. Strokes about to go fade while dragging.

Either way it reaches every drawing, as in idea 1. A drawing left with no ink
is removed in the same step, and a drawing's box shrinks to what's left.

**In the code.**

- Erasing stops adding eraser strokes. Instead, a plain TypeScript function in `layers/strokes.ts` (Node-tested) replaces each pen stroke the swath touches with the pieces left over: none, one, or several.
  - For each segment of the stroke's centerline, find the parts within the eraser's reach of its path: for each segment of the eraser's path, that's a segment against a capsule (a rectangle with round ends). Remove those intervals, splitting a segment where an interval ends inside it. A box around each stroke skips the ones the eraser misses.
  - The reach is the eraser's radius plus half the stroke's width, in the layer's units (drawings scale uniformly, so dividing by `scaleX` is exact). The cut end's round cap then meets the edge of the swath where the eraser crosses the stroke squarely. Where it crosses at a slant, a little of the cap pokes into the swath. That's the "Standard eraser" look, not a pixel-exact one.
  - **Erase strokes** is simpler: drop every pen stroke within reach.
- `drawStroke` keeps the eraser off redactions: Redact's brush keeps its own clear-blend eraser, since a redaction has to cover exactly what it covered.
- A drawing whose last pen stroke goes is removed. `recenterDrawing` already recomputes the box from pen strokes, so it shrinks once ink is really gone, and `hitTestDrawing` stops hitting erased ink.
- Saved files: new erasing writes no eraser strokes, so nothing new is written and `PROJECT_VERSION` stays. Eraser strokes in existing projects keep drawing as they do. Since a cut replaces a stroke where it stood, an old eraser stroke still clears only what was drawn before it.
- The live preview: **Erase parts** draws the clear swath as idea 1 does, which looks nearly like the result; once the finger lifts, the cut strokes replace it. **Erase strokes** fades the strokes it will remove, which needs a per-stroke test on the UI thread; `nearLine` and `hitTestDrawing` are already worklets.
- The interactive Strokes lesson ("Erase across it") teaches that erasing never shrinks the box, so it changes in the same change.

**Cost.** M: the geometry and its tests are most of it.

**What it leaves.** A swath doesn't match pixel for pixel where it crosses a
thick stroke at a shallow angle. Partial erasing of a neon stroke cuts its
glow with the stroke, which looks right. A tool that needs a pixel-exact edge
(a redaction) keeps the clear eraser.

## 3. The pen continues the drawing on top

**What the user sees.** Draw, press Done, add nothing else, then draw again:
the new marks join the same drawing instead of starting another. Add a
sticker, text, or a shape in between, and the next marks start a new drawing
over it.

**In the code.** In `drawStroke`, when nothing joinable is selected, a pen
stroke joins the topmost layer if that's an unlocked drawing that blends the
same way. Done still lets go of the selection, so a stray drag can't move
anything.

**Cost.** XS.

**What it leaves.** Two sessions' marks can no longer be moved apart, unless
idea 8 can separate them. It halves the "Drawing" rows for someone who
draws in several sessions, but makes a layer's extent less predictable. Once
idea 1 lands, layers stop mattering for erasing, and this only tidies the
panel.

## 4. Pick the drawing under the finger

**What the user sees.** The eraser erases the topmost drawing under where the
stroke starts, like Photoshop's Auto-Select or Procreate's Layer Select.

**In the code.** `useToolStroke` hit-tests the stroke's first point (it
already does for a tap with Shape or Redact) and sets the target from there.

**Cost.** XS to S.

**What it leaves.** Overlapping drawings still erase one at a time, and the
pen can't use the same rule without surprising people (a stroke that starts on
old ink would join it). Idea 1 does more for about the same cost. Listed so
it's on record why it wasn't picked.

## 5. Merge drawings, and name them apart

**What the user sees.** A drawing's row in the Layers panel offers **Merge
down** onto a drawing directly below it that blends the same way. Rows show a
swatch of the drawing's main color and its kind ("Highlight" for a
multiplying drawing), so they can be told apart.

**In the code.** A `mergeDrawings` edit in `drawingEdits.ts`: take each of
the upper drawing's strokes to document space with its transform, then into
the lower drawing's with `addStroke`. Widths scale by the ratio of the two
`scaleX` values. Delete the upper drawing. A merge across blends (a
highlighter into ink) isn't offered: the result would composite differently.
The row label and swatch are `layerLabel` and `LayerRow`.

**Cost.** S.

**What it leaves.** Merging is undone with Undo, not split again (idea 8).
It's a power feature; most users won't look for it. The row naming is worth
doing anyway: it's in the follow-ups' "Layer row polish".

## 6. Real layer groups

**What the user sees.** Groups become containers: a Draw session's drawings
and shapes land in one group, which moves, hides, locks, and deletes as one,
can be selected on the canvas, and expands in the Layers panel. The eraser
could be limited to the selected group.

**In the code.** Today's `LayerGroup` is a label on a flat list. A container
needs:

- A tree, or a group transform applied over its children's: every layer edit, hit test, snapping, selection overlay, `framing.ts`, and export learn about a parent.
- Groups that still don't composite. Layers must draw straight onto the canvas (redaction blur, highlighter multiply), so a group can't have its own opacity or blend, only pass its children through, as Photoshop's default groups do.
- Selection that can hold a group, and drill into one.
- A saved-file version bump and an upgrade.

**Cost.** L.

**What it leaves.** It doesn't solve erasing by itself: in Photoshop and
Procreate, a group doesn't change what the eraser reaches. What it does add
(moving several things together) is really multi-select, which the planned
Select tool could provide without groups. Not recommended for this problem.

## 7. Drawings aren't layers: one ink sheet

**What the user sees.** Like Markup or Instagram, all freehand ink is one
sheet over the photo, and the eraser reaches all of it. The Layers panel
shows one "Drawing" row, or none.

**In the code.** The document gets one drawing (two, since a highlighter must
multiply onto the photo, not onto the ink), always above the layers or at a
fixed place. Existing projects with several drawings have to be merged, which
loses their stacking.

**Cost.** M, and a breaking change to saved files.

**What it leaves.** A drawing can't go under a caption or a sticker, and
marks can't be moved apart, which goes against "nothing is final until
export". Most of the benefit (the eraser reaching all ink) comes from idea 1
without giving those up. Not recommended.

## 8. Strokes you can select (the larger refactor)

**What the user sees.** The planned **Select** tool (in the follow-ups) picks
strokes as well as layers, by tap or lasso, across drawings. A selection of
strokes can be moved, recolored, deleted, or **separated** into a drawing of
its own; two drawings can be **merged**. Layers become a place to organize,
not something to manage before erasing or moving a mark.

**In the code.**

- Strokes get stable ids (the saved format adds them; a version bump, with old strokes given ids as they open).
- A selection becomes layers or strokes. The selection overlay, transform gesture, and stroke hit-testing (already worklets) grow to cover a set of strokes in one or more drawings.
- Separating moves strokes to a new drawing with the same transform; merging is idea 5.
- Erasing whole strokes (idea 2) and separating are both "do something to these strokes".

**Cost.** L, and it's the Select tool's design work as much as this one.

**What it leaves.** This is how a vector editor would solve it, and it makes
"one drawing per session" stop mattering at all. It's also the most to build,
and only pays off once Select exists. Worth designing the stroke ids so ideas
2 and 5 don't block it.

## Not considered

- **Erasing photos, text, or stickers.** No markup tool erases the image under the marks (see [prior-art.md](prior-art.md#lessons-for-tuck)). Cut's subtract brush and mask already remove parts of a photo, reversibly.
- **Erasing parts of shapes.** A shape is one mark, and the eraser removes it whole. Turning a shape into strokes so it can be cut would lose its handles and restyling.
