# 4. Marks

Strokes group into marks by pause, distance, and style, not by Pen session.
Size M: S for the rule, as the direction says, plus the stroke times from the
gesture, the toolbar's Pen letting go, and tuning on a phone.

Settle first: step 3's result (go ahead, or which fallback), and open
question 2 (does a size change start a new mark; lean no). Before shipping:
open questions 1 (thresholds) and 3 (overlapping highlights).

## What the person sees

- Strokes drawn one after another, close together, in one tip and color, are one mark: an arrow's shaft and head, a word or a short phrase. A pause of about a second, or starting somewhere else, starts a new one.
- Changing the tip or the color starts a new mark (and the size, if question 2 says so).
- A new stroke never joins an older mark by itself, even touching it.
- Leaving Pen ends the mark; ✓ has no other part in grouping.
- Two highlights made apart darken where they cross; scrubbing back and forth over one line stays one mark and doesn't.
- The toolbar's Pen (dock, rail, `D`) lets go of any selection first. A selected mark's Pen keeps it: strokes then join that mark, as long as they match its style (step 5 makes Pen show its style).
- Projects saved before open with each drawing as one mark. A tap with Pen still leaves a dot.

## The edits

### The rule (plain TypeScript)

New `layers/drawing/marks.ts`:

- `MARK_PAUSE_MS` (1000), `MARK_NEAR_PAUSE_MS` (2000), `MARK_GAP` (6 stroke widths), `MARK_NEAR_GAP` (1.5 stroke widths): starting defaults, tuned below.
- `type LastStroke = { markId: string; endedAt: number }`.
- `sameStyle(a: Brush, b: Brush)`: tip and color equal (width too, if question 2 says so).
- `continuesMark(mark: DrawingLayer, last: LastStroke | null, stroke: Stroke & { type: "pen" }, startedAt: number): boolean`. True when `last.markId` is `mark.id`, the mark is unlocked, `sameStyle` holds with its last pen stroke, and the stroke's first point, in the mark's space, is within `MARK_GAP` of its visible ink (eraser-aware `hitTestDrawing`) with a pause up to `MARK_PAUSE_MS`, or within `MARK_NEAR_GAP` with a pause up to `MARK_NEAR_PAUSE_MS`. Times are passed in, never saved.
- `markGap(mark, last, stroke, startedAt)`: the pause and distance, for the tuning log.

`layers/drawing/drawingEdits.ts`: `drawStroke(document, joinId, stroke)` joins
`joinId` when it's an unlocked drawing that blends the same way
(`strokeBlend`/`layerBlend`, as today), or starts a drawing on top. It no
longer reads the selection: the caller decides.

### Times from the gesture

`canvas/usePaintGesture.ts`: records `Date.now()` in `onBegin` and in
`onFinalize`, and passes both to `onStroke`.

`canvas/useToolStroke.ts` and `canvas/canvasTool.ts`: the `draw` member of
`ToolStroke` gains `startedAt` and `endedAt`. `strokeIntent` carries them.

### Store

`store/editorSlice.ts`: `drawStroke(stroke, joinId)`. `selectionAfter` still
selects a new mark, so the next stroke can ask about it.

### Pen

`tools/pen/usePenTool.ts`:

- Takes `open` and `on` from `ToolEnv`.
- Keeps `last: LastStroke | null` in a ref, cleared whenever `open` goes false, so leaving Pen ends the mark.
- `finishStroke`: with `on` set (opened from the mark), joins `on.id` while `sameStyle` holds; otherwise joins `last.markId` when `continuesMark` says so; otherwise starts a new mark. Records `last` from the selection the store leaves.
- In `__DEV__`, logs `markGap` for each stroke, for tuning.

`tools/pen/penTool.ts`: `startsUnselected: true` (step 1's field), so the
toolbar's Pen lets go of the selection. `deselectOnDone` stays, skipped when
opened from a mark (step 2).

`tools/pen/penSpec.ts`: `actsOn` takes unlocked drawings only.

## Tuning

On the iPhone, in a development build with the `__DEV__` log, and by
hand on web with a mouse and a trackpad:

1. Write a sentence at your own pace, then one stopping to think mid-sentence. Draw five arrows (shaft, then head), five circles around words then an arrow to each, a highlight scrubbed over one line, two highlights crossing, and a quick list of ticks.
2. Read the log's pauses and gaps. Within a word, and between a shaft and its head, should sit under the thresholds; between a circle and the arrow drawn to it, and between separate highlights, above.
3. Change the constants and repeat until every case groups as the direction says. If one pause can't separate them, that's what the near pause is for.
4. Record the chosen values and the cases' outcomes in this file, and turn the cases into tests in `marks.test.ts` with their measured times.

Question 3: draw two highlights crossing, a second apart, on a phone in
daylight. If the darker crossing reads as a mistake, the fix is a rule in
`continuesMark` (highlights within the pause join whatever the distance),
not a model change.

## Tests

- New `layers/drawing/__tests__/marks.test.ts`:
  - An arrow's shaft and head 300 ms apart, head at the shaft's end: one mark.
  - A circle 1.5 s after, elsewhere: a new mark.
  - A stroke touching an older mark, after a pause: a new mark.
  - A stroke right after, but `MARK_GAP` away: a new mark; within `MARK_NEAR_GAP` after a pause under `MARK_NEAR_PAUSE_MS`: the same mark.
  - A color change, a tip change: a new mark; a size change: as question 2 decides.
  - `last` naming another mark, or a locked mark: never continues.
  - A stroke starting on ink the eraser cleared isn't "near".
  - The tuning cases, once recorded.
- `layers/drawing/__tests__/drawingEdits.test.ts`: `drawStroke` joins `joinId` when it blends the same way; starts a new drawing for `null`, a locked drawing, a missing id, or a different blend. The existing "joins the selected drawing" tests move to `joinId`.
- `store/__tests__/editorSlice.test.ts`: "a stroke starts a selected drawing on top, and the next joins it" passes the id; "a stroke with another layer selected starts a new drawing" becomes "a stroke with no mark to join starts a new drawing"; "each stroke is an undo step" unchanged.
- `canvas/__tests__/strokeIntent.test.ts`: a `draw` stroke keeps `startedAt` and `endedAt`.
- `__tests__/defineTool.test.ts` or `editorChrome.test.ts`: Pen and Eraser both start unselected from the toolbar.
- `projects/__tests__/projectFile.test.ts`: a version 5 project whose one drawing holds a pen, a highlighter, and a neon stroke (one old session) reads back as one drawing, unchanged.

## Docs and lessons

- docs/architecture.md: the Highlighter paragraph ("`drawStroke` joins the selected drawing only when the stroke blends the same way" becomes the mark rule, with `marks.ts`; "two highlights darken where they cross only when each is its own layer" stays true and now happens); `layers/`'s `drawing/` folder lists `marks.ts`; `pen/`'s `startsUnselected`.
- `docs/interactive/src/lessons/model/StrokesLesson.tsx`: the "Draw anywhere" step says `drawStroke` starts a drawing "with no drawing selected"; it becomes "with no mark to continue", naming `continuesMark`. The lesson keeps one target drawing: say a drawing is a mark.
- The brainstorm stays as it is.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Write "total due" in one go: one row in the Layers panel. Pause a second and circle a number elsewhere: a second row. Draw an arrow touching the circle: a third, and the circle unchanged.
- Switch to Highlighter mid-run: a new row; back to Pen: another.
- Select the circle, Pen from its actions: a stroke joins it. ✓, then the rail's Pen (wide) or `D`: the selection goes, a stroke starts a new mark.
- Two highlights over one line a few seconds apart: the crossing darkens. Scrubbing back and forth: one row, no darkening.
- Open a project saved before this change: every drawing is still there as one row, drawn the same.

Only a phone: tuning itself, handwriting with a finger at real speed, and question 3 in daylight.
