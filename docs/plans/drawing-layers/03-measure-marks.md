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

Not measured yet.
