# Drawing, erasing, and layers

A brainstorm on how Tuck's Pen, Shape, and Eraser should relate to layers,
started November 5, 2026.

## The problem

Each Draw session makes its own drawing layer, and the eraser only erases the
selected drawing. To erase marks from an earlier session, you close the tool,
tap that drawing, and open Eraser from its actions; overlapping marks from two
sessions are erased one at a time. With nothing selected, the eraser shows
nothing and changes nothing. Meanwhile it removes any shape it crosses, from
any layer, so the same tool follows two rules.

## The short answer

Drawings can stay layers. The trouble is that the eraser depends on which
layer is selected. Every markup tool people know (Apple Markup, Instagram,
Goodnotes, tldraw, Excalidraw) erases any ink you drew without asking which
layer; only pro pixel editors scope it to a layer, and they come with
layer-picking gestures Tuck's users won't find.

So, in order:

1. **The eraser reaches every unlocked drawing it crosses**, with the swath shown wherever there's ink. Small, and no saved-file change.
2. **Vector erasing**: the eraser cuts strokes rather than painting clear strokes over them, with **Erase parts** and **Erase strokes** variants. Boxes shrink, erased ink stops being tappable, and emptied drawings go away.
3. **Tell drawings apart and merge them** in the Layers panel.
4. Later, with the planned Select tool, **select strokes across drawings** to move, separate, or merge them.

Real (container) layer groups and a single ink sheet were considered and not
recommended. [recommendation.md](recommendation.md) says why, and lists the
open questions.

## The documents

- [current-model.md](current-model.md): how drawing, shapes, erasing, and groups work in the code today, and the limits any change has to keep.
- [prior-art.md](prior-art.md): how Photoshop, Procreate, Apple Markup, Goodnotes, Canva, Figma, tldraw, Excalidraw, Snagit, and others handle it, with sources.
- [ideas.md](ideas.md): eight ideas, from a small change to the eraser to selectable strokes, each with what the user sees, what changes in the code, and its cost.
- [recommendation.md](recommendation.md): which to build, in what order, the open questions, and what building it touches.
- [review.md](review.md): what reviewing this brainstorm found, and what changed because of it.
