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
* **Pick**: a tap on the photo cuts out only the subject under it. Once there's a cut, a tap adds the subject under it, or takes it out when the cut shows the photo where it was tapped: the masks are combined offscreen with Skia (the lighter of the two to add, the darker of the cut and the subject's inverse to take out) into a new grayscale PNG. `subjectMask(uri, point)` takes the point: iOS reads the instance label under it from `instanceMask`, Android asks ML Kit for each subject and keeps the one under it, and web gives MagicTouch the tap instead of the center (the biggest fix on web).
* **Keep** and **Erase** brushes paint the cut by hand: Keep brings back what the model removed, Erase removes what it kept. Removed parts show faintly while the tool is open, so there's something to paint back. Their edges are soft by default (a blur over about half the brush's width, `feather` on the stroke) so hand-fixed edges match the model's, or hard for a crisp line.
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

The web spike (`docs/smart-selection-spike.md`) recommends MobileSAM: on an M1 in Chrome it encodes a photo in about 1 second with WebGPU (3 with single-threaded WebAssembly), then answers each tap in 45–70 ms (150 ms). It selected one grocery bag, a tail light, and a truck's window where MagicTouch took the whole car or truck. Its likeliest mask can be a part (a jacket rather than the person), so a second tap should grow the selection. Native runtimes are the next spike.

Open questions for stage 2:

* **Download size.** ~40 MB at fp32, perhaps ~12 MB with an int8 encoder if the masks hold up. On native, bundling it grows the app; downloading it on first use breaks "nothing leaves the device" only in appearance (it's a model, not a photo), but needs a host. On web it's cached by the service worker with the version that first used it, as the face and MagicTouch models are.
* **Edges.** SAM's masks come out at 256×256 and are scaled up, so hair and fur are soft and blocky. Refining the mask against the photo (a guided filter), or running the decoder again on a crop around the object, would sharpen it. Stage 1's brushes cover the rest.
* **Gestures.** Pick's taps become positive points, a second mode (or a long press) negative ones, and a drag a box, which `strokeIntent` already distinguishes from a tap.

### Stage 3: act on a selection

A selection becomes a mask that the editor's existing features can take:

* **Redact a selection**: a redaction shaped by a mask rather than a box or strokes, to blur a person or a license plate exactly. The most on-brand of these for Tuck.
* **Copy to a new layer or keep as a sticker**: the cut-out image, saved with its mask applied. Keeping one as a sticker is built: `renderCutOut` draws what the cut keeps, trimmed to it, into a transparent PNG.
* **Invert**: keep the background and remove the subject, or blur only the background.
* **Adjust only the selection**.

### Stage 4: remove an object

Fill the hole a selection leaves with an inpainting model: MI-GAN (MIT, made for phones, about 30 MB) or LaMa (Apache 2.0, about 200 MB). It's the biggest piece of work here, and the one people most often think of when they hear "smart selection", so it's worth its own research first.

## Risks

* Vision's foreground masks don't run on the iOS simulator, so iOS's Pick can only be checked on a device.
* ML Kit's subject segmentation is in beta, and its per-subject masks have their own sizes and offsets.
* Many strokes on a large photo cost a redraw each; if it shows, record them into a picture once per version of the layer, as redaction strokes are.
