# Drawing, erasing, and layers

A brainstorm on how Tuck's Pen, Shape, and Eraser should relate to layers,
started November 5, 2026.

## The problem

Each Pen session makes its own drawing layer, and the eraser only erases the
selected drawing. To erase marks from an earlier session, you close the tool,
tap that drawing, and open Eraser from its actions. Overlapping marks from
two sessions are erased one at a time. With nothing selected, the eraser
shows nothing and changes nothing. Meanwhile it removes any shape it crosses,
from any layer, so the same tool follows two rules.

## The short answer

Drawings can stay layers. The trouble is that the eraser depends on which
layer is selected. The markup and note apps with an eraser for ink (Apple
Markup, Instagram, Goodnotes) and the whiteboards (tldraw, Excalidraw) erase
any ink you drew without asking which layer. Only pro pixel editors scope the
eraser to a layer, and they come with layer-picking gestures Tuck's users
won't find.

So, in order:

1. **The eraser reaches every unlocked drawing it crosses, and erasing becomes honest**: erased ink can't be tapped, drawings erased away disappear, and boxes shrink when whole strokes go. Erasing stays pixel-exact. Small, and no saved-file change.
2. **A stroke eraser** as a second variant that removes whole strokes. The partial eraser stays the default.
3. **Fewer, clearer drawing rows**: name rows by color and kind, and try letting the pen continue the drawing on top.
4. Later, with the planned Select tool, **select strokes across drawings** to move, separate, or merge them.

Real (container) layer groups, a single ink sheet, and cutting strokes
geometrically were considered and not recommended now.
[recommendation.md](recommendation.md) says why, and lists the open
questions.

## The documents

- [current-model.md](current-model.md): how drawing, shapes, erasing, and groups work in the code today, and the limits any change has to keep.
- [prior-art.md](prior-art.md): how Photoshop, Procreate, Apple Markup, Goodnotes, Canva, Figma, tldraw, Excalidraw, Snagit, and others handle it, with sources.
- [ideas.md](ideas.md): ten ideas, from a small change to the eraser to selectable strokes, each with what the user sees, what changes in the code, and its cost.
- [recommendation.md](recommendation.md): which to build, in what order, the details to build in, the open questions, and what building it touches.
- [review.md](review.md): what three reviews of the first draft found, and what changed because of them.
