# Smart selection spike: Segment Anything on web and phones

Measured October 2026, for stage 2 of `docs/smart-selection-plan.md`: can a promptable model select any object from a tap in Tuck's web app, fast enough and well enough to be worth its download?

## What was tried

* **MobileSAM** (Apache 2.0 weights; the ONNX export in `Acly/MobileSAM` on Hugging Face, MIT): `mobile_sam_image_encoder.onnx` takes the image resized to 1024 on its longer side (HWC, 0–255) and normalizes and pads it itself (the native work below fixed it at a padded square). `sam_mask_decoder_multi.onnx` takes points in that 1024 space and returns 4 masks at the original size, with a predicted IoU for each.
* **SlimSAM-77, int8** (Apache 2.0; `Xenova/slimsam-77-uniform`, transformers.js's export).
* **MagicTouch version 1**, as Cut out runs it on web today, given the same tap.

All three ran in the browser with `onnxruntime-web` 1.30.0 (MediaPipe for MagicTouch), single-threaded: the site isn't cross-origin isolated, so WebAssembly gets no threads. Eight taps on four photos: Segment Anything's own samples (a dog with a person holding a bowl, groceries in a car's boot, a truck) and the G20 group photo in `public/`. Timings come from headless Chrome over CDP on an Apple M1 MacBook (the Browser pane throttles a hidden page, and WebGPU stalled there).

## Timings

| | Load | Encode a photo (once) | Each tap |
|---|---|---|---|
| MobileSAM, WebGPU | 0.8 s + 0.3 s | 0.7–1.0 s | 45–70 ms (one at 210) |
| MobileSAM, WebAssembly | 0.7 s + 0.3 s | 2.8–3.0 s | 150–175 ms |
| SlimSAM int8, WebGPU | 0.5 s + 0.2 s | 3.9–6.9 s | 155–285 ms |
| SlimSAM int8, WebAssembly | 0.4 s + 0.1 s | 4.9–5.4 s | 130–140 ms |
| MagicTouch v1 (today) | 0.1–0.2 s | – | 120–190 ms, the whole model each time |

A phone is slower than an M1, likely several times over on WebAssembly, so the encoder belongs in a worker, started as soon as Pick opens, while the person looks at the photo. After that, a tap answers about as fast as MagicTouch does now, or faster with WebGPU: fast enough to follow a finger that's still on the screen.

## What each selected

| Tap on | MobileSAM | SlimSAM int8 | MagicTouch v1 |
|---|---|---|---|
| The dog | The dog, clean edges | The dog, with specks of noise around its head | The dog |
| The bowl | The bowl | The bowl | The bowl |
| The jeans | The whole person | The legs | The person and the bowl |
| One grocery bag | That bag | That bag | **The whole car** |
| A tail light | The tail light | The tail light | **The whole car** |
| The woman in red | Her jacket and head | Her jacket | Her jacket |
| The logo on the floor | The logo | The logo | The logo |
| The truck's window | The window | The window | **The whole truck** |

MagicTouch, like Vision's and ML Kit's subject masks, looks for the salient object around a point, so a tap on part of a car gets the car. Segment Anything selects what's under the tap at the scale it judges likeliest: one bag, a tail light, a window. That's the difference stage 2 is for.

Its likeliest isn't always the one meant: the woman in red came back as her jacket and head. SAM's decoder returns several masks for a tap, from a part to the whole, so the tool should let a second tap on the same spot grow the selection to the next one, and a tap with the other mode (or a long press) take something away. Picking by the highest IoU alone isn't enough.

SlimSAM's int8 export is smaller (14 MB against 45), but its encoder was slower on both backends, and its masks have speckles of noise. It's ruled out.

## Downloads

| File | Size | gzip |
|---|---|---|
| MobileSAM encoder (fp32) | 28.2 MB | 21.5 MB |
| MobileSAM decoder, 4 masks (fp32) | 16.5 MB | 15.2 MB |
| `onnxruntime-web` WebAssembly with WebGPU (`jsep`) | 28.3 MB | 6.7 MB |
| `onnxruntime-web` WebAssembly only | 14.2 MB | – |

About 45 MB of models, on top of the 31 MB of MediaPipe the site already serves. They'd load on the first Pick, not with the app, and be cached by the service worker with the version that first used them, as the face and MagicTouch models are. An fp16 or int8 MobileSAM encoder would halve or quarter that; it needs exporting and its masks checking (SlimSAM's int8 masks suffered).

## What shipping it on web needs

* **Loading.** `onnxruntime-web`'s module imports its WebAssembly glue with a computed path, which Metro rejects (the same problem MediaPipe has). Load its script build (`ort.min.js` or `ort.webgpu.min.js`, which define a global `ort`) from `public/` with a `<script>` tag, as `mediaPipe.ts` does, and import only its types.
* **CSP.** Nothing new: the models and WebAssembly come from the site itself (`connect-src 'self'`), `'wasm-unsafe-eval'` is there already, and WebGPU needs no directive.
* **Threads.** Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `vercel.json`) would let WebAssembly use threads, likely cutting the 3-second encode to about one second where WebGPU isn't available. Everything the site loads is its own, so it may cost nothing, but check the share target and file handlers first.
* **The service worker** precaches `public/` by version; the models should be cached on first use instead, like the detection engines.

## Not measured

* **Hair and fur.** The masks here look clean at the scale of these photos. SAM's masks come from a 256×256 grid scaled up, so a portrait's hair at full size is the case to check, with the decoder run again on a crop around the subject if it's soft.
* **Memory in browsers.** The page held about 130 MB of JavaScript heap with all three models loaded; MobileSAM alone, in a worker that's released when Cut out closes, should be well under that.
* **Android on a phone.** Only the emulator ran it (see below).

## Recommendation

Go ahead with MobileSAM for stage 2, on web first, behind Cut out's Pick:

1. Encode the photo in a worker when Pick opens, with WebGPU where it's available and WebAssembly otherwise.
2. A tap selects; another tap on the same spot grows the selection through SAM's masks; Erase mode's taps (or a long press) subtract. Keep MagicTouch until the model has downloaded, so the first tap still works.
3. Write the selection as the layer's `mask`, as Pick does now, so the Keep and Erase brushes refine it the same way.

Then run the native spike before deciding whether iOS and Android use MobileSAM or keep their platforms' subject masks.

## Native

Measured October 2026, after web shipped: the same two models in the iOS and Android apps, with ONNX Runtime (1.30 on iOS, through CocoaPods' `onnxruntime-objc`; 1.31 on Android) run from Swift and Kotlin in `image-analysis`, on an iPhone 17 Pro Max (A19 Pro) and Android's emulator on an M-series Mac. Every number is from a Debug build; times are from opening Pick or from a tap, on the truck photo above and a phone photo.

### Fitting the encoder to Core ML

ONNX Runtime hands Core ML only the nodes whose shapes are fixed. The export takes any height and width, so Core ML got 566 of its 647 nodes in 34 pieces, and ran them slower than ONNX Runtime's CPU. Two changes to the file, which every platform now shares:

* **A fixed 1024-pixel square** (`onnxruntime.tools.make_dynamic_shape_fixed`, then `onnxsim`). The image goes at the square's top left, padded with ImageNet's mean, which the encoder normalizes to zero, as its own padding did: the embeddings are identical.
* **Five-dimensional window reshapes.** That left TinyViT's window partitioning, 20 reshapes to six dimensions (Core ML takes five at most) and the 40 nodes after them, as 21 pieces. Their first dimension is always 1, so dropping it from each reshape and its transpose changes nothing (the embeddings are identical again), and Core ML takes all 541 nodes as one model.

Web's masks for the same taps didn't change.

### iPhone 17 Pro Max

| Encoder on | Load (cached) | Encode |
|---|---|---|
| Core ML, GPU, one piece | 57 ms | 66–68 ms (138 the first time) |
| Core ML, GPU, 21 pieces | 114–168 ms | 88–130 ms |
| Core ML, every unit, 21 pieces | 1.3 s | 90–114 ms |
| Core ML, Neural Engine, 21 pieces | 1.2–1.3 s | 307–402 ms |
| ONNX Runtime's CPU | 68–70 ms | 412–464 ms |

The decoder stays on the CPU, since its output's size follows its input's values: 21–30 ms. The GPU it is.

* **Compiling.** Core ML compiles the model the first time a session loads it: 3.6 seconds. `ModelCacheDirectory` keeps the result (104 MB in Caches) under the file's `COREML_CACHE_KEY`, so it survives app updates; loading it again takes 57 ms in the same process, but about 3 seconds in a freshly launched one. So the first Pick after a launch is ready in about 3 seconds and later ones in about a quarter of one; taps go to Vision until then.
* **A tap** takes 44–47 ms in Swift (decode 22, turning three masks' logits into coverage 5, writing them as PNGs 17), 75–80 ms as JavaScript sees it. Turning logits into coverage and pixels into floats one value at a time took 175–230 ms in Debug Swift; Accelerate does both in a few milliseconds.
* **Memory.** Encoding raised the app's footprint by 263–360 MB in one piece, against 1.1 GB in 21, where each piece was a Core ML model with buffers of its own. Releasing it gives most of that back.
* **What it selected.** A wheel of the mail truck by itself, an exhaust plume, and the car parked behind it, none of which Vision's subject mask offers.

### Android emulator

An arm64 Android 16 image with 2 GB of memory, then 6 GB once the app was being killed for memory; nothing here says much about a phone's speed.

| | Read a photo | Native memory kept |
|---|---|---|
| ONNX Runtime's CPU, arena on | 2.3–2.5 s | +583 MB |
| ONNX Runtime's CPU, arena off | 1.8–2.0 s | +57 MB |
| XNNPACK | 2.6–2.8 s | +1.1 GB |

* **The arena** (ONNX Runtime's pool of what it allocated) kept the encoder's half a gigabyte after it ran, and made nothing faster; it's off.
* **A tap** took 140–160 ms back to back in a benchmark, mostly the decoder (100–160 ms), and 1.2–1.4 s in the app with seconds between taps, with nothing swapped out. A phone has to say which is real. Working out each pixel's sigmoid took 0.8 s for three masks in Kotlin; a 1,025-entry table does it in 18 ms, within a level of gray. Android's PNG encoder takes only color bitmaps and was slow at this size, so the masks are written as 8-bit gray with a fast deflate.
* **Telemetry.** ONNX Runtime 1.31 on Android logs that its telemetry is unavailable, so it has some; `ObjectSelector` turns it off (`setTelemetry(false)`).

### Size

The models add 44 MB to each app. Android's arm64 ONNX Runtime library is 34 MB before the store compresses it. iOS links ONNX Runtime statically; its Release size isn't measured.

### Outcome

MobileSAM serves all three platforms from one encoder file. On the iPhone it's faster than on web, answering a tap in under a tenth of a second; Android works, at a speed only a phone can judge.
