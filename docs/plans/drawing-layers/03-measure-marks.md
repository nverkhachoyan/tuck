# 3. Measure saved layers

How many drawings, each in its own saved layer, the canvas draws smoothly on
an iPhone and on web with a page of handwriting. Marks (step 4) make more of
them, and step 1 already draws the live eraser into every one. Size S.
Nothing ships; the result goes at the end of this file and decides step 4.

Settle first: nothing. This settles open question 7.

## The test page

A page of handwriting is about 150 words. Grouped as step 4 means to, that's
one mark per word or short phrase, so 100 to 200 marks; someone who pauses
between letters makes several hundred.

On a throwaway branch, not committed:

1. Record real strokes once: write a sentence with Pen on the iPhone and log each finished stroke (`JSON.stringify` in `usePenTool`'s `finishStroke`).
2. A `__DEV__` button in `shell/DevHud.tsx`, "Add test marks", builds a document over a 1170×2532 photo: copies of the recorded words in lines down the page, each word its own `DrawingLayer` (`createDrawingLayer` plus `addStroke`). Counts of 50, 100, 200, 400, and 800. One mark in four gets an eraser stroke through it; one in ten is a highlighter.
3. The same documents with every mark's saved layer removed for ink without erasers (`DrawingLayerView`'s `Group layer` off when the drawing neither multiplies nor has an eraser stroke), to know what the first fallback below would buy.

## What to measure

For each count:

- **Pinch and pan** across the page for five seconds.
- **A live pen stroke**: a slow scribble for five seconds.
- **A live eraser swipe** across the page with the toolbar's Eraser (the swath in every drawing).
- **Moving a selected mark** by dragging it.

Where:

- **iPhone**: a Release build (`pnpm expo run:ios --configuration Release --device <udid>`, see docs/development.md) on the oldest iPhone at hand, and the iPhone 17 Pro Max. Frame rate from React Native's performance monitor overlay (UI thread), and dropped frames by eye on a slow-motion screen recording if the overlay disagrees with what's seen. Instruments is unreliable with a mirrored phone (development.md).
- **Web**: the production export (`pnpm build:web`, served by the `web-export` configuration) in Chrome at 390 and 1440 points wide, on the Mac and on the Linux laptop's integrated GPU. Frame times from the Performance panel, or a `requestAnimationFrame` counter run with the browser pane shown (a hidden pane runs at two frames a second; headless Chrome over CDP otherwise).

Smooth means no stretch below 55 frames a second on a 60 Hz screen, or 100 on
a 120 Hz one, during the four actions.

## What the plan does with the result

- **200 or more marks smooth on both**: step 4 goes ahead as written.
- **Fewer**, in this order, each re-measured before the next:
  1. **A saved layer only where one is needed.** A drawing needs its own layer only to keep an eraser's clear inside it or to multiply as a whole. Ink with no eraser strokes draws the same straight onto the canvas: every stroke is source-over, and the layer would composite at full opacity, so the pixels match. `DrawingLayerView` sets `layer` only when the drawing multiplies or has an eraser stroke (and when dimmed, step 2). Size XS. It changes the direction's "Each drawing is a saved layer: kept" into "each drawing that erases or multiplies", so it needs your OK first. A Marker drawing (`tip: "ink"`, 45%) still darkens where its strokes cross either way, since each stroke is its own path.
  2. **The live eraser only where it can reach**: `strokeReaches` also skips drawings whose padded box the stroke's box so far doesn't reach. Changes only step 1's cost.
  3. **Longer thresholds** in step 4, so a page makes fewer marks. Trades against people's wish to move words apart.
  4. If none is enough, step 4 stops and comes back to you: what's left (rasterizing settled marks between other layers) touches "Straight onto the canvas".

## Docs

None in the code. Write the result here, with the device, build, counts, and
frame rates, and a line in the README's table.

## Checks

None; nothing is committed but this file.

## Result

Measured 2026-11-05 on the M1 Mac, without the iPhone, in place of the
plan above:

- **Test page:** generated, not recorded: a 1170×2532 white page of words of three to five wavy pen strokes (5 wide), one mark in four with an eraser stroke through it, one in ten a single highlighter stroke (34 wide, multiplying). The bench (local branch `bench/marks`, not merged) adds the page from buttons in the dev HUD.
- **Actions:** scripted rather than by hand, five seconds each: the view panned in a loop (`pan`), a live pen stroke growing a point a frame (`pen`), a live eraser sweeping the page in rows with every drawing reached (`erase`). Moving a mark redraws the same scene as panning, so it wasn't run apart.
- **Frame rate:** a Reanimated frame callback on the thread that draws (the UI thread on iOS, the page's main thread on web), averaged over the run; "worst" is the slowest quarter second.
- **Web:** the production export (`pnpm build:web`, `web-export`) in headless Chrome 157 on ANGLE Metal (M1), at 1440×900 ×2 and 390×844 ×3, driven over CDP. 60 Hz.
- **iOS:** the iPhone 17 Pro simulator (iOS 26.5), development build, `pan` only (the HUD's row ran off the screen). The simulator draws with the Mac's GPU, so it shows how cost grows with the count, not how a phone copes.
- A blank page held 60 fps everywhere.

Besides the plan's fallback 1 (`lite`), the bench tried bounding each
drawing's saved layer (`bounded`): wrapping its `Group layer` in a `Group`
clipped to its box, padded by its ink's reach, so Skia allocates and
composites a layer the size of the drawing instead of the whole canvas.
Today's layer has no bounds, so every drawing costs a full-canvas offscreen
pass however little ink it has. Bounding keeps "each drawing is a saved
layer" as it is.

Web, 1440×900 ×2, average fps (pan / pen / erase):

| Marks | As built | Fallback 1 | Bounded | Bounded + fallback 1 |
| --- | --- | --- | --- | --- |
| 50 | 11 / 11 / 10 | 42 / 33 / 33 | 59 / 60 / 60 | 60 / 60 / 58 |
| 100 | 6 / 6 / 5 | 24 / 24 / 18 | 60 / 60 / 59 | 60 / 60 / 58 |
| 200 | 4 / 3 / 3 | 10 / 10 / 7 | 59 / 60 / 46 | 59 / 60 / 43 |
| 400 | 2 / 2 / 1 | 7 / 7 / 4 | 37 / 34 / 26 | 35 / 36 / 25 |
| 800 | 1 / 1 / 0.5 | 3 / 3 / 2 | 19 / 17 / 14 | 20 / 19 / 15 |

Web, 390×844 ×3: as built 23 / 26 / 15 at 50 marks and 7 / 5 / 3 at 200;
bounded 60 / 60 / 60 at 50, 60 / 60 / 49 at 200, and 38 / 34 / 26 at 400.

iOS simulator, `pan`, average (worst):

| Marks | As built | Bounded | Bounded + fallback 1 |
| --- | --- | --- | --- |
| 50 | 40 (20) | 60 (56) | |
| 200 | 9 (7) | 37 (30) | 58 (48) |
| 400 | | | 34 (29) |

What it says:

- **As built, saved layers don't scale at all:** 50 marks already drop below 30 fps on web and 40 on the simulator. Today's session-sized drawings are few, so it doesn't show yet; marks would.
- **Bounding is the fix, and keeps the direction's model:** on web it holds 60 through 200 marks for panning and drawing, and fallback 1 adds nothing on top. Past 400, what's left grows with the number of drawings, not the pixels (the same rates at both canvas sizes).
- **On iOS each saved layer costs something even when small** (a render pass on Metal): bounded alone reaches 37 at 200, bounded with fallback 1 58.
- **The live eraser is the slowest action:** 200 bounded marks erase at 46 to 49 on web, since its path is drawn into every drawing. Fallback 2 (draw it only where its box reaches) is aimed at exactly this.

Decision for step 4, pending your OK on fallback 1 and a check on a phone:

1. Bound each drawing's saved layer to its box, as a change of its own before step 4. A drawing taking a live pen stroke draws unbounded while it does, since the stroke can reach past its box.
2. Fallback 1, a saved layer only for a drawing that multiplies or has an eraser stroke (or is dimmed), for iOS. It needs your OK, as it changes "each drawing is a saved layer".
3. Fallback 2, the live eraser only in drawings its box reaches.
4. Then step 4 as written. A Release build on an iPhone should confirm 200 marks with 1 and 2 before marks ship.
