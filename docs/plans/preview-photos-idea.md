# Preview photos

An idea to explore later, recorded October 28, 2026: edit on a smaller copy of each photo, and keep the photo at full size only for export. It came out of comparing Tuck's layout with one proposed from scratch, which keeps "a preview-resolution copy, around 2x the screen's long edge, for editing" beside the original. Nothing here is decided. Measure first: if memory isn't a problem on the devices we care about, leave it.

## Why

Import scales a photo down to at most 25 million pixels (`MAX_PHOTO_PIXELS` in `photos/photoScale.ts`), and every render decodes that file in full through `decodedImages`. A 24MP iPhone photo is 5712×4284, about 98 MB as RGBA pixels on the GPU, and each photo layer holds its own. A few photos in one project, a cut-out mask beside each, and export's offscreen render on top could push an older iPhone or a mid-range Android phone out of memory, and a browser tab with it.

A fitted phone canvas shows about 1,300 pixels across, so most of those pixels go unseen until the user zooms in. A copy with a 2,048-pixel long side is about 12.5 MB, an eighth of the full photo.

With the editor holding only previews, the 25MP cap could rise, or go, for photos taken in 48MP modes.

## What decodes a photo today

All of it goes through `render/`'s `decodedImages`, by the layer's `uri`:

* The canvas: `LayerContent` and `LiveLayerContent` (`useDecodedImage`), and Crop's canvas through `LayerContent`.
* Export, thumbnails, and the eyedropper (`renderDocument`, `renderThumbnail`, `sampleColor` in `render/renderDocument.tsx`).
* Cut out: `renderCutOut` and `renderCutShape` for stickers and mask-shaped redactions, and its masks (`withMask` in `tools/cutout/useCutOut.ts`).
* Detection (`modules/image-analysis`) reads the file itself, not through Skia.

## What would change

* **Import** (`photos/photoImport.ts`) writes a preview beside the photo, and a project keeps both (`projects/`, with a new `PROJECT_VERSION` whose upgrade makes previews for older projects as they open).
* **The image layer** gains a preview URI, or the preview's name follows from the photo's, so `model/` stays the same.
* **`render/`** takes which one to draw: the canvas asks for previews, and export, the eyedropper, and Cut out's renders for the full photo. A layer's size stays the full photo's, since everything is in document space; only the drawn image is scaled.
* **Export** decodes the full photos itself, once, and frees them after, instead of sharing the canvas's copies.

## Trade-offs

* **Zooming in.** A preview turns soft past about 1.5× on a phone. Checking a redaction over small text is where people zoom most, and the preview must not look sharper or softer than what's exported. Options:
  * One preview size, soft when zoomed in. Simplest; likely not good enough.
  * Swap in the full photo once the zoom passes the preview's resolution, and free it on zooming out. Keeps memory low most of the time, but a zoomed view still holds the full photo.
  * Tiles at several sizes. The most memory saved, and much more code; probably more than Tuck needs.
* **Effects in document units.** Pixelation and blur are sized in document units, so they look the same on a preview, but compare the preview with the export once built, for each redaction effect.
* **Storage.** Each photo gains a small file (a few hundred KB as JPEG), on the device and in IndexedDB on web.
* **Masks.** Cut out's masks are images too. Decide whether they get previews, or stay full size because Cut out edits them.

## How to decide

1. Measure memory with one, three, and five 24MP photos in a project, then export: Xcode's memory gauge on an iPhone with 4 GB or 6 GB, Android Studio's profiler on a mid-range phone, and the tab's memory in Chrome.
2. If any of those runs out of memory or comes close, prototype the swap-on-zoom option on the canvas alone, and measure again.
