# Performance plan

Final sequencing for Tuck's performance work. It follows the judge in [judges/judge-1/synthesis.md](judges/judge-1/synthesis.md) (revised Position B, medium confidence). Where this file disagrees with [plan.md](plan.md) or [synthesis.md](synthesis.md), this file wins.

The work is a preview/export split for photo textures, a dev-only HUD and spans, and one hit-test scaling test. It does not add a benchmark suite, a browser harness, or a redaction picture cache.

## Decision

Canvas and export currently decode the same project file through `decodedImages`. A 24MP iPhone photo is 5712×4284, and `photoScale.ts` keeps it (`MAX_PHOTO_PIXELS` is 25,000,000). Uncompressed, that bitmap is 97,880,832 bytes, about 98MB, and every photo layer holds one.

`MAX_PHOTO_PIXELS` is the import cap inside `reencode` (`photoImport.ts`), applied before the file is stored. Lowering it resamples the file export draws. `photoScale.test.ts` locks 5712×4284 at scale 1. The cap stays.

`afterSkiaDraws` waits two frames so a canvas still showing the previous recording does not draw a freed image (`decodedImages.ts`, and the deleted-image failure in `docs/GOTCHAS.md`). The wait stays.

Export fidelity means `renderDocument` keeps decoding each layer's stored `uri`. The canvas decodes something smaller. During export the full bitmap is acquired and released in the `finally` that already wraps `renderDocument`. It is not kept for editing.

## Out of scope

- Playwright, or any headless WebGL memory suite. `drawOffscreen.web.ts` already draws through one pooled surface with a 10s idle timer. A JS heap number is not the native texture.
- A geometry, color, or document-edit microbenchmark suite. Those functions are worklets and nothing shows they spend an 8.3ms frame. Node runs V8, not Hermes.
- Lowering `MAX_PHOTO_PIXELS`, or freeing images sooner than `afterSkiaDraws`.
- An `SkPicture` of a box redaction. Boxes draw a `BackdropFilter` from `redactionFilter(effect, transform)`. The backdrop depends on the photo underneath and on zoom, so a static raster goes stale. Stroke and mask redactions already record pictures. That does not transfer.
- Treating autosave or `encodeToBase64` as a gesture hitch. Autosave waits 500ms. Encoding runs for thumbnails and the export preview. Drawing gestures run on worklets.
- MobileSAM threading, COOP/COEP, and the other ML items in `plan.md`. They were not part of this decision.
- A claim that opening one 24MP photo Jetsams the process. The comment in `photoScale.ts` says those photos fit, and that the cap exists for 48MP and above. The split is for documents that hold several of those buffers at once.

## Facts the change has to respect

- `decodedImages` is one `SkImage` per URI, shared by the canvas, the crop tool, and export (`decodedImages.ts`). Two resolutions means two URIs. A size flag on the same cache entry would hand export the preview, or the canvas the full file.
- `ImageLayerView` draws with `fit="fill"` into `imageBox(layer)`. A smaller bitmap still lands on the layer's own width and height. Layer geometry, `layer.uri`, and `PROJECT_VERSION` stay as they are.
- Files not named by `imageFiles(document)` are removed when a project closes (`projectLifecycle.ts`). A preview stored beside `original.jpg` and omitted from the document would be deleted. The preview lives in a cache outside the project directory.
- `photoScale(photo, maxPixels, maxShortSide, maxLongSide)` already encodes a long-side cap. The preview uses it. No second formula.
- Zoom allows one document pixel to become 8 screen pixels (`MAX_PIXEL_SCALE` in `viewport.ts`), or at least 4× the fit. No preview that saves memory stays sharp at that maximum. Softness at deep zoom is a canvas-only difference. Export stays full resolution.
- On iPhone, CPU and GPU share one budget. The HUD's byte count is `width × height × 4` of decoded bitmaps, not a Metal allocation and not `performance.memory`.

## Preview size

`PREVIEW_LONG_SIDE` starts at **4096**.

A 5712×4284 photo scales to 4096×3071, about 12.6 million pixels, about 50MB uncompressed, roughly half of today's buffer. The canvas stays sharp while one document pixel is at most `4096 / 5712` screen pixels (about 3.6× past fit on a 3× phone). Further zoom is softer than the file. That is accepted.

2048 (about 13MB, soft from roughly 1.8× past fit) is only the fallback if a device trace shows 4096 still exhausts the process with a few photo layers. Do not start there. Do not put the full file back on the canvas to chase `MAX_PIXEL_SCALE`.

An image whose long side is already at most 4096 has no preview. The canvas and export then share the stored file, which is the right outcome for stickers and small screenshots.

## Sequence

### 1. Dev HUD and spans

Add `src/platform/perf.ts` (and `perf.web.ts` only if the web API actually differs). It wraps `performance.mark` and `performance.measure` when `__DEV__` is set and the methods exist, and does nothing otherwise. Hermes may not implement User Timing. A missing method is a no-op, not a thrown error. No network, no new `connect-src`, nothing in the release path beyond the `__DEV__` check Metro already folds out.

Mark `tuck:image-decode`, `tuck:render-document`, and `tuck:export-encode` around the work already in `decodeImage`, `renderDocument`, and the `encodeToBase64` calls in `renderThumbnail` and the export preview. No SAM or detection spans in this change.

Mount a HUD from the editor shell only when `__DEV__` is set. It shows frame time, how many images `decodedImages` holds, and the estimated bitmap bytes. Add a dev-only snapshot on the cache for that count. `platform/` cannot import the editor, so the HUD stays in the shell and the span helper stays in `platform/`.

### 2. Canvas preview, full file for export

Generate the preview with `ImageManipulator`, the same resize `photoImport.ts` already uses, and `photoScale(image, Infinity, Infinity, PREVIEW_LONG_SIDE)`. Write it to the cache keyed by project id and image file name. Never rewrite the stored file. JPEG at the importer's quality when the source is opaque, PNG when it is not.

Build the preview when the project opens, once per file whose long side exceeds 4096. The manipulator's full-size buffer is released before the canvas decodes anything. Steady state for editing is the preview texture only. Opening an existing project takes the same path. There is no `PROJECT_VERSION` bump.

Thread a display URI into the canvas without writing it back onto the stored document:

- `EditorScene` and `CropCanvas` load an image layer's photo from the preview URI when one exists. Masks stay on their own files. A mask is a matte aligned to the image, and it is not resampled here.
- `LayerContent` keeps taking a URI. The scene passes the preview URI in. The layer in the store still names the stored file.
- `renderDocument` and `sampleColor` keep `decodeImageLayers` on the stored URIs, and still release in `finally`. The eyedropper spike is accepted: it asks for the pixels export would write.
- `renderThumbnail` decodes previews, so closing a project does not pull every 24MP file back into Skia. The thumbnail is a card image, not the export.
- The cut tool may acquire the stored URI while it is open, then release. For that stretch the preview and the full file can both be alive. Leave that unless a device trace says the sum is the problem.

Update the comments that say the editor and export each hold the photo decoded in full (`photoScale.ts`, `maxNewImageShortSide` in `image.ts`, the cache note in `decodedImages.ts`). Those comments become false once the canvas holds the preview.

### 3. One scaling test

Add one Node test, picked up by the existing `pnpm test` glob, for `findLayerAt` over 100 layers and for a stroke hit test over a long point list. Fail only on a wide ceiling (a complexity blow-up, not a frame budget). No `pnpm bench` script, no `geometry.bench.ts`, no color bench, no document-edit bench.

`imageCache.test.ts` already covers shared decodes and the delayed free. Extend it only if the preview work adds a cache behavior those tests do not lock. Do not shorten the two-frame wait to make a test faster.

### 4. Device check, then only what it shows

On a phone with a few 24MP layers, read process memory with Instruments or the Android profiler, and zoom past the point where the 4096 preview stops being 1:1 with the screen.

- Memory still climbs without bound on two or three layers, and the preview is acceptable: drop `PREVIEW_LONG_SIDE` toward 2048 and recheck softness.
- The preview is too soft at zooms people actually use, and memory is comfortable: raise the long side, or stop and keep one shared decode. That is the judge's condition for deferring the split. It is a result of this check, not a reason to skip the implementation.
- A Metal or Perfetto trace shows `pixelateFilter` or the box `BackdropFilter` spending the frame: cache the `ImageFilter` when the effect and the layer transform are unchanged. Do not record the backdrop into an `SkPicture`. Do not keep a second full-size texture to do it.
- A trace shows `encodeToBase64` or the autosave stringify hitching the export sheet or project close: yield around that work. Do not yield the gesture path. It is not on the JS thread's autosave timer.

## Tests and checks

- `photoScale.test.ts` still expects 5712×4284 and 4032×3024 to stay at scale 1 under `MAX_PHOTO_PIXELS`, and 8064×6048 to shrink.
- A new pure test for the preview cap: a 5712×4284 image at `PREVIEW_LONG_SIDE` 4096 scales by `4096 / 5712`, and a 2000×1500 image stays at 1.
- A project test: opening and closing does not rewrite `original.jpg`, and the unused-file sweep still removes only files `imageFiles` does not name. The preview cache is not one of those files.
- A render test: the document passed to `renderDocument` still names stored URIs after the canvas has substituted previews.
- `pnpm test` for the new pure tests. `pnpm typecheck` and `pnpm check` for the editor and platform files. `pnpm build:web` if a `.web.ts` is added.

## Docs

Update `docs/architecture.md` only if a new module's responsibility is not obvious from the list (the preview cache's home, and that the canvas decodes it while export decodes the stored file). Leave `docs/interactive` alone unless a lesson imports a signature this change actually edits.
