# UX direction: drawing, erasing, and marks

The direction agreed on November 5, 2026, judged by what gives the person
using Tuck the best experience rather than by what's easiest to build. Where
it differs from [recommendation.md](recommendation.md) and the debate's
verdicts, this document wins; the section
[What changed from the earlier recommendation](#what-changed-from-the-earlier-recommendation)
says where and why.

It comes from using the current flow on tuck.tools (a receipt screenshot,
circled, annotated with an arrow, highlighted, and boxed, then fixed), and
from checking the prior art that mattered (below).

## What using it showed

- **The eraser follows a rule nobody can see.** With nothing selected it shows no swath and changes nothing, and Undo stays greyed. With a drawing selected, one swipe cut the arrow's tip and passed over the circle beside it without touching it. Once Eraser is open the selection outline is gone, so nothing says only the arrow is in play.
- **Grouping depends on when ✓ was pressed.** Marks drawn in one Pen session move together; marks from separate sessions don't. Nobody can see which is which.
- **Undo is coarser than it looks.** Brushing a rectangle's edge removed it whole, with no fade first and no notice. After ✓, one Undo brought back the rectangle and the arrow tip together: the whole Eraser session.
- **Ink can't be restyled.** A selected rectangle opens Shape with its kind, color, and size, live. A selected drawing offers only Pen and Eraser, so a red circle on a red photo has to be redrawn.
- **The Layers panel can't tell marks apart.** Every drawing is a "Drawing" row with the same icon; the photo row has a thumbnail.

What people think in, across every scenario (circling a total, fixing a stray
tail, trimming a highlight, an arrow and a note, moving a circle that's on
the wrong row), is **marks**: this circle, that arrow, the highlight. Not
strokes, layers, or sessions.

## The behavior

### Marks

A mark is what a drawing layer is today, grouped by how it was drawn instead
of by the tool session.

1. **Strokes drawn one after another, close together, are one mark.** A pause of about a second, or starting somewhere else, starts a new one. An arrow's shaft and head are one mark; a word or short phrase written in one go is one; a circle drawn after a pause somewhere else is another.
2. **Changing the tip or the color starts a new mark.** A mark has one style, which is what lets it be restyled whole.
3. **A new stroke never joins an older mark by itself**, even when it touches it. An arrow drawn to touch the circle it points at leaves the circle alone. Earlier marks change only when the person chooses to (see "A selected mark").
4. **Leaving Pen ends the mark.** Otherwise ✓ plays no part in grouping.
5. **Highlights are marks too.** Scrubbing back and forth over one line is one mark. Two separate highlights that overlap darken where they cross, as real highlighters do (today a session's highlights never darken).
6. **Projects saved before this** open with each existing drawing as one mark.

Pen otherwise draws as it does today, and a tap with it still leaves a dot.

### A selected mark

Tapping a mark's ink selects it: the blue box and handles, and the floating
bar with **Arrange**, **Duplicate**, and **Delete**.

- **Pen** opens showing the mark's tip, color, and size, and changing any of them restyles the mark live, as Shape does for a selected shape. Strokes drawn then join the mark, which is how an arrowhead gets added later.
- **Erase** erases that mark alone (see "Erase on a selected mark").
- **Separate** appears in the floating bar only when the mark has pieces that don't touch, and splits it into one mark per piece. It's the way out when two things were grouped by mistake.
- Shapes, text, stickers, and locked marks don't offer Erase: a shape is erased whole, and the others aren't erased at all.

### Erasing

The Eraser has two options, offered the way Pen offers its tips:

- **Eraser** (the default): erases what's under the swath, pixel for pixel.
- **Stroke eraser**: removes every stroke it touches, whole.

On a phone, Eraser's dock shows them as two buttons; plain Eraser keeps its
size row beside them, and Stroke eraser has no size. On a wide window and on
web they're in the context bar and the tool's ◢ flyout, and the rail's tile
shows which is active. The choice is remembered between sessions, like Pen's
tip.

**What both reach.** Opened from the toolbar (the dock, the rail, or the `X`
key), the Eraser reaches every unlocked mark and shape under it, from any
session, without anything selected first. It never touches photos, text,
stickers, or redactions, brush redactions included: exposing what a
redaction hid is the worst thing it could do. Locked marks are left alone,
and the swath isn't drawn over them, so they read as untouched rather than
broken. Opening the Eraser from the toolbar lets go of any selection, on a
wide window too.

**What the person sees while erasing.**

- **Eraser:** the swath clears ink live, wherever it will clear it. Erased ink can't be tapped afterward; a tap there reaches what's under it.
- **Stroke eraser:** each stroke dims as the finger crosses it, with a light haptic tick on iOS and Android, and goes when the finger lifts. Nothing is removed mid-drag. A tap removes the stroke under the finger, which is how a dot or a short tick too small to scrub gets removed. On web, hovering lights up the stroke a click would remove.
- **Shapes,** with either option, dim as they're crossed and go whole on release.
- **When a whole mark or shape disappears,** the toast says so with an Undo ("Drawing erased · Undo", "Rectangle erased · Undo"), and screen readers hear "Drawing removed" or "Rectangle removed". Ordinary erasing shows nothing.
- **A mark erased into pieces stays one mark** until Separate splits it. A mark erased away entirely is removed, with its row in the Layers panel, in the same step.
- **A stroke the plain Eraser cut in two is still one stroke** to the Stroke eraser: touching one half dims both, and the dimming shows it before the finger lifts.
- **On web,** a ring at the eraser's size follows the pointer over the canvas.

### Erase on a selected mark

Choosing **Erase** from a selected mark's actions (the phone's dock, or the
selection bar in the wide header) opens the Eraser on that mark alone:

- The mark keeps its blue outline. Every other mark and shape dims to about a third, so what's protected looks out of reach. The photo, text, and stickers stay as they are, since no eraser touches them. The dimming is on screen only, never in the file.
- Both options work here.
- **✓** returns to the selected mark. **✕** takes back what was erased. Erasing the mark away removes it, closes the tool, and shows the toast.

This is how a highlight's overhang gets trimmed without nicking the pen
circle drawn over it ("erase the highlight, keep the ink"), and how ink near
other marks gets erased safely, without a setting to remember or Lock to
find. The rule stays short: the toolbar's Eraser erases everything; a mark's
Erase erases that mark.

### Undo

- **While Pen is open,** Undo takes back one stroke, as today. **While the Eraser is open,** one swipe.
- **After ✓,** Undo takes back the last **mark** drawn with Pen, or the last **swipe** with the Eraser, not the whole session. "Undo that arrow" and "undo that erase" both work, and fixing one mistake doesn't throw away the rest.
- **✕** still discards everything done since the tool opened.
- Crop, Adjust, Cut, and the other tools keep one Undo step per session.

### The Layers panel (proposed)

- One row per mark, with a small picture of its ink, and a name from its kind and color: "Red pen", "Yellow highlight", "Blue marker", "Green neon". A color that isn't one of the swatches leaves the kind alone ("Pen").
- Rows hide, lock, delete, and reorder as today. Each mark being a row is also what makes marks reachable without drawing: a screen reader user can find, hide, or delete any of them there.

### One hand, small marks, and the mouse

- The Eraser's options and sizes sit in the dock, in reach of a thumb.
- Small marks under a finger: tap them with the Stroke eraser, select and Delete them, or pinch to zoom in. Crowded spots: Erase on the mark.
- With a mouse, the ring and the hover highlight show what a click or drag will do before it happens.

### Wording

| Where | Text |
| --- | --- |
| Tool | Eraser |
| Its options | Eraser, Stroke eraser |
| A selected mark's actions | Pen, Erase; Separate in the floating bar |
| Toasts | "Drawing erased · Undo", "Rectangle erased · Undo" (and the other shape names) |
| Announcements | "Drawing removed", "Rectangle removed" |
| Layer rows | "Red pen", "Yellow highlight", "Blue marker", "Green neon", or the kind alone |

## Prior art checked for this

How sure each finding is, in brackets.

- **Apple Markup** has a Lasso that selects drawn strokes so they can be dragged, and its Object Eraser removes a drawn line with a tap ([Macworld on iOS 13](https://www.macworld.com/article/233339/ios-13-ipados-13-markup-on-your-screen-captures-and-photos.html); fairly sure it still holds). So the earlier argument against one ink surface, that marks can't be moved apart, doesn't describe Markup. Which eraser is Markup's default wasn't found.
- **Canva** is still unclear. One guide says each continuous stroke becomes its own element and the eraser removes elements with a click ([Shotkit](https://shotkit.com/draw-canva/)); a newer one says you drag to erase parts ([Tella](https://www.tella.com/blog/how-to-draw-on-canva), September 2026). [Low]
- **Google Photos Markup** has Pen, Highlight, and Text, and no eraser, only Undo. The redesign it's testing adds sizes and colors and still no eraser ([Android Authority](https://www.androidauthority.com/google-photos-markup-tools-upgrades-apk-teardown-3709700/), [Android Headlines](https://www.androidheadlines.com/2026/09/google-photos-tests-major-markup-tools-overhaul.html)). [Medium]
- **Telegram** has the drawing set closest to Tuck's, with shapes as separate objects. Its 2022 post names no eraser beyond holding the canvas to erase everything ([Telegram](https://telegram.org/blog/hidden-media-zero-storage-profile-pics)); an eraser in its brush list is remembered, not checked. [Low]
- **Goodnotes and PencilKit** offer both a partial and a whole-stroke eraser ([prior-art.md](prior-art.md)), which is what the two options follow.

## What changed from the earlier recommendation

- **Marks replace one drawing per Pen session.** The session was an accidental grouping nobody could see; the earlier verdicts kept it so sessions stay movable apart, but marks in one session never were.
- **The Stroke eraser ships, not "once there's evidence".** The need is in the basic scenarios: a badly written word, a wonky arrowhead.
- **Selection narrows the eraser, visibly.** The debate removed the Eraser from a drawing's actions because nothing on screen showed the narrowing. Dimming everything else shows it, and it's the only way to erase a highlight without the ink over it.
- **Undo after ✓ is per mark and per swipe**, where the earlier documents named Undo the safety net without noticing it covers a whole session.
- **Ink can be restyled**, which no earlier document raised.
- **Layer rows get a picture of the ink**, not only a label.
- **Kept from before:** the pixel-exact clear eraser (cutting strokes would change how ink looks); erased ink that can't be tapped; emptied drawings removed; shapes dimmed before they go; redactions out of the eraser's reach; the ring on web.

## Open questions

1. **Grouping thresholds.** How long a pause, and how far a jump, starts a new mark. Someone who stops to think mid-sentence splits it into a mark per word, so a longer pause might be allowed when the next stroke starts right beside the mark. Tune on a phone with handwriting, arrows, circles, and highlights.
2. **Does a size change start a new mark?** Tip and color do. Leaning no.
3. **Overlapping highlights darkening.** Check on a phone that it reads as natural rather than as a mistake.
4. **Merging marks a pause split apart.** Today's fix is to select the mark and redraw into it. A real Merge needs multi-select, which belongs to the planned Select tool.
5. **Ink hidden under a photo or sticker** is erased like any other. Leaning yes, for one rule; the cost is a gap found when the photo moves, maybe much later.
6. **An Eraser with nothing to erase**: disabled, or left as it is now that it shows a swath wherever there's ink.
7. **How many marks a document can draw smoothly** (see costs). If a page of handwriting is too slow, what gives.
8. **Canva by hand.** Ten minutes in the app would settle whether its eraser reaches earlier drawings and what a drawing element is.
9. **Remembering the Stroke eraser between sessions.** Decided yes, like Pen's tip; revisit if it surprises people.

## The costs we accepted

Sizes are rough: XS is under a day, S a day or two, M about a week.

- **Grouping by mark** (S). `drawStroke` decides whether a stroke continues the current mark from the time since the last stroke, the distance from the mark, and the style. The time is passed in, not saved. No saved-file change: a mark is a `DrawingLayer`, so projects keep opening as they are. The rule stays plain TypeScript in `layers/drawing/`, tested in Node.
- **More saved layers per frame** (measure). Each drawing is drawn in its own saved layer, which is what keeps the clear eraser inside it and lets a highlight multiply onto the photo (docs/architecture.md, "Straight onto the canvas"). That constraint stays, so more marks means more saved layers. Measure on the iPhone with a page of handwriting before building past the first step.
- **The Eraser reaches every mark, honestly** (S, the earlier ideas 1 and 2). One shared live path across unlocked marks, an eraser-aware `hitTestDrawing`, pruning strokes erased entirely, and removing emptied marks. The crossing test must be generous, or something cleared during the drag comes back on release. Tests that brush redactions are never reached.
- **The Stroke eraser** (S to M). Variants as `penTool.ts` declares them; an edit that drops touched strokes; a crossing test on the UI thread as the finger moves; and the dimming, which needs an optional shared value on `DrawingLayerView` saying which strokes to dim. The `docs/interactive` lessons import that view, so the prop stays optional.
- **Dimming shapes before they go** (XS). `layerTargets` already sends shape outlines to the UI thread.
- **Restyling a mark** (S). `CANVAS_TOOLS.draw.restyles` in `canvas/canvasTool.ts` becomes `"drawing"`, with an edit that recolors or resizes a drawing's strokes, and Pen's panel shows the selected mark's style.
- **Separate** (S). Plain TypeScript: split a drawing's strokes into the pieces that touch, each a drawing with the same transform, recentered.
- **Erase on a selected mark** (S). `eraserSpec.actsOn` stays. Opening the Eraser from a mark's actions keeps the selection and skips `deselectOnDone`, which needs that entry to differ from the toolbar's: today every entry point calls the same `startTool(next)` through `starters` in `useEditorTools.ts`. `drawStroke` already erases only the selected drawing; the new part is dimming the other layers in `EditorScene`.
- **Undo per mark and per swipe** (S to M). `commitSession` in `store/editorSlice.ts` collapses a session's steps into one; for Pen and Eraser it keeps them, merged per mark for Pen. That revisits "one undo step per tool session" (current-model.md) for those two tools, and its store tests.
- **Pictures in the layer rows** (M). On web every Skia canvas is a WebGL context and browsers cap how many a page gets, so a canvas per row won't do. Render the pictures offscreen (`drawOffscreen`, as `renderThumbnail` does for projects) into images.
- **Docs and lessons.** docs/architecture.md's Highlighter paragraph and its undo rule; the interactive Strokes lesson (`docs/interactive/src/lessons/model/StrokesLesson.tsx`), which models one target drawing and teaches that erasing never shrinks the box.

Hard constraints, and what this does to each:

- **Straight onto the canvas**: unchanged.
- **Each drawing is a saved layer**: kept; there will be more of them.
- **Plain TypeScript for the model**: grouping, Separate, restyling, and pruning all live in `layers/`.
- **One undo step per tool session**: revisited for Pen and Eraser only.
- **Saved projects**: no format change.

A sensible order, if it's built in steps: the Eraser reaching every mark
honestly (every direction needed it); then marks, restyling, and Separate;
then the Stroke eraser; then Erase on a mark; then Undo per mark and swipe;
then the layer rows.
