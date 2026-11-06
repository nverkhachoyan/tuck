# Drawing, erasing, and marks

How to build the direction in
[ux-direction.md](../../brainstorming/drawing-layers/ux-direction.md), in nine
steps. Its decisions stand; this plan only orders the work and says where it
lands in the code. Written November 5, 2026, at `361d9a4`.

The brainstorm's [current-model.md](../../brainstorming/drawing-layers/current-model.md)
and [ideas.md](../../brainstorming/drawing-layers/ideas.md) describe the code
at `e0b07fb`. Nothing under `src/` has changed since (the commits after it are
docs), and their claims were checked against the files they name. Two things
they don't say, which the steps rely on:

- Pen and Eraser share one canvas tool kind, `draw` (`canvas/canvasTool.ts`), told apart only by `brush.type`. Anything keyed on the kind (`CANVAS_TOOLS[...].restyles`, `canAddTo`, the live stroke) applies to both. Step 1 gives the Eraser a kind of its own, `erase`.
- `hitTestDrawing` (`layers/strokes.ts`) is shared with brushed redactions through `findLayerAt`. Making it skip erased ink (step 1) also lets a tap pass through where a redaction's brush was uncovered, which is right for the same reason.

## Decided while planning

- **Separate splits by whole strokes.** The plain Eraser never cuts a stroke, so a stroke erased through its middle stays one stroke, and Separate keeps its two halves in one mark (it doesn't appear for them). Splitting them needs idea 4's cutting, which the direction turned down. Excalidraw's Ungroup draws the same line. Proposed change to ux-direction.md's "Erasing" list: "A mark erased into pieces stays one mark; Separate splits it only where its strokes don't touch."
- **The toolbar's Pen lets go of the selection**, as its Eraser does: the toolbar's Pen starts new marks, and a mark's Pen restyles and adds to that mark. Proposed addition to ux-direction.md's "A selected mark": "Pen from the toolbar (the dock, the rail, or `D`) lets go of any selection first, as the Eraser does."

## The steps

| Step | Size | Needs | What can ship after it |
| --- | --- | --- | --- |
| [1. The Eraser reaches every mark](01-eraser-reach.md) | M | — | An Eraser that works without selecting, shows its swath, never brings ink back, and says when a whole mark or shape goes. A drawing's actions lose Erase until step 2. |
| [2. Erase on a selected mark](02-erase-on-mark.md) | S | 1 | Erase back in a drawing's actions, narrowed to it, with everything else dimmed. |
| [3. Measure saved layers](03-measure-marks.md) | S | 1 | Nothing ships; it decides whether step 4 goes ahead as written. |
| [4. Marks](04-marks.md) | M | 3 | Strokes grouped by pause, distance, and style rather than by session. Toolbar Pen starts fresh; a mark's Pen adds to it. |
| [5. Restyle a mark](05-restyle.md) | S | 4 | A selected mark's Pen shows and changes its tip, color, and size. |
| [6. Separate](06-separate.md) | S | 4 | Separate in the floating bar for a mark with pieces that don't touch. |
| [7. The Stroke eraser](07-stroke-eraser.md) | M | 1, 2 | Eraser's two options, with strokes and shapes dimming as they're crossed. |
| [8. Undo per mark and per swipe](08-undo-per-mark.md) | S | 4 | After ✓, Undo takes back one mark or one swipe. |
| [9. Pictures and names in the layer rows](09-layer-rows.md) | M | 4 | "Red pen" rows with a picture of their ink. |

Steps 5 and 6 can go in either order, or together. Step 7 needs only 1 and 2,
so it can come before marks if marks wait on the measurement; step 8 and 9
need marks for their meaning, not their code, and could ship on today's
session-sized drawings if they had to.

### Why the order differs from the direction's

The direction suggests: the Eraser's reach; marks, restyling, and Separate;
the Stroke eraser; Erase on a mark; Undo; the layer rows. This plan moves
**Erase on a mark** up to step 2 and adds the measurement as step 3:

- Step 1 makes the toolbar's Eraser reach everything. A drawing's Erase action opens the same tool, so between step 1 and Erase on a mark it would erase other marks the person never chose. Step 1 takes the action away; step 2 brings it back narrowed. Keeping that gap to one step means it can ship with step 1, or soon after.
- Erase on a mark needs nothing from marks or the Stroke eraser: it narrows the Eraser to the selected drawing, whatever made it. When the Stroke eraser comes, it honors the same scope.
- The direction asks for the measurement "before building past the first step". Erase on a mark adds no saved layers, so it can go before it; marks are what multiply them.

## Open questions, and the step that settles each

From ux-direction.md's list. A step doesn't start until the questions named
for it are answered; the direction's lean is the default if nothing else
comes up.

| Question | Settled | How |
| --- | --- | --- |
| 1. Grouping thresholds | Before step 4 ships | Tuned on a phone (step 4's "Tuning"). Step 4 starts with the defaults there. |
| 2. Does a size change start a new mark? | Before step 4 starts | Decides `continuesMark`'s style test, and whether step 5 restyles size per mark or per stroke. Lean: no. |
| 3. Overlapping highlights darkening | Before step 4 ships | A phone check in step 4. If it reads as a mistake, two highlights within the pause join one mark whatever the distance. |
| 4. Merging marks | Not here | Needs multi-select, which belongs to the Select tool (follow-ups §4). |
| 5. Ink under a photo or sticker | Before step 1 starts | Lean yes: the Eraser reaches it like any ink, and step 1 needs no occlusion test. |
| 6. An Eraser with nothing to erase | Before step 1 starts | The direction states no lean; this plan assumes it stays enabled, showing a ring on web but no swath when there's nothing to erase. Disabling it would add a check to the toolbar entry. |
| 7. How many marks draw smoothly | Step 3 | Its result, and the fallbacks it lists. |
| 8. Canva by hand | Optional, before step 7 | Ten minutes in the app; nothing waits on it. |
| 9. Remembering the Stroke eraser | Step 7 builds it | Revisit only if people are surprised. |

## Saved projects

No step changes what's saved. A mark is a `DrawingLayer`, Separate and
restyling write ordinary drawings, pruning only drops strokes, and the
Eraser's option and Pen's thresholds are preferences or constants.
`PROJECT_VERSION` stays 5. Step 1 and step 4 each add a test to
`projects/__tests__/projectFile.test.ts` that a version 5 project saved before
the change (a session drawing with several strokes, styles, and eraser
strokes) reads back unchanged, and step 4 checks by hand that such a project
opens with each drawing as one mark.

## Follow-ups this overlaps

[follow-ups-plan.md](../follow-ups-plan.md) §4 has two entries this touches:

- **Layer row polish** asks for three things. Step 9 covers "a way to tell several 'Drawing' rows apart". It leaves the Duplicate action in `LayerRow` and the Layers toggle on short wide windows.
- **A Select tool** is untouched, but it inherits open question 4 (merging marks) and the stroke-level selection this plan doesn't build.

Proposed edit, not made:

```diff
-* **A Select tool** that picks layers and objects by finger or cursor (the name was kept free for it).
+* **A Select tool** that picks layers and objects by finger or cursor (the name was kept free for it). With several marks selected it's where Merge goes (ux-direction.md's open question 4, docs/brainstorming/drawing-layers/).
@@
-* **Layer row polish**, from the same brainstorm: a Duplicate action in `LayerRow` (it's only in the selection bar and ⌘D now), a way to tell several "Drawing" rows apart, and the Layers toggle staying reachable on wide windows under 960 points tall while a tool is open.
+* **Layer row polish**, from the same brainstorm: a Duplicate action in `LayerRow` (it's only in the selection bar and ⌘D now), and the Layers toggle staying reachable on wide windows under 960 points tall while a tool is open. Telling "Drawing" rows apart is step 9 of [drawing-layers](drawing-layers/README.md).
```

Once this plan is built and removed, the same entry loses its link.

## Checks every step runs

`pnpm check`, `pnpm typecheck`, `pnpm test`, and
`pnpm --dir docs/interactive build`. `pnpm build:web` where a step changes
`.web` files or imports TypeScript doesn't check; each step says. Manual
checks are on web at 390 and 1440 points wide and on the iOS simulator, and
each step lists what only a phone can check. Projects in the simulators and
the local web app are test data.
