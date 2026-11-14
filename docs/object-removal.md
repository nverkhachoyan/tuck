# Object removal

Research into filling the hole Cut's Remove leaves, done in November 2026. Remove hides the selection with the image's mask, so what's behind an object shows as transparency. A model could paint in what was probably there instead. Not built.

## Recommendation

Leave it for now. Build it with MI-GAN once two things are settled:

1. **Whether its weights may ship in a commercial app.** MI-GAN's code and weights are MIT, but it was trained on Places2, and nobody here could read Places2's terms (the site refused the connection). Another model card notes they don't say whether trained weights may be redistributed commercially. LaMa has the same question, since it was trained on Places2 too.
2. **How it runs on a phone.** Every number below is from a Mac. The iOS simulator can't run Core ML models (MobileSAM's encoder fails there as well), and the Android emulator on the Mac was too slow to measure anything.

MI-GAN rather than LaMa: it's 29.5 MB to LaMa's 208 MB (37 MB quantized), it's plain convolutions that ONNX Runtime already runs on all three platforms, and it filled a 6-megapixel photo in about half a second on WebGPU. LaMa's FFT layers failed on ONNX Runtime Web's WebGPU in two versions, and its quantized file (opset 21) needs a session option set and was tested by its publisher only on ONNX Runtime 1.30's CPU and web builds, not on Core ML or a phone. LaMa was not downloaded: MI-GAN's pictures answered the question of where a fill works.

A fill is a generated guess, so it would need a line in PRODUCT.md, which says "Not planned: generative fill". The line to draw: Tuck fills a hole from the photo's own pixels with no prompt, only after Remove, as a layer that can be deleted, and never as a way to hide something.

## What was measured

`migan.onnx` from `huggingface.co/andraniksargsyan/migan` (MIT, 29.5 MB) in headless Chrome on an M1 Mac, with ONNX Runtime Web as the app ships it. The file is the whole pipeline, not the 512-pixel generator alone: it takes the photo and a mask as `uint8` at any size (mask 255 where the photo stays, 0 where it's filled), crops around the hole, fills at 512, and blends the result back. Pixels outside the hole came back unchanged. The holes were Segment Anything's masks from a box around each object, grown 8–12 pixels.

| | WebGPU | WebAssembly, one thread |
|---|---|---|
| Loading the model | 0.8–1.2 s | 0.2 s |
| One fill, 1–6 MP photo | 0.34–0.62 s | 1.2–1.3 s |

The site isn't cross-origin isolated, so WebAssembly gets one thread. Peak memory wasn't measured: the browser's JavaScript heap (about 200 MB with Segment Anything loaded too) leaves out GPU and WebAssembly memory.

## Where a fill works

| Removed | Hole | Result |
|---|---|---|
| A malamute from sky, trees, and snow (6.3 MP) | 12% | Plausible clouds, treeline, and snow, slightly soft |
| Dry grass against the sky (6.3 MP) | 4% | Clean sky |
| A person in a crowd (5.7 MP) | 4% | A blurry ghost of a figure |
| An apple among leaves (0.8 MP) | 15% | Gray mush with smeared leaves |
| A cat against bare branches (4.3 MP) | 37% | A pale ghost of the cat |

A fill works where what's behind the object is sky, water, grass, snow, or another texture without structure, and fails where it's busy: people, branches, leaves. Size matters less than what's behind: the malamute's 12% filled well, the person's 4% didn't. A large hole in a large photo is filled at 512 pixels and stretched, which shows as softness against the photo's grain.

## How it would fit

- **A patch layer, not a change to the image.** An ordinary image layer over the photo holding the filled crop, masked to the hole grown and feathered: no format change, and it can be hidden or deleted like any layer. It doesn't follow the photo's later adjustments or a crop's turn; a fill inside the image layer would, but needs a new format version and new drawing in `ImageLayerView`. The layer is the utility's answer, as with Adjust the selection.
- **What the model sees:** the photo's own pixels, never the layers over it.
- **Where the file is kept:** through the host's `addImage`, as masks are.
- **Never a redaction.** A fill paints a guess over what was there, and a guess can be wrong in a way that shows the original. Redact stays the way to hide something.
- **Offered after Remove**, as a Fill action in its notice, so the hole is the user's choice first.

## Cost

- **App size:** 29.5 MB more, on top of the 44 MB Segment Anything already adds. A 16 MB fp16 LiteRT build exists for Android.
- **Fetched on first use rather than bundled:** by the service worker on web; on-demand resources on iOS and Play Asset Delivery on Android, which follow-ups already raises for Segment Anything.

## What building would take

1. Settle the Places2 question, and add the PRODUCT.md line.
2. Measure on an iPhone and an Android phone: load, one fill, peak memory.
3. Run MI-GAN in the module on each platform (the web worker beside Segment Anything's; Core ML on iOS, the CPU on Android), behind a function that takes the photo and a mask.
4. A Fill action in Remove's notice that adds the patch layer as one undo step.
5. Fetch the model on first use, with a notice while it downloads.
