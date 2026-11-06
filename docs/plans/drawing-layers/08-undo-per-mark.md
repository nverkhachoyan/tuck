# 8. Undo per mark and per swipe

After ✓, Undo takes back the last mark drawn with Pen, or the last swipe with
the Eraser, not the whole session. Every other tool keeps one undo step per
session. Size S, the lower end of the direction's S to M: the store already
keeps each stroke as a step inside the session, and `commitSession` is what
throws them away.

Settle first: nothing.

## What the person sees

- While Pen is open, Undo takes back one stroke; while the Eraser is open, one swipe. As today.
- After ✓ on Pen, each Undo takes back one mark, newest first. After ✓ on the Eraser, each Undo takes back one swipe. Redo brings them back in order.
- Undo after ✓ doesn't select anything the session didn't start with.
- ✕ still discards everything since the tool opened, as one step Redo can bring back.
- Crop, Adjust, Cut, Shape, Redact, Find, Text, and the others keep one step per session.

## The edits

### Store

`store/editorSlice.ts`:

- `EditorSession` gains `steps: "one" | "each" | "marks"`.
- `beginSession(previews = false, steps = "one")` keeps it.
- `commitSession()`:
  - `"one"`: as today.
  - `"each"`: keeps the session's steps in `past` as they are (a swipe each).
  - `"marks"`: keeps one step per mark: from the session's steps (the snapshots in `past` after `undoStop`, then the current document), drops each "before" snapshot whose following step continued the same mark, so a mark's strokes undo together. A step's mark is the `selectedLayerId` after it (the store selects the mark a stroke went into, step 4); a restyle of the mark it was opened on counts as that mark.
  - Either way, the kept snapshots take the session's starting `selectedLayerId`, so Undo after ✓ doesn't select the previous mark. `future` is cleared, as today.
  - A session longer than `MAX_HISTORY` keeps what's left, as `pastBefore` does now.
- `cancelSession()`: unchanged; it already returns to the session's start and pushes the whole session as one redo step.
- New pure helper beside `pastBefore`: `stepsByMark(steps: EditorSnapshot[], current: EditorSnapshot): EditorSnapshot[]`.

### Tools

`toolSpec.ts`: `ToolSpec` gains `undoSteps?: "each" | "marks"`, documented
in its comment. `tools/pen/penSpec.ts`: `"marks"`. `tools/eraser/eraserSpec.ts`:
`"each"`.

`useEditorTools.ts`: `useToolSession(tool, reopened, previews, steps)` passes
the spec's `undoSteps` to `beginSession`.

`useEditNotice.ts`'s `undo`: when it closes and reopens an empty session for
the notice's Undo, it reopens with the same `previews` and `steps` (read from
the session before committing), or Pen would fall back to one step.

`docs/interactive/src/lessons/store/SessionsLesson.tsx`: its button calls
`onClick={actions.commitSession}`, which would now pass the click event as
the first argument if `commitSession` ever took one. It takes none in this
design, but wrap it (`() => actions.commitSession()`) while touching the
lesson.

## Tests

`store/__tests__/editorSlice.test.ts`, in the sessions block:

- "a Pen session keeps one undo step per mark": three strokes into mark A, then two into new mark B; commit; Undo removes B whole, Undo again removes A whole, Redo brings A then B.
- "an Eraser session keeps one undo step per swipe": three swipes, commit, three Undos each restore one.
- "undo after a kept session restores the starting selection": nothing selected at start; after commit and Undo, `selectedLayerId` is null.
- "restyling the mark it opened on joins that mark's step".
- "canceling a kept session still restores its start as one redo step" (as "redo brings a canceled session back as one step").
- "a kept session that changed nothing leaves the history alone".
- "a kept session longer than the history keeps what fits".
- "undo stops at the session's start" and "redo stops at the session's start" for `"each"` while open.
- The existing "committing makes a session's changes one undo step" and "undoing within a session, then drawing again, still commits one step" stay for `"one"`.
- `stepsByMark` directly: consecutive steps of one mark merge; A, B, A (a second run on A after B) stays three.
- `__tests__/defineTool.test.ts` or a spec test: only Pen and Eraser declare `undoSteps`.

## Docs and lessons

- docs/architecture.md: the `store/` bullet ("its changes become one undo step when it's done" gains: "except Pen's, one per mark, and the Eraser's, one per swipe (`undoSteps`)"); the spec bullet lists `undoSteps`.
- `docs/interactive/src/lessons/store/SessionsLesson.tsx`: its title "A tool is one undo step" and the Done step's text get the exception for Pen and Eraser; the `onClick` above.
- `docs/interactive/src/lessons/store/HistoryLesson.tsx`: check its text for "one step per tool"; change it if it says so.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`.

## By hand

Web at 390 and 1440, and the iOS simulator:

- Circle a total, pause, draw an arrow, ✓. Undo: the arrow goes, the circle stays, nothing is selected. Undo: the circle goes. Redo twice: both back.
- Erase three times, ✓, Undo once: the last swipe comes back only.
- Pen, draw, ✕: everything since it opened is gone; Redo brings it back as one.
- Crop, then Undo: the whole crop, as before.
- The toast's Undo after a whole mark is erased, with the Eraser still open and after ✓: one swipe back each time.

Only a phone: nothing beyond the simulator's checks.
