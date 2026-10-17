# Smart selection spike: Segment Anything on web

Measured October 2026, for stage 2 of `docs/smart-selection-plan.md`: can a promptable model select any object from a tap in Tuck's web app, fast enough and well enough to be worth its download?

## What was tried

* **MobileSAM** (Apache 2.0 weights; the ONNX export in `Acly/MobileSAM` on Hugging Face, MIT): `mobile_sam_image_encoder.onnx` takes the image resized to 1024 on its longer side (HWC, 0–255) and normalizes and pads it itself. `sam_mask_decoder_multi.onnx` takes points in that 1024 space and returns 4 masks at the original size, with a predicted IoU for each.
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

* **Native.** ONNX Runtime's iOS (Core ML) and Android (XNNPACK, NNAPI) libraries, run from Swift and Kotlin in `image-analysis`, on a real phone. That's the next spike, and it decides whether MobileSAM serves all three platforms or only web.
* **Hair and fur.** The masks here look clean at the scale of these photos. SAM's masks come from a 256×256 grid scaled up, so a portrait's hair at full size is the case to check, with the decoder run again on a crop around the subject if it's soft.
* **Memory on phones.** The page held about 130 MB of JavaScript heap with all three models loaded; MobileSAM alone, in a worker that's released when Cut out closes, should be well under that.

## Recommendation

Go ahead with MobileSAM for stage 2, on web first, behind Cut out's Pick:

1. Encode the photo in a worker when Pick opens, with WebGPU where it's available and WebAssembly otherwise.
2. A tap selects; another tap on the same spot grows the selection through SAM's masks; Erase mode's taps (or a long press) subtract. Keep MagicTouch until the model has downloaded, so the first tap still works.
3. Write the selection as the layer's `mask`, as Pick does now, so the Keep and Erase brushes refine it the same way.

Then run the native spike before deciding whether iOS and Android use MobileSAM or keep their platforms' subject masks.
