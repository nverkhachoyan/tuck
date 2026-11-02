## Verdict

Recommend revised Position B, with medium confidence. B's close splits the shared full-resolution decode between canvas and export, checks it with `node --test`, and drops Playwright and the 16MP import cap. `MAX_PHOTO_PIXELS` resamples once at import, and the editor and export then share that image, so a lower cap changes the file export draws. A preview derivative is the fidelity-safe cut to the ~98MB texture. A's close adds a redaction `SkPicture` cache and UI-thread yielding that do not fix that hitch. Scores are of the closings.

## Criteria scoring

| Criterion | Weight | A | B | C | Note |
| --- | ---: | ---: | ---: | ---: | --- |
| OOM & crash prevention | 30% | 4 | 4 | 2 | A and B keep the stored file and preview smaller. C's 16MP cap resamples it and still leaves ~64MB per layer. |
| Interaction fidelity & frame rate | 25% | 3 | 2 | 2 | A cached backdrop picture goes stale as the photo or zoom changes. Node benches miss the GPU. |
| Engineering cost & maintenance | 20% | 3 | 4 | 4 | Every close dropped Playwright. A still adds picture caches and yield scheduling. B stays inside `node --test`. |
| Diagnostic realism & platform parity | 15% | 4 | 4 | 5 | HUD, `perf.ts`, and device profilers match Hermes, Metal, and Vulkan. Node benches do not. |
| Architectural safety & regression protection | 10% | 3 | 4 | 2 | Export uses the same `decodedImages` entry as the canvas. Disposal tests protect a split. The 16MP cap fails the fidelity constraint. |
| **Weighted total** | **100%** | **3.45** | **3.50** | **2.85** | B's edge over A is cost and safety. |

## Claim ledger

| Claim | Status | Evidence | Note |
| --- | --- | --- | --- |
| A1 | partially refuted | strong | 5712×4284×4 = 97,880,832 bytes. Canvas and `renderDocument` share `decodedImages`. The file comment says 24MP "fit as they are." The two-frame wait is `decodedImages.ts`. |
| A2 | partially refuted | strong | Boxes build a `BackdropFilter` from the live transform. Strokes and masks already store pictures. A static backdrop raster goes stale when the photo or zoom changes. |
| A3 | partially refuted | strong | Autosave waits 500ms. `encodeToBase64` serves thumbnails and the export preview. Gestures run on worklets. |
| A4 | upheld | strong | `package.json` is `node --test` only. No bench script, Playwright, or `perf.ts`. B conceded the V8 and Chromium gap. |
| B1 | partially refuted | strong | `afterSkiaDraws` avoids a freed image. Web export already uses one surface. JS-heap checks miss that texture. B withdrew Playwright. |
| B2 | partially refuted | strong | Those functions are worklets. Nothing shows they spend 8.3ms. An O(N²) hit-test is engine-independent. Matrix benches would not explain a hitch. |
| B5 | partially upheld | strong | Shrinking the shared cache changes the export. No pixel-diff suite exists. B kept disposal tests. |
| C2 | partially upheld | weak | Desktop CI will not Jetsam 100MB. The "~1.4–2GB" figure is not in the repo. |
| C5 | refuted | strong | `reencode` applies the cap before the file is stored. Tests lock 5712×4284 at scale 1. |

## Crux rulings

**Crux 1 — preview split versus a smaller pixel cap.** It hinges on whether `MAX_PHOTO_PIXELS` or a shorter dispose delay can cut memory while export stays intact. Ruling: split the preview from the stored file. The constant is the import cap. Canvas, crop, and export share one decoded copy. A 16MP cap is still ~64MB, leaves saved 24MP projects untouched, and fails Constraint 4. Shortening `afterSkiaDraws` reopens the deleted-image failure the two-frame wait prevents. Keep the stored file, decode a smaller canvas image, and let `renderDocument` acquire the full image and release it in its `finally`. A Jetsam on every 24MP open is not established. The split is still right, because each photo layer multiplies the same buffer. Do not block it on Playwright.

**Crux 2 — worklet microbenchmarks versus GPU-bound hitches.** It hinges on whether UI-worklet CPU regressions justify a Node suite. Ruling: one hit-test scaling bench is worth having. A geometry suite is not a frame-rate plan. `findLayerAt` can walk every stroke segment, so an accidental O(N²) is cheap to lock and engine-independent. Affine helpers are not the budget. The documented cost is `pixelateFilter`: a blur plus two displacement passes, rebuilt from the live transform. Profile that on device.

**Crux 3 — Playwright versus a dev HUD and native profilers.** It hinges on whether headless WebGL checks earn their CI cost. Ruling: they do not. Web export already uses one pooled surface with a 10s idle timer. JS heap size is not the native texture. Add dev-only spans and a HUD, and use Instruments, Perfetto, or Chrome for numbers.

**Missed crux — what a redaction cache may store.** A `SkPicture` of a box backdrop is invalid while the photo or zoom can change. The cache that matches the code is the `ImageFilter` graph for an unchanged effect and transform. Stroke pictures do not transfer to `BackdropFilter`.

## Conditional recommendations

Revised B fits when the next change must shrink canvas textures while stored photos keep their resolution, with disposal locked by unit tests.

A fits if a device trace shows box backdrop filters dominating the frame, and the fix is an unchanged-input filter cache plus yielding around thumbnail and export encoding.

C fits only with the 16MP cap removed. If target phones hold several 24MP layers inside the process limit, and a ~2048px preview looks soft at real zoom, keep today's cache and ship the HUD first.

Original B, suites before any memory change, fits only if the incident is web context loss and native memory is already fine.

## What would change my verdict

Traces of several 24MP layers far under the process limit, plus a visible loss from a 2048px preview at real zoom, would defer the split and favor C without the pixel cap.

A trace where `pixelateFilter` or `BackdropFilter` blows the frame budget, fixed by a filter-identity cache that does not keep a second full-size texture, would pull A's Phase 4 ahead of B.

Proof that some mounted holder requires the canvas and export to be the same `SkImage`, so `renderDocument` cannot decode the file on its own, would drop the split's safety score and reopen C's sequencing.

## Missed by the debate

`MAX_PHOTO_PIXELS` resamples inside `reencode` (JPEG quality 0.92). It is an import cap, not a live preview knob. Canvas and export share `decodedImages`, so A's claim that export ignores the interactive texture is wrong. Autosave and `encodeToBase64` sit off the gesture path. On iPhone, CPU and GPU share one budget, so "VRAM versus JS heap" fits desktop WebGL better than Jetsam. No agent used the comment that 24MP is meant to fit and that the cap exists for 48MP and above.
