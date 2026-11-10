# Editor audit: synthesis and plan

Written November 9, 2026, at `da0d580`. It replaces the audit and its debate, which were committed in `4585f97` and removed once this was built: it keeps what survived the debate, the two judges, and a check of the judges' own claims against the code, and turns that into steps. Remove this file once its steps are built, as with other plans.

## Part 1: Synthesis

### The outcome in one paragraph

The audit was right about where the costs are (stroke hit-testing on the UI thread, the Stroke eraser's dimming, rebuilt paths when a stroke lands) and wrong about much else: it cited a file that doesn't exist, said things stay mounted that unmount, and proposed a memoization sweep that can't save a render in an editor with no `React.memo`. The debate converged on Position B (small fixes, each backed by a test or a measurement) with Position C's discipline (correct the record, file what's left). The judges then showed that three of the fixes all debaters agreed on would not work as written. What's left is two small fixes to land now, one fix to build only after a measurement, one optional hardening, and a few issues.

### Verdict on each finding

| Audit finding | Verdict | Evidence at `da0d580` |
| :--- | :--- | :--- |
| `Editor.tsx` memoization is defeated; memoize `editorContext` and stabilize tool callbacks | **Rejected** | No `React.memo` anywhere in `src/editor`, so children re-render with `Editor` whatever the references. Gestures run on shared values, not renders. Conceded by all three debaters. |
| Idle tool hooks do work on every edit | **Rejected** | `useCropTool` memoizes `fit` on `settled`, which doesn't change while Crop is closed; `useAdjustTool` syncs only when its values change. |
| Fold Cut/Remove BG variants and Adjust's target into `ToolSpec` | **Not pursued** | Readability only, no runtime gain, and it reworks tool contracts that the tool-definitions work settled recently. Revisit if a third grouped tool appears. |
| `recenterDrawing` gives every stroke a new identity, so `pathFor`'s cache rebuilds every path when a stroke lands | **Real, overstated** | `strokes.ts:91-108`, `DrawingLayerView.tsx:60-69`. Judge 1 measured identity loss on 199 of 199 adds for handwriting moving rightward, 46 of 199 for scattered strokes, and none for strokes inside the existing extent. It happens once per landed stroke, not per frame. `pathFor` also serves brushed redactions (`RedactionLayerView.tsx:231`) and image masks (`ImageLayerView.tsx:191`). Nobody has measured the cost. |
| Polyline walkers (`segmentsNear`, `alongLine`, `eachAlong`) and box helpers are duplicated | **Real debt, not a prerequisite** | `strokes.ts:208`, `drawingEdits.ts:246`, `drawing.ts:199`; boxes at `strokes.ts:48`, `drawing.ts:173`, `drawingEdits.ts:60` and `:283`. The walkers stop on opposite return values. No fix needs them unified first. |
| `strokesHitBy` has no box check before walking segments | **Upheld** | `strokes.ts:332-355` runs on each pointer update from `useToolStroke.ts:238` and on each hover move from `:296`. `hitsPen` (`:252`) starts with `nearLine`, a walk of every point in every pen stroke, for each sample. |
| `StrokeErasedDrawing` mounts one mapper per stroke | **Upheld, and worse on web than the judges said** | `LiveStrokeOverlay.tsx:268-323`. Judge 1 said the mappers rerun only when the dimmed list changes. But `hoveredStroke` (`useToolStroke.ts:296`) returns a new object on every mouse move, and `dimmedStrokes` returns a new array (`[...touched, hovered.index]`) whenever something is hovered, so on web every stroke's mapper reruns on every mouse move over ink. |
| Live redaction rebuilds its picture and filter on each move; bound it by the document | **Re-recording is real; the bounds fix is wrong** | `LiveStrokeOverlay.tsx:443-476`. The picture records layer space (centered, padded by the filter's reach), not `(0, 0, width, height)`, so document bounds would clip it. Null bounds on a saved layer already follow the current clip, so bounding saves little. Pre-recording old marks must keep them and the live stroke in one `DstIn` mask layer. Already tracked as a phone check in [#46](https://github.com/nverkhachoyan/tuck/issues/46). |
| `drawOffscreen.web.ts` frees its surface mid-readback | **Refuted as argued; small residual gap** | At Skia 3.9.0, web `makeRasterImage` reads back inside the Promise executor (`JsiSkImage.js:110-116`), so sizing, drawing, snapshot, and readback all run in one synchronous stretch. What's left: after the readback resolves, `snapshot.dispose()` runs a microtask later, when another caller resuming from `drawAsPicture` could have freed the context. Unreproduced. |
| `drawingPieces` and `pruneErased` redo bounds work | **Minor** | Judge 1 said `LayerSelectionBar.tsx:61` calls `drawingPieces` unmemoized on every render. It does call it, but `drawingPieces` caches by its strokes array (`drawingEdits.ts:328`), so the pairwise work runs once per edit to a selected drawing, and `inkTouches` already rejects pairs by box. |
| `LayersPanel` keeps rows mounted while closed | **False on phones; true in the wide inspector** | `LayersPanel.tsx:109,128` mount on `open`. But `EditorInspector.tsx:33` renders it with `open` always set when the inspector is pinned, so each landed stroke redraws that mark's thumbnail (cached by strokes and size, so only the changed mark). Note it; measure it with the rest. |
| `StaticLayerRow` carries drag hooks; `Dial` re-renders its ticks per step; `TextStylePanel` duplicates `ColorPicker`'s HSV logic | **Real, off the hot path** | File as issues. |
| `sameDocument` uses `JSON.stringify` | **Dropped** | It runs only after every layer matches by reference, on a small `groups` array, and its comment says why groups compare by content. |
| `document.layers.find` inside `targets.flatMap` | **Dropped** | Once per document change, over at most a few hundred layers. |
| `sampleColor.ts` calls `drawOffscreen` | **False** | No such file; `sampleColor` lives in `renderDocument.tsx:73`. Also, `defineTool.ts` and `builtInSpecs.ts` are in `src/editor/`, not `tools/`. |

### Fixes everyone agreed on that wouldn't work

All three closings proposed these, and the judges caught them. Each is checked here against the code.

1. **Key the path cache by stroke ID.** `MaskStroke` (`strokes.ts:14-18`) has no ID, and adding one changes the saved format (hard constraint 5).
2. **Translate cached paths with `SkPath.offset`.** At Skia 3 an `SkPath` is immutable and has no `offset`; only `SkPathBuilder` has `offset` and `addPath(path, matrix)` (`PathBuilder.d.ts:146,166`). Cached paths are shared, so they must never be changed in place anyway.
3. **Draw dimmed strokes in one group and the rest in another.** `DrawingLayerView` draws strokes in index order, and an eraser (`blendMode: "clear"`) clears only what was drawn before it. Regrouping changes paint order and brings erased ink back.

### What carries forward

- Act only on what the code shows today. A performance change needs a test that pins its behavior and a number that justifies it; where the number can only come from a phone, the step adds to an existing `needs device` issue rather than waiting on it.
- Keep refactors out of performance PRs. Unifying the walkers is worth doing, but as its own change with no behavior change.
- `recenterDrawing` and the saved stroke format stay as they are. A fix may add a side table in memory, never a field on disk.

## Part 2: Plan

Steps 1, 2, and 4 are independent and touch different files, so they can go in any order or in parallel. Step 3 waits on step 0's numbers. Each step ends with `pnpm check`, `pnpm typecheck`, and `pnpm test`; the steps that say so also need `pnpm build:web` or a browser check. The user commits each step; each step suggests a commit message.

### Step 0: Measure first

Get the numbers steps 3 and 5 depend on, in headless Chrome on the local web app (the Browser pane, or CDP when it's hidden):

- **Commit cost:** in one drawing, draw 200 strokes moving rightward (the case that recenters on every add), and time from the stroke landing to the next frame with a temporary `performance.now()` around `pathFor` misses in `DrawingLayerView`. Note the miss count per landing.
- **Stroke eraser hover:** with 200 strokes, hover the Stroke eraser over ink and record frame times from a performance trace.
- **Wide inspector thumbnails:** with the inspector pinned, the time `renderMarkThumbnail` takes per landing.

Remove the timing code afterward. Write the numbers into this file under each step. Native costs differ (each `quadTo` is a JSI call on iOS), so add the commit-cost and eraser cases to [#95](https://github.com/nverkhachoyan/tuck/issues/95) and [#97](https://github.com/nverkhachoyan/tuck/issues/97) as a comment.

Measured November 9, 2026, in headless Chrome 157 on the M1 Mac against the development server (`pnpm expo start --web`, development build), 1280×860, at 60 fps. Strokes were drawn as 30-point squiggles 40 px long, each starting 3–4 px right of the last, so all 200 joined one mark and every landing recentered it.

- **Commit cost:** every landing rebuilt every path, as predicted: 20,100 `pathFor` misses over 200 landings (1 + 2 + … + 200). The rebuild cost 0.27 ms per landing at strokes 1–20, 1.31 ms at 91–110, and 2.03 ms (p50 2.0, max 2.6) at 181–200. The worst frame within 250 ms of each landing was 16.8 ms in every band with the inspector closed: no landing dropped a frame. Below the 4 ms threshold, so step 3 becomes an issue.
- **Stroke eraser hover** (180 mouse moves at 60 Hz along the 200-stroke mark, main-thread time from `Performance.getMetrics`): 8.6 ms per move over ink after steps 1 and 2, 8.6–9.0 ms before them, and 1.4–1.5 ms off ink either way. Frame times: p50 16.7 ms, p95 16.8 ms, at most one 33 ms frame in 360. A CPU profile puts nearly all of it in CanvasKit replaying the drawing, because in a mark this dense the hovered stroke changes on almost every move, and each change redraws all 200 strokes; hit-testing doesn't show in the top 25. A mouse resting on one stroke with sub-pixel jitter costs 1.4 ms per move after the steps and 1.6 ms before. In an 8-stroke drawing, 30 moves over one stroke reran the per-stroke opacity mappers 240 times before step 2 and 16 times after.
- **Wide inspector thumbnails:** with the layers inspector pinned, `renderMarkThumbnail` took 10 ms per landing (wall time, asynchronous: picture, offscreen draw, readback, PNG) at strokes 1–20, 23 ms at 91–110, and 33 ms (max 42) at 181–200. The first thumbnail of a 200-stroke mark took 60 ms, with the offscreen surface made. One landing in the 181–200 band had a 33 ms frame; none did with the inspector closed.

### Step 1: Box check in `strokesHitBy` (land now)

Files: `layers/strokes.ts`, `canvas/useToolStroke.ts`, `layers/__tests__/strokes.test.ts`.

- Add `strokeBoxes(strokes)` to `strokes.ts`: each stroke's box, padded by half its width, cached by the strokes array in a `WeakMap` (as `drawingBox` is). It runs on the JS thread only.
- Give `strokesHitBy` an optional `boxes` parameter. When given, `hitsPen` skips any stroke whose box, padded by `padding`, doesn't hold the sample, before `nearLine` walks it. Without it, behavior is unchanged, so `eraseWholeStrokes` (`drawingEdits.ts:185`) keeps working as is and still agrees with the canvas.
- In `useToolStroke.ts`, compute the boxes in the `strokeTargets` memo (a worklet can't read the JS `WeakMap`) and pass them from both `onSegment` and `hoveredStroke`. Keep `"worklet"` on anything the UI thread calls, declared above its callers.
- Test: for random strokes with erasers, `strokesHitBy` gives the same indexes with and without boxes, for taps and swipes.

Built in `6904b35`. On web it barely shows in step 0's dense mark, where most strokes' boxes hold the sample anyway; its saving grows as ink spreads out, and on a phone, where hit-testing runs on the UI thread.

Commit: `perf(eraser): skip strokes whose box a stroke-erase sample misses`

### Step 2: Rerun the dimming mappers only when the dimmed set changes (land now)

Files: `canvas/useToolStroke.ts`, `canvas/LiveStrokeOverlay.tsx`.

- Make `hoveredStroke` a shared value written from `useAnimatedReaction`, and write it only when the hovered layer or index changes, so it stops being a new object on every mouse move.
- Do the same for `dimmedStrokes` in `StrokeErasedDrawing`: write it only when its contents change.
- Leave `DimmedStroke` and paint order alone. Its mappers now rerun when a stroke gets dimmed or undimmed, not on every move.
- Check in the browser: hover over and off strokes and swipe across them with the Stroke eraser; dimming, the click-to-take preview, and erasers drawn after the dimmed strokes all look as before.
- If step 0 or #97 still shows the per-stroke mappers costing frames once this lands, the next option keeps paint order: wrap contiguous runs of undimmed strokes in one group each. Not part of this step.

Built in `eaaf70d` and checked in headless Chrome (hover, held swipe, and an eraser drawn after the dimmed strokes). Step 0 found what's left is CanvasKit redrawing the drawing when the hovered stroke changes, not the mappers, so grouping runs of undimmed strokes wouldn't help on web; #97 decides for phones.

Commit: `perf(eraser): redo the Stroke eraser's dimming only when what's dimmed changes`

### Step 3: Keep cached paths when a drawing recenters (only if step 0 shows it)

Not built: step 0 measured 2.0 ms per landing at 200 strokes, under the 4 ms bar. Now [#109](https://github.com/nverkhachoyan/tuck/issues/109), with the numbers and the design, waiting on a phone check in #95.

### Step 4: One queue for the shared offscreen surface (optional hardening)

Files: `render/drawOffscreen.web.ts`, `render/markThumbnail.tsx`.

- Run each `drawOffscreen` call after the one before it in a module promise chain, catching each call's failure so one bad render can't stop the rest. Calls never nest, so the chain can't deadlock.
- Remove `markThumbnail`'s own queue and keep its cache.
- Explain in the comment that it closes the gap between the readback and `snapshot.dispose()`, and that the surface is now owned in one place. Don't say readback is asynchronous: at Skia 3.9.0 it isn't. If a Skia upgrade makes web readback truly asynchronous, this becomes a correctness fix.
- `pnpm build:web` (a `.web` file), then export a project and open the layers panel while a thumbnail is drawing.

Built in `a4085fe`; `pnpm build:web` passes, and in headless Chrome a mark's thumbnail and the export preview started in the same task both drew, with no errors.

Commit: `fix(web): draw offscreen renders one at a time`

### Step 5: Live redaction (measure on a phone; no code now)

Added to [#46](https://github.com/nverkhachoyan/tuck/issues/46#issuecomment-6759301798). Step 0's web numbers went to #95 and #97 as comments.

### Step 6: Issues and cleanup

Filed, each pointing here:

- [#105](https://github.com/nverkhachoyan/tuck/issues/105) Unify the stroke walkers and box helpers in layers
- [#106](https://github.com/nverkhachoyan/tuck/issues/106) Static layer rows still set up dragging (`StaticLayerRow` makes two shared values and `LayerRow` two more, its pan gesture, and its animated style, though a static row renders no handle)
- [#107](https://github.com/nverkhachoyan/tuck/issues/107) The text style panel repeats the color picker's HSV logic
- [#108](https://github.com/nverkhachoyan/tuck/issues/108) The dial re-renders its whole tick strip on each step
- [#109](https://github.com/nverkhachoyan/tuck/issues/109) Landing a stroke rebuilds every path in a recentering drawing (step 3)

The audit and its debate are removed.

### Not doing

The `Editor.tsx` and `useEditorTools` memoization sweep, gating idle tool hooks, the `ToolSpec` rework, bounding live redaction by the document, the two-group dimming split, stroke IDs, and the `sameDocument` and `layers.find` changes. Reasons are in the verdict table.
