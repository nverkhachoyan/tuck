# 6. Separate

Separate splits a mark into one mark per piece whose strokes don't touch: the
way out when two things were grouped by mistake. Size S.

Decided while planning: Separate works on whole strokes. A stroke the Eraser
broke in two stays one stroke, so its halves stay in one mark, and Separate
doesn't appear for them (see the README).

Settle first: nothing.

## What the person sees

- A selected mark whose strokes form pieces that don't touch shows **Separate** in its floating bar, beside Arrange, Duplicate, and Delete. A mark in one piece doesn't.
- Separate replaces the mark with one mark per piece, each where it was, in the same place in the stack (the pieces in the order they were drawn). The first piece stays selected.
- Each piece looks as it did: what was erased stays erased.
- One undo step. The Layers panel shows a row per piece.

## The edits

### Model (plain TypeScript)

`layers/drawing/drawingEdits.ts`:

- `drawingPieces(layer): number[][]`: the indexes of its pen strokes, grouped. Two pen strokes touch where their visible ink (`visibleReach`, step 1) overlaps at a point no later eraser covers; pieces are the connected groups. Sampled along each stroke at a quarter of its width, tested with `nearLine` against the other's line, skipping pairs whose boxes miss. Cached by the strokes array (a `WeakMap`, as `drawingBox` is).
- `separateDrawing(document, id)`: when there are two or more pieces, each becomes a drawing with the original's transform, blend, `hidden`, and `locked`, holding its pen strokes and every eraser stroke that overlaps one of them, in their original order, then recentered (`recenterDrawing`). An eraser over two pieces goes into both, which draws the same. The pieces take the original's place in `layers`; the first keeps its id, so the selection and its row stay put, and the others get new ids (`createLayerId("drawing")`). Returns the same document otherwise.

The model lives beside the other drawing edits; `drawing/` gains no new file.

### Store

`store/editorSlice.ts`: `separateSelectedDrawing()` through `setDocument`, with
the first piece as the selection.

### The bar

`shell/SelectionBar.tsx`: an optional `onSeparate`, shown as a button
(label "Separate", an icon to pick from the set in DESIGN.md) only when
given.

`LayerSelectionBar.tsx`: passes `onSeparate` when the selected layer is an
unlocked drawing with more than one piece (`drawingPieces`).

`editorChrome.ts` and `shortcuts.ts`: no shortcut; the direction names none.

## Tests

`layers/drawing/__tests__/drawingEdits.test.ts`:

- Two crossing strokes are one piece; a circle and a word apart are two; a chain of three touching strokes is one.
- Two strokes that touched only where an eraser cleared are two pieces.
- One stroke erased through its middle is one piece (whole strokes).
- `separateDrawing` keeps the stack order and the first id; each piece keeps its transform and blend, holds the erasers that overlap it, and draws the same (same strokes in document space, by comparing `toDocumentSpace` of each point).
- A one-piece drawing and a locked drawing return the same document.

`store/__tests__/editorSlice.test.ts`: "separating is one undo step, and selects the first piece".

## Docs and lessons

- docs/architecture.md: `drawingEdits.ts` named for Separate in the `layers/` bullet; the selection bar's actions.
- DESIGN.md: the floating bar's actions include Separate for a drawing in pieces.
- ux-direction.md's line about pieces: the README's proposed change, for you to make.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Circle a word, then quickly write next to it, so both group as one mark. Select it: Separate shows. Separate: two rows, each movable apart, the circle selected.
- Erase through a line: its mark shows no Separate.
- Erase the overlap between two crossing strokes in one mark: Separate shows, and splits them.
- Undo: one mark again, selected.
- The floating bar fits with four actions at 390 points wide.

Only a phone: the bar's fit next to a mark near the screen's edge.
