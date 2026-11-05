# How drawing, shapes, and erasing work today

What this brainstorm starts from, read from the code at `e0b07fb`.

## The model

- **A drawing is a layer** (`DrawingLayer` in `editor/layers/drawing/drawing.ts`): a list of strokes in the layer's own space, a transform, and an optional `blend: "multiply"`. Each stroke is a `Brush` (a pen with a color, width, and tip, or an eraser with a width) plus flattened points.
- **A shape is a layer too** (`ShapeLayer`, `editor/layers/shape/shape.ts`): one rectangle, ellipse, line, or arrow, with its own color and stroke width.
- **Groups exist, but they're flat labels** (`LayerGroup` in `document/document.ts`): a name and a list of layer ids. The layers keep their own places in the document's paint order, and a group only shows as one row in the Layers panel, which hides, locks, or deletes all of its layers. Today only Find's detected redactions (`addRedactionBoxes`) create one. Nothing on the canvas knows about groups.

## Which drawing a stroke goes into

All of it is `drawStroke` in `editor/layers/drawing/drawingEdits.ts`:

1. A **pen stroke** joins the selected drawing when it's unlocked and blends the same way (a highlighter only joins a multiplying drawing; a pen or the see-through marker only joins a normal one). Otherwise it starts a new drawing on top, which the store then selects (`selectionAfter` in `store/editorSlice.ts`), so the next stroke joins it.
2. Pen, Shape, and Eraser all set `deselectOnDone: true`, so **Done lets go of the drawing**. The next time Pen opens, nothing is selected, and its first stroke starts a new drawing. So, in practice, **each Draw session makes its own layer**, and switching between pen and highlighter in one session makes one per switch.
3. An **eraser stroke** joins the selected drawing whatever its blend. With no drawing selected it has no drawing to join and changes nothing. The store test `an eraser only erases the selected drawing` makes that rule explicit.
   - Switching from Pen straight to Eraser in the rail or dock (`startTool` in `useEditorTools.ts`) commits Pen's session but doesn't run its Done, so the drawing stays selected and the eraser works on it. Only Done, or reopening the eraser later, loses it. So erasing what you *just* drew works; erasing anything older doesn't.
4. An eraser stroke also **removes every unlocked, visible shape it crosses, whole**, whatever is selected (`erasesShape` in `layers/shape/shapeGeometry.ts`).

So drawings and shapes follow two different rules: the eraser reaches every shape but only one drawing.

## How an eraser stroke draws

- An eraser stroke is stored in the drawing like a pen stroke. `DrawingLayerView` draws it as a `blendMode: "clear"` path.
- Every drawing is drawn inside a Skia `Group layer` (a saved layer), so the clear only removes that drawing's earlier strokes, not the photo or anything else under it. That saved layer is also why a highlighter needs its own drawing: the group multiplies onto what's under it once, as a whole.
- While a finger is down, the live stroke is drawn into one layer, `LiveStroke.targetId` (`canvas/useToolStroke.ts`). That's the selected drawing when the tool can add to it (`canAddTo` in `canvas/canvasTool.ts`), or else nothing for an eraser (`NewLayerStroke` draws no eraser). **An eraser with no drawing selected shows nothing at all while you drag.**

## What follows from that

What people run into:

- **You can only erase one drawing, and you have to pick it first.** To erase marks from an earlier session, you close the tool, tap that drawing's ink, then open Eraser from its actions. If marks from two sessions overlap, you erase them one at a time.
- **No feedback without a selection.** Erasing with nothing selected looks like a broken tool: no swath while you drag, and no change after.
- **The Layers panel fills up with identical "Drawing" rows** (`layerLabel` in `layers/panel/LayerRow.tsx`). Telling them apart is already in the follow-ups ("Layer row polish").
- **Shapes and drawings behave differently under the same eraser**: a shape goes whole, and only if you cross it; a drawing only if it's selected, partially.

Smaller problems in the model, which matter for some options below:

- **Erasing never shrinks a drawing.** `drawingBox` and `recenterDrawing` count only pen strokes, so the selection box keeps the size of ink that's gone (the interactive Strokes lesson teaches this).
- **Erased ink can still be tapped.** `hitTestDrawing` checks only pen strokes, so a tap where ink was erased still selects that drawing.
- **A fully erased drawing stays** as an invisible layer with a box and a row in the panel, until someone deletes it.
- **Eraser strokes accumulate.** Every eraser stroke is saved, and drawn on every render.

## Limits any change has to keep

- **Document layers draw straight onto the canvas** (docs/architecture.md, "Straight onto the canvas"). A redaction's backdrop blur reads only the layer it's drawn in, and a highlighter's multiply blends only onto that layer. A container that composites its children in a saved layer would break both. Any "group" has to stay a logical grouping, which Photoshop calls a pass-through group, not a compositing one.
- **Each drawing is itself a saved layer**, which is what limits a clear-blend eraser to that drawing's strokes. Putting the highlighter and the pen into one container would make the highlighter multiply onto the pen's ink only, not onto the photo.
- **Plain TypeScript for the model.** `document/` and the lowercase `.ts` files in `layers/` stay free of React and Skia, and run in Node's tests. Geometry the UI thread needs is marked `"worklet"`.
- **Saved projects** (`projects/projectFile.ts`, version 5) must keep opening. A change that only stops *writing* something (eraser strokes, say) needs no version bump. A change to what's written does.
- **One undo step per tool session** (`beginSession`/`commitSession`), and each stroke is a step inside it.
- **Tuck's product principles** (PRODUCT.md): seconds, not sessions; a utility, not a studio; nothing is final until export.
