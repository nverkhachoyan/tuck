# Smart selection

A plan for growing Cut out into a selection tool, written October 2026. Cut out today finds every subject in a photo and hides the rest, in one tap. When it guesses wrong (a stray background object kept, a hand cut off, the wrong thing on web, where it takes whatever is at the center), there's nothing to do but undo it.

## What people use Photoshop's selection for

Most uses of Select Subject, the Object Selection tool, and Select and Mask fall into a few groups:

1. **Cut the subject out**, then fix what the model got wrong: add back a missed hand, remove a stray object, clean up the edges.
2. **Pick one object among several**: one person in a group, the product but not the table.
3. **Do something to the selection**: blur or pixelate it, recolor or adjust only it, copy it to a layer or a sticker, put a new background behind it.
4. **Remove the selection** and fill the hole (content-aware or generative fill).

Tuck is "open photo, make edit, share", not Photoshop, so the goal is the few of these that people need in seconds: 1 and 2 first, then the parts of 3 that the editor already has (redact, adjust, stickers, background). 4 needs an inpainting model and is a stage of its own.

## Where Cut out stands

* `image-analysis`'s `subjectMask(uri)` returns a grayscale mask of every subject: Apple Vision's `VNGenerateForegroundInstanceMaskRequest` on iOS 17+, ML Kit subject segmentation on Android, and MediaPipe MagicTouch (version 1) on web, told to look at the image's center.
* The mask is a file in the project, kept in the image layer's `mask`. Skia draws the image through it, so the photo is untouched and the cut can be undone. This was the right call: refinement can build on it without touching the photo.
* Every model already knows more than Cut out asks of it. Vision labels each subject separately (`VNInstanceMaskObservation.instanceMask`), ML Kit can return each subject's mask, and MagicTouch takes any point.

## Stages

### Stage 1: pick and refine (no new model)

Cut out becomes a tool with Done and Cancel, like Adjust, working on one image:

* **Opening it** on an image with no cut finds every subject, as Cut out does now, so one tap still cuts the photo out. On an image that's cut already, it opens to refine the cut.
* **Subjects** finds every subject again, replacing the cut.
* **Pick**: a tap on the photo cuts out only the subject under it. Once there's a cut, a tap adds the subject under it, or takes it out when the cut shows the photo where it was tapped: the masks are combined offscreen with Skia (the lighter of the two to add, the darker of the cut and the subject's inverse to take out) into a new grayscale PNG. `subjectMask(uri, point)` takes the point: iOS reads the instance label under it from `instanceMask`, Android asks ML Kit for each subject and keeps the one under it, and web gives MagicTouch the tap instead of the center (the biggest fix on web). Vision can give subjects that touch one label (a phone lying against a cigarette pack came back as one instance), so iOS splits the instance where it narrows to a neck much thinner than the parts on either side, with a watershed on its distance transform in `SubjectParts.swift`, and keeps only the part under the tap. A part must be at least three times as wide as the neck, which leaves a head on its neck and a hand on its wrist.
* **Keep** and **Erase** brushes paint the cut by hand: Keep brings back what the model removed, Erase removes what it kept. While the tool is open, what the cut keeps is washed green and what it removes is dimmed and washed red, so the two are easy to tell apart and the removed parts can be painted back. Their edges are soft by default (a blur over about half the brush's width, `feather` on the stroke) so hand-fixed edges match the model's, or hard for a crisp line.
* **Reset**, in the header as for Adjust, takes the cut off.
* The brushes need no model, so the tool shows on every device, including iOS 16 and Android without Play services, where Subjects and Pick are left out.

The document stores the brush strokes as `maskStrokes` on the image layer (`MaskStroke`s in the image's own pixels), drawn over the mask: a pen shows the image, an eraser hides it. The strokes stay editable, nothing is rasterized, and the editor, export, and thumbnails draw them through the same `ImageLayerView`. A new mask from Subjects drops the strokes, which refined the old one, and so does Reset; a mask Pick grew or shrank from the old one keeps them. Older builds show the cut without its strokes (as they show an image without adjustments), so the project version stays 5.

### Stage 2: select any object (a promptable model)

Platform subject masks only know "salient things": they can't pick the sky, a shirt, a sign, or a car parked behind the subject. Promptable segmentation (Segment Anything and its small descendants) selects any region from a tap, positive and negative taps, or a box. It runs in two parts: an image encoder once per photo, then a small decoder per tap, fast enough to follow the finger.

Candidates, all with Apache 2.0 code and weights:

| Model | Size (fp32) | Notes |
|---|---|---|
| MobileSAM | 45 MB (encoder 28, decoder 16.5) | ONNX exports on Hugging Face; the SAM decoder |
| SlimSAM-77 | 14 MB as int8 | Smaller, but slower and noisier in the spike |
| EfficientSAM-Ti | larger encoder | Better masks than MobileSAM in its paper, slower |
| EfficientViT-SAM-L0 | ~140 MB | Fast on GPUs, too large to ship to phones |
| SAM 2.1 tiny | ~150 MB | Best quality; too large for phones |

Ruled out: EdgeSAM (fastest on phones, but its S-Lab license is non-commercial), SAM 3 (custom license, far too large).

One ONNX model can serve all three platforms: `onnxruntime-web` on web (WebAssembly, or WebGPU where the browser has it), and ONNX Runtime's iOS and Android libraries inside `image-analysis`, run from Swift and Kotlin so tensors never cross the JavaScript bridge.

The web spike (`docs/plans/smart-selection-spike.md`) recommends MobileSAM: on an M1 in Chrome it encodes a photo in about 1 second with WebGPU (3 with single-threaded WebAssembly), then answers each tap in 45–70 ms (150 ms). It selected one grocery bag, a tail light, and a truck's window where MagicTouch took the whole car or truck. Its likeliest mask can be a part (a jacket rather than the person), so a second tap should grow the selection. The native spike (the same document) measured it on an iPhone and Android's emulator, and it's built on both.

**Built on web** (October 2026), as the spike recommended: opening Pick starts a module worker (`modules/image-analysis/src/mobileSamWorker.js`, served as `/mobile-sam-worker.js`) that loads ONNX Runtime's WebGPU build and MobileSAM, encodes the photo at 1024 pixels on its longer side, and runs the decoder once so WebGPU's one-second setup doesn't land on the first tap. Until it's ready, taps go to MagicTouch. A tap takes SAM's likeliest of its three masks (sigmoid of the logits, so edges stay soft) and adds it to the cut or takes it out, as stage 1's Pick does; another tap on the same spot, while the cut is the one it left, steps through the others from a part to the whole and around again. In headless Chrome on an M1: about 2 seconds from opening Pick to ready, then 100–160 ms a tap, on WebGPU or WebAssembly alike. The worker is precached with the app; the runtime (`/onnxruntime/`) and models (`/mobile-sam/`) are kept on first use, like the other engines. Cut out closing ends the worker.

**Built on iOS and Android** (October 2026): `image-analysis` runs the same two models with ONNX Runtime from Swift and Kotlin (`ObjectSelector`), on a queue of its own, behind the same `prepareObjects` and `objectMasks` the web worker answers, so Pick works the same everywhere. Until the image is read, taps go to Vision or ML Kit, as they go to MagicTouch on web. The encoder file is now a fixed 1024-pixel square, which every platform pads with the encoder's mean, and its six-dimensional window reshapes are five-dimensional, so iOS runs all of it with Core ML on the GPU: on an iPhone 17 Pro Max, Pick is ready a quarter of a second after it opens (about 3 seconds the first time after the app launches, while Core ML loads the model), and a tap takes 75 ms. Android runs it on the CPU: about 2 seconds to read a photo on the emulator. The models ship in both apps.

Open questions for stage 2:

* **Download size.** ~40 MB at fp32, perhaps ~12 MB with an int8 encoder if the masks hold up. Bundled, the models add 44 MB to each app, and ONNX Runtime 34 MB to Android's (its arm64 library, before the store compresses it); iOS's Release size isn't measured yet. On-demand resources and Play Asset Delivery could fetch the models the first time Pick opens, from Apple's and Google's servers rather than a host of ours. On web they're cached by the service worker with the version that first used them, as the face and MagicTouch models are.
* **Android on a phone.** Only the emulator has run it. A phone's CPU may take longer than its 2 seconds to read a photo, and taps took 0.15 s back to back but over a second spaced out there. If a phone is slow, ONNX Runtime's NNAPI or QNN providers, or LiteRT on the GPU, are where to look.
* **Pick without Vision or ML Kit.** Segment Anything needs neither, so Pick could show on iOS 16 and on Android without Play services, where Cut out offers only the brushes now.
* **Edges.** SAM's masks come out at 256×256 and are scaled up, so hair and fur are soft and blocky. Refining the mask against the photo (a guided filter), or running the decoder again on a crop around the object, would sharpen it. Stage 1's brushes cover the rest.
* **Gestures.** Pick's taps become positive points, a second mode (or a long press) negative ones, and a drag a box, which `strokeIntent` already distinguishes from a tap.

### Stage 3: act on a selection

A selection becomes a mask that the editor's existing features can take:

* **Redact a selection**: a redaction shaped by a mask rather than a box or strokes, to blur a person or a license plate exactly. The most on-brand of these for Tuck. Built: Cut out's **Redact** draws what the cut keeps (its mask and strokes, flipped with the image) as white over transparency, trimmed to it and at most 2048 pixels on its longer side (`renderCutShape`), and keeps it in the project as a PNG. A redaction with `shape: "mask"` (`RedactionMask`) stretches that file over its box, placed and turned with the image, and hides what's under it as far as the mask is opaque, so soft edges fade. It's recorded into a picture like brushed strokes, with the mask in place of the strokes. The image goes back to how it was before Cut out opened, and Redact opens with the new redaction selected, in the last style used, to restyle it. Its handles scale it, keeping its shape. Builds from before it list a project with one as unavailable, as they did for drawings, so the project version stays 5.
* **Copy to a new layer or keep as a sticker**: the cut-out image, saved with its mask applied. Keeping one as a sticker is built: `renderCutOut` draws what the cut keeps, trimmed to it, into a transparent PNG.
* **Invert**: keep the background and remove the subject, or blur only the background. Built: Cut out's **Invert** turns the cut inside out. The mask becomes its inverse (`invertedMask`, a black pixel stretched over the image for a cut made only by hand), and every stroke paints the other way, a pen becoming an eraser and the reverse (`withInvertedCut`). Painting white or black over a mask and then inverting the result is the same as painting the other color over the inverted mask, so the inverse is exact and the strokes stay editable. Redact then hides what the inverted cut keeps, so Invert and then Redact blurs only the background. A backdrop blur reads what's beside the edge too, so a faint fringe of the subject's color shows just outside it.
* **Adjust only the selection**.

### Stage 4: remove an object

Fill the hole a selection leaves with an inpainting model: MI-GAN (MIT, made for phones, about 30 MB) or LaMa (Apache 2.0, about 200 MB). It's the biggest piece of work here, and the one people most often think of when they hear "smart selection", so it's worth its own research first.

## Risks

* Vision's foreground masks don't run on the iOS simulator, so iOS's Pick can only be checked on a device.
* ML Kit's subject segmentation is in beta, and its per-subject masks have their own sizes and offsets.
* Many strokes on a large photo cost a redraw each; if it shows, record them into a picture once per version of the layer, as redaction strokes are.
