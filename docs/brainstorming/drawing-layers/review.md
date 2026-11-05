# Review

Three reviewers read the first draft (the commit before this file), each
with one job: check every claim against the code and test the proposals for
feasibility; judge the fit with Tuck's users and principles; and argue for
what the draft rejected. This file records what they found and what
changed. Where a finding was declined, it says why.

## What changed the recommendation

- **Step 1 alone left a confusing state.** An eraser that reaches every drawing empties more drawings, and `hitTestDrawing` ignores eraser strokes, so people would tap where they erased and select a drawing they can't see. The draft fixed that only with vector erasing (step 2), as an option. *Changed:* a new idea 2, "make erasing honest", keeps the pixel-exact clear eraser and fixes taps, emptied drawings, and boxes in the model. It ships with idea 1 as step 1.
- **Cutting strokes is costlier than the draft said.** The draft's description of the cut ends was backwards: with the reach it proposed, round caps don't poke into the swath, they over-erase ink near the cut, a lot at shallow angles. Square caps (Highlighter, Marker) do poke in. `strokePath` draws curves through midpoints, so cutting the points leaves hooks unless the curve is flattened first. A cut Marker loop darkens where its pieces overlap, a neon glow spreads back into the swath, and the ink jumps when the finger lifts. *Changed:* cutting strokes became idea 4, moved to "later, only if needed", with these listed.
- **Split vector erasing; do the cheap half first.** Removing whole strokes needs none of the cutting geometry. *Changed:* the stroke eraser is its own idea (3) and step 2.
- **The partial eraser should stay the default**, since once the eraser reaches every drawing, the stroke eraser is the destructive one. Variant names follow the short nouns Pen and Cut use: **Eraser** and **Stroke eraser**, not "Erase parts" and "Erase strokes", which read like buttons under a tile.
- **"Continue the drawing on top" was dismissed too quickly.** It's tiny, it keeps rows from piling up instead of tidying them later, and it's the version of the ink sheet that keeps stacking. *Changed:* it's in step 3, to try on a phone in two forms (join only the top layer, or skip shapes, which puts new strokes under them), and Merge down moved to later.
- **Merging had two missed problems.** Eraser strokes in the upper drawing would clear the lower drawing's ink once merged, and two highlighter drawings don't merge exactly (highlights darken where they cross only as separate layers). *Changed:* merging is for ink drawings without eraser strokes.
- **Auto-grouping each session has a hidden cost.** Any group switches the Layers panel to `GroupedLayerList`, whose rows can't be dragged to reorder. *Changed:* listed under "Also considered" with that reason, and noted in current-model.md, since Find's groups already do this today.

## What changed the details

- **The live swath doesn't match the result exactly.** Neon glows, square-cap corners, and the drawn curve reach past the crossing test. *Changed:* pad the test generously.
- **Fading shapes needs a UI-thread test**, which the draft said wasn't needed. `erasesShape` and `shapeOutline` aren't worklets; `layerTargets` already sends outlines to the UI thread. *Changed:* idea 1 says so. Likewise `nearLine` isn't exported, and fading single strokes means a shared value in `DrawingLayerView`, which lessons import.
- **Performance.** Each drawing's `LivePath` would rebuild the same path on every pointer move. *Changed:* build it once and share it, and skip drawings by their cached box.
- **UX details the draft left out**: a brush ring on web, the edit notice when a swipe removes a whole drawing or shape, screen-reader announcements, a haptic tick with the fade, how locked ink looks under the swath, disabling the Eraser with nothing to erase, and the selection outline that the Pen-to-Eraser switch leaves behind. *Changed:* a "Details" section in recommendation.md.
- **"Lock to protect" isn't discoverable**: Lock is only in the Layers panel. *Changed:* Undo is named as the real safety net.
- **Open question 2's reason was wrong.** A swath cleared in a covered drawing shows nothing, so the preview implies nothing. *Changed:* the reasons are that it's rare and keeps one rule, and the cost (a gap found much later) is named.
- **Missing from "What building it touches"**: `shapeGeometry.test.ts`, `eraserSettings.test.ts`, the eraser's variant hooks, `layerTargets.ts`, `DrawingLayerView`/`LayerContent`, and the Strokes lesson's single-target model. *Changed:* added.

## Corrections to the facts

- current-model.md used the code's tip names; the UI calls tip `marker` Highlighter and tip `ink` Marker. *Changed* to the UI's names, with "blends the same way" defined once.
- `drawStroke` also joins a hidden selected drawing (it checks only `locked`); Redact and Find also set `deselectOnDone`; `LiveStroke` is declared in `LiveStrokeOverlay.tsx`; and only Done deselects. *Changed.*
- "Draw session" really meant a Pen session, and switching tips or adding shapes adds rows too. *Changed.*
- Uniform scale was asserted without a reason. *Changed:* current-model.md says why it holds (resize mode, aspect-locked scaling, `rebaseTransform`).
- prior-art.md overreached. Lesson 1 named whiteboards as photo markup tools and left out Snagit, the closest product, which has no eraser for marks. Lesson 2 said no markup tool erases the image, which the doc's own Excalidraw entry contradicts. Lesson 3 said Figma ships both erasers, which the sources don't show. Lesson 4 presented a guess about Goodnotes as fact. Snapchat's eraser was unverified, and Procreate's Layer Select is a gesture artists set up. Canva's entry claimed its model is Tuck's while calling itself uncertain. *Changed:* all of these, and Canva became open question 5, to check by hand.

## Declined or left open

- **Narrowing the eraser to a selected drawing opened from its actions** (the devil's advocate wanted it as the default; the product review wanted the fallback dropped). Left as open question 1, to try on a phone, leaning toward no narrowing.
- **Shipping idea 5 together with step 1** (the devil's advocate). Kept in step 3: erasing is the complaint, and idea 5 changes what a layer holds, which is easier to judge once erasing no longer depends on it.
- **A reviewer suggested filing an issue for Find's groups turning off reordering.** That may be intended, so it's recorded in current-model.md for the owner to decide, not filed.
