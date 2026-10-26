# Tuck — Product Vision

## Vision

Build a fast, free, local-first photo editor for iPhone and Android focused on edits people frequently need to make in seconds.

The app should make tasks like these effortless:

* Add text to an image.
* Make a meme.
* Blur or redact sensitive information.
* Crop, rotate, or adjust a photo.
* Remove a background.
* Add simple stickers or drawings.
* Export and share immediately.

The product is intentionally **not a Canva replacement**.

It should feel closer to a utility:

> Open photo → make edit → save or share.

No account should be required. Core editing features should not require subscriptions, credits, cloud processing, or watermarks.

---

# Product Principles

## 1. Fast before powerful

The common editing path should take seconds.

Avoid forcing users through:

* project setup
* templates
* onboarding
* accounts
* cloud uploads
* unnecessary dialogs
* complex editing modes

Opening an image should lead directly to editing.

## 2. Local-first

Image processing should happen on-device whenever practical.

The initial architecture should require:

* no backend
* no user accounts
* no cloud storage
* no AI API
* no remote image processing

Projects may be saved locally.

## 3. Non-destructive editing

Edits should be represented as structured editor state rather than repeatedly modifying the original image.

The original image remains unchanged.

Conceptually:

```text
EditorDocument
│
├── canvas
├── source assets
├── layers
├── adjustments
└── editor metadata
        │
        ▼
     Renderer
        │
        ▼
   PNG / JPEG
```

Export renders the final composition at the desired resolution.

## 4. Cross-platform first

The application targets both:

* iOS
* Android

Use React Native and Expo for application code.

Use native Swift/Kotlin only where the platform provides capabilities that are substantially better than a cross-platform implementation.

## 5. Keep dependencies narrow

Do not introduce a full commercial photo-editor SDK.

The editor itself should be owned by this project.

Core responsibilities:

```text
React Native / Expo     Application UI
Skia                    Rendering engine
Gesture Handler         Touch gestures
Reanimated              High-frequency interaction state
EditorDocument          Persistent editor state
Native modules          Platform-specific capabilities
```

---

# Core Technology

The initial stack is:

```text
Expo
React Native
TypeScript
Expo Router

@shopify/react-native-skia
react-native-gesture-handler
react-native-reanimated
react-native-worklets

expo-image-picker
expo-file-system
expo-media-library
expo-sharing
```

Additional dependencies should be introduced only when their stage requires them.

---

# Architecture

The central abstraction is an `EditorDocument`.

UI components must not become the canonical representation of the edited image.

Example direction:

```ts
type EditorDocument = {
  width: number;
  height: number;
  layers: Layer[];
};

type Layer =
  | ImageLayer
  | TextLayer
  | BlurLayer
  | DrawingLayer;
```

Layers should contain editor-space coordinates and transforms rather than screen-space coordinates.

Example:

```ts
type Transform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};
```

This allows the editor preview and full-resolution export renderer to use the same document.

## Rendering

React Native Skia is the primary rendering engine.

Skia should handle:

* images
* text
* transforms
* masks
* clipping
* compositing
* filters
* paths
* drawing
* final export rendering

React Native views should primarily implement application chrome such as:

* toolbars
* menus
* dialogs
* buttons
* settings
* navigation

Do not build the editing surface as a collection of positioned React Native `<View>` elements.

---

# Development Stages

Stages are intentionally sequential.

When designing or implementing a stage, do not prematurely build features belonging to later stages unless they are required by the architecture.

---

# Stage 1 — Canvas + Text

## Goal

Create the smallest complete photo-editing workflow:

```text
Pick image
    ↓
Edit on canvas
    ↓
Add text
    ↓
Move / scale / rotate
    ↓
Export
    ↓
Save or share
```

At the end of Stage 1, the app should already function as a basic meme creator.

## Included

### Image input

Use:

```text
expo-image-picker
```

Support selecting one photo from the user's library.

### Editing canvas

Use:

```text
@shopify/react-native-skia
```

The selected image should render inside a Skia canvas with predictable editor coordinates.

The canvas should support fitting the source image to the available screen while retaining its logical document dimensions.

The view can zoom into that fit and pan around it: with two fingers wherever they wouldn't transform a selected layer, with a double tap on nothing to select, with a trackpad pinch or the wheel on web, and with ⌘+, ⌘−, and ⌘0. While zoomed in, one finger pans it too, unless it starts on the selected layer; another layer is tapped to select it, then dragged. Zooming is a way of looking, never part of the document or its undo history. New text, photos, and stickers go in the part of the canvas in view, sized to it.

### Text layers

Support:

* adding text
* editing text content
* changing font size
* changing text color
* basic text alignment
* meme-style outlined text
* deleting text
* duplicating text if straightforward

A useful first preset is classic meme text:

```text
White bold text
Black outline
Centered
```

### Layer transforms

Use:

```text
react-native-gesture-handler
react-native-reanimated
react-native-worklets
```

Selected text layers should support:

* drag
* pinch to scale
* two-finger rotation

High-frequency gesture updates should not require React rerenders for every frame.

Final transform values should be committed back to the document model.

### Basic selection

The user should be able to:

* select a text layer
* see which layer is selected
* transform the selected layer
* deselect it

Keep selection UI minimal.

### Export

Use Skia to render or snapshot the final composition.

Use:

```text
expo-file-system
expo-media-library
expo-sharing
```

Support:

* export image
* save to Photos/Gallery
* open native share sheet

## Stage 1 UI

The editor should remain minimal.

A reasonable structure is:

```text
┌──────────────────────────┐
│ Back                Done │
├──────────────────────────┤
│                          │
│                          │
│       EDITING CANVAS     │
│                          │
│                          │
├──────────────────────────┤
│ Text              Export │
└──────────────────────────┘
```

The exact design may evolve, but Stage 1 should not expose tools that do not work yet.

## Explicitly NOT included

Do not build Stage 1 UI for:

* blur
* pixelation
* redaction
* crop
* brightness
* contrast
* saturation
* background removal
* stickers
* drawing
* saved projects
* template galleries
* accounts
* cloud synchronization

Do not create disabled placeholder buttons for future tools unless specifically requested.

## Stage 1 completion criteria

Stage 1 is complete when a user can:

1. Pick a photo.
2. Add meme text.
3. Move, scale, and rotate the text.
4. Export the result.
5. Save or share it successfully on a real device.

---

# Stage 2 — Blur + Redaction

## Goal

Make hiding information in screenshots and photos extremely fast.

This is a major product feature, not a secondary effect.

## Included

Add a dedicated tool with modes such as:

```text
Blur
Pixelate
Redact
```

### Blur brush

The user paints over portions of the image with their finger.

Support:

* brush size
* blur strength
* erase
* undo
* redo when available

Represent strokes as editor data rather than permanently modifying the source image.

Example:

```ts
type Stroke = {
  points: Point[];
  width: number;
};
```

### Rectangle redaction

Support quickly drawing rectangles over:

* addresses
* names
* license plates
* messages
* account information

Modes:

```text
Blur rectangle
Pixelated rectangle
Solid blackout rectangle
```

### Skia implementation

Prefer existing Skia functionality:

* `Path`
* `Mask`
* clipping
* blur filters
* image filters
* shaders where appropriate

Do not introduce another graphics engine.

## Explicitly NOT included

Stage 2 should not introduce:

* crop UI
* general photo adjustments
* background removal
* stickers
* drawing brushes unrelated to redaction
* project management UI

## Stage 2 completion criteria

A user can open a screenshot, paint over sensitive information, undo mistakes, and export the edited image without losing quality unnecessarily.

---

# Stage 3 — Basic Photo Editing

## Goal

Provide the common adjustments expected from a lightweight photo editor.

## Dependency

`expo-image-manipulator` is already installed: Stage 1 uses it to re-encode picked photos as JPEG, since Skia can't decode iPhone HEIC photos, and to shrink very large ones.

## Included

### Geometry

Support:

* crop
* rotate
* flip
* common aspect ratios

Possible aspect-ratio presets:

```text
Free
Original
1:1
4:3
3:4
16:9
9:16
```

### Adjustments

Support at minimum:

* brightness
* contrast
* saturation
* temperature / warmth

Potential later additions within this stage:

* highlights
* shadows
* exposure
* vignette
* sharpen

Only add these after the fundamental adjustments feel good.

### Architecture

Prefer nondestructive preview using Skia.

Example:

```ts
type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
};
```

Use `expo-image-manipulator` for operations where generating a transformed source asset is advantageous, such as:

* resizing very large source files
* committed crop
* committed rotation
* flip

Do not repeatedly recompress the source image whenever a slider moves.

## Explicitly NOT included

Do not add:

* background removal
* AI tools
* advanced Photoshop-style selection
* healing brushes
* object removal
* layers panel designed for professional workflows

## Stage 3 completion criteria

The app can handle the majority of quick everyday photo corrections without leaving the editor.

---

# Stage 4 — Background Removal + Detection

## Goal

Allow a user to isolate the main subject of a photo with one action, and to find the faces and text in a photo so they can be redacted with one tap.

Example:

```text
Photo
  ↓
Remove Background
  ↓
Foreground subject
  ↓
Transparent background
```

```text
Photo or screenshot
  ↓
Find faces / Find text
  ↓
Tap the ones to hide
  ↓
Redaction boxes
```

The research behind this stage, including the dependencies chosen and rejected, is in [docs/on-device-detection.md](docs/on-device-detection.md).

## Architecture

Detection is intentionally platform-specific.

Expose one shared TypeScript interface.

Example:

```ts
type Rect = { x: number; y: number; width: number; height: number };

type TextRegion = {
  line: Rect;
  words: Rect[];
};

type SubjectMask = {
  uri: string; // a grayscale image: white where the subject is
  width: number;
  height: number;
};

detectFaces(imageUri: string): Promise<Rect[]>;
detectText(imageUri: string): Promise<TextRegion[]>;
subjectMask(imageUri: string): Promise<SubjectMask | null>;
```

Rectangles are in the image's pixels. The editor should not care which implementation produced them or the mask.

Detected faces and text become ordinary redaction layers, which the user can move, resize, restyle, or undo like ones drawn by hand. Detection only proposes them.

## iOS

Implement using:

```text
Swift
Apple Vision
```

Use `VNDetectFaceRectanglesRequest`, `VNRecognizeTextRequest`, and Apple's foreground-instance segmentation (`VNGenerateForegroundInstanceMaskRequest`, iOS 17+).

## Android

Implement using:

```text
Kotlin
Google ML Kit Face Detection
Google ML Kit Text Recognition v2
Google ML Kit Subject Segmentation
```

Use the Google Play services versions, which download their models rather than ship them in the app.

## Web

Implement using:

```text
@mediapipe/tasks-vision   faces, background removal
tesseract.js              text
```

Serve their WebAssembly files and models from the app itself, not a third-party CDN.

## Expo integration

Create a local Expo module rather than scattering native bridges throughout the project.

Suggested structure:

```text
modules/
└── image-analysis/
    ├── ios/
    ├── android/
    └── src/
```

The web implementation lives in the module's `.web.ts` file, behind the same interface.

At this point the project should use an Expo development build when required for custom native functionality.

## Rendering

Native code should primarily produce detection results or masks.

Skia remains responsible for:

* applying the alpha mask
* displaying the cutout
* transforming the resulting layer
* compositing it with other content
* drawing redactions over detected regions
* exporting

## Explicitly NOT included

Do not turn Stage 4 into a general AI editing system.

Avoid introducing:

* generative fill
* cloud inference
* AI credits
* server-side processing
* object generation
* prompt-based image manipulation
* face recognition (telling who a face belongs to)

unless the product direction explicitly changes later.

## Stage 4 completion criteria

A user can select an image, tap `Remove Background`, and receive a clean foreground layer that can be positioned and exported over a transparent or custom background.

A user can open a photo or screenshot, have its faces and text found, and redact any of them with a tap each.

---

# Stage 5 — Polish + Projects

## Goal

Turn the editing engine into a polished everyday application.

## Stickers

Support lightweight image-based stickers.

Possible sources:

* PNG
* WebP
* SVG
* emoji

Skia remains responsible for rendering them.

Do not build a large online sticker marketplace.

## Drawing

Support basic freehand drawing using:

```text
Gesture Handler
    ↓
Point stream
    ↓
Skia Path
```

Initial options:

* color
* brush width
* eraser

Avoid building a professional illustration engine.

## Fonts

Use:

```text
expo-font
```

Include a small intentionally selected font set rather than hundreds of fonts.

Meme-friendly typography is more valuable than a huge font catalog.

## Undo / redo

Undo and redo should operate on editor actions.

A conceptual model:

```ts
type EditorHistory = {
  past: EditorDocument[];
  present: EditorDocument;
  future: EditorDocument[];
};
```

The actual implementation may use commands, patches, snapshots, or another efficient strategy.

Do not optimize this prematurely during Stage 1.

## Saved projects

Projects remain local.

Possible structure:

```text
projects/
└── <project-id>/
    ├── project.json
    ├── original.jpg
    ├── assets/
    └── thumbnail.jpg
```

Start with:

```text
expo-file-system
```

Introduce SQLite only if project metadata becomes complex enough to justify it.

## Project browser

Eventually support:

* recent projects
* project thumbnails
* rename
* duplicate
* delete

Keep this separate from the fast "open image and edit" path.

## Stage 5 completion criteria

The application feels reliable enough to use repeatedly rather than only for one-off edits.

---

# Future Possibilities

These are not part of the current roadmap and should not influence early architecture unless a decision would make them impossible later.

Possible future capabilities:

```text
Automatic license-plate blur
Collages
Image annotations
Batch redaction
PDF redaction
HEIC / RAW improvements
More advanced filters
```

These should be evaluated individually rather than assumed.

## PDF redaction

People redact documents as well as photos, so Tuck could open a PDF, redact its pages, and export a new PDF. Researched in September 2026; build it only after Stage 2 works on images.

### Covering is not redacting

A PDF stores text as text. A box drawn over it, as an annotation or as a filled rectangle added to the page, leaves the text underneath selectable, copyable, and searchable. Real redaction must either remove the content under the box from the page's content stream, or flatten the page to an image so only pixels remain.

### Approach: flatten each page

```text
PDF
  ↓
Render each page to an image (about 200–300 DPI)
  ↓
Redact each page in the editor as an image document
  ↓
Write a new PDF with one image per page
```

This reuses the editor unchanged: each page is an ordinary `EditorDocument` with the page image as its locked photo, and Stage 2's redaction layers work on it as they do on a photo. What's new is a level above the document holding its pages, a page strip to move between them, multi-page projects, and PDF export.

It's safe by construction: the new PDF carries none of the original's text, links, form fields, or metadata. The costs are that text is no longer selectable or searchable, and files usually grow.

Default to solid redaction for documents. Blurred or pixelated text can sometimes be recovered, and documents are mostly text.

### Libraries

Rendering pages:

* iOS and Android: `expo-pdf-to-image` or `@dariyd/react-native-pdf-page-image`, which wrap PDFKit and `PdfRenderer`. Both are native modules, so this needs an Expo development build (Stage 4 needs one anyway).
* Web: pdf.js.

Writing the PDF: `@cantoo/pdf-lib`, the maintained fork of `pdf-lib`. It's plain JavaScript, runs in React Native, and embeds JPEG and PNG pages. The installed React Native Skia (2.6.2) exposes no PDF API, even though Skia itself can write PDFs.

### Rejected for now

* Commercial SDKs (Nutrient, formerly PSPDFKit; ComPDF; Apryse) do true content-removing redaction with their own UI, but they are paid, heavy, and conflict with keeping dependencies narrow.
* MuPDF can remove content too, but it's AGPL-licensed.
* EmbedPDF (MIT license) does true redaction with PDFium compiled to WebAssembly, but only in the browser. Hermes is reported to be gaining WebAssembly support; whether it's ready for production apps wasn't confirmed. Its redaction also shows how hard content removal is: before v2.15.1, redacting several regions of one line of text left fragments of the redacted words in the saved file.

Revisit content-removing redaction only if users need redacted PDFs to keep selectable text.

---

# UX Direction

The product should feel like a utility rather than a design suite.

Good:

```text
Open Photo
Blur
Text
Crop
Adjust
Save
```

Bad:

```text
Discover
Templates
For You
AI Studio
Brand Hub
Content Planner
Premium
```

The editing surface should prioritize the image itself.

Controls should appear only when useful.

Avoid permanent screen clutter.

For example, selecting text may temporarily replace the bottom toolbar with:

```text
Font   Size   Color   Outline   Align
```

Deselecting it returns to the main tools.

---

# AI Agent Guidelines

When working on this project, first determine the current development stage.

Do not implement future-stage functionality unless explicitly asked.

## When asked to design Stage 1

Design only around:

```text
Photo import
Canvas
Text
Text transforms
Selection
Export
Save/share
```

Do not design controls for blur, crop, adjustments, background removal, drawing, stickers, or project management.

## When asked to design Stage 2

Assume Stage 1 already works.

Add blur/redaction without redesigning the application around future editing features.

## When asked to design Stage 3

Assume Stages 1–2 already work.

Add crop and photo adjustment workflows while preserving the existing editor architecture.

## When asked to design Stage 4

Treat background removal, face detection, and text detection as one isolated native capability exposed through a small cross-platform API.

Detection proposes redaction layers; it never redacts on its own.

Do not move the editor itself into Swift or Kotlin.

## When asked to design Stage 5

Focus on refinement, persistence, undo/redo, fonts, stickers, drawing, and repeated-use workflows.

Do not turn the application into a Canva-style content platform.

---

# Engineering Guidelines

Prefer:

* small modules
* explicit types
* clear ownership boundaries
* pure document transformations
* deterministic rendering
* platform-neutral editor state
* native modules behind narrow interfaces

Avoid:

* giant editor components
* storing canonical state inside Skia components
* coupling document coordinates to device screen coordinates
* excessive dependencies
* premature abstraction
* premature optimization
* speculative future features
* duplicating the rendering engine for export

The same conceptual renderer should produce both:

```text
interactive preview
```

and:

```text
full-resolution export
```

Any architecture that makes those two substantially different should be examined carefully.

---

# Current Priority

Stages 1 through 5 are built across iOS, Android, and web, and tried on a real iPhone (see Status below). What's next:

1. Ship to the App Store and Google Play (`docs/release-checklist.md`), and try the production build's share extension from TestFlight on a real iPhone.
2. Any remaining selection or adjustment additions (`docs/plans/follow-ups-plan.md`).

Stage 1's product test still holds, and new work shouldn't slow it down:

```text
Pick a photo
      ↓
Add Impact-style text
      ↓
Drag / scale / rotate it
      ↓
Export
      ↓
Save or share
```

## Status

### Stage 1 — Canvas + Text

Built, and confirmed on a real device: pick a photo, add meme text, move, scale, and rotate it, export, and save or share.

Text is edited in place on the canvas, with fonts, colors (including custom ones and an eyedropper that picks from the canvas), alignment, an outline, and a background box. Layers snap to the canvas's and other layers' edges and centers as they're dragged.

### Stage 2 — Blur + Redaction

Built. A Redact tool adds each redaction as its own layer, either a box (dragged out, then moved and resized by its sides and corners) or brush strokes with an eraser, and each can be undone. A redaction is a solid color (black by default), a blur, or a pixelation, the last two at one of three strengths. Pixels line up with the document, so they hold still as a redaction moves. The tool remembers its settings between sessions.

### Stage 3 — Basic Photo Editing

Geometry is built: a crop tool with aspect presets, quarter turns, flipping, and straightening. It keeps the photo whole and moves it under the canvas instead of re-encoding it, so every crop can be undone or widened again later. Along with it, the canvas became its own thing: it can be expanded past the photo and filled with white, black, or transparency (exported as PNG), and the photo can be unlocked to move like any layer. Export offers smaller sizes. A document can also start as an empty canvas at a preset or custom size, and the photo can be reordered, hidden, or deleted like any layer. Photos can be added to a document as layers too, so a blank canvas can hold photos and a photo project more than one; the crop tool frames the lowest locked photo, and added photos start unlocked, so they move with the canvas.

Adjustments are built too: an Adjust tool changes brightness, contrast, saturation, and warmth on the photo, or on a selected photo or sticker, with a dial for each that settles on zero. Each image keeps its own, as a color filter over the untouched file, so any of them can be undone or reset later, and the editor, export, and thumbnails draw them alike. A blank canvas with no images doesn't offer the tool. They've been tried on real photos on a phone.

Missing: the later additions (highlights, shadows, exposure, vignette, sharpen).

### Stage 4 — Background Removal + Detection

Finding faces and text is built: a native module on iOS and Android (Apple Vision and Google ML Kit) and MediaPipe/Tesseract on web detect faces and text lines in a photo. In the Redact tool, Find detects regions, outlines candidates over the photo, and adds chosen ones as redaction boxes in one undo step, following photo transforms, flips, and crops.

Background removal and object selection are built (what's left is in `docs/plans/follow-ups-plan.md`): Cut out, in the tools and in a selected photo's actions (`B` on web), opens a session on the image. **Subjects** finds every subject (Apple Vision on iOS 17+, ML Kit subject segmentation on Android, and MediaPipe's MagicTouch on web) and keeps it as a grayscale mask file in the project. **Pick** selects or subtracts the single subject or object under a tap: MobileSAM (Segment Anything) runs with ONNX Runtime on iOS (Core ML on the GPU), Android, and web (in a worker, with WebGPU or WebAssembly), while taps before the image is encoded fall back to Vision, ML Kit, or MagicTouch. **Keep** and **Erase** brushes refine the cut by hand (`maskStrokes` on the image layer, soft or hard), **Invert** turns the cut inside out, **Redact** turns what the cut keeps into a mask-shaped redaction layer (`shape: "mask"`), and **Reset** removes the cut. The photo's file is untouched, so every change can be undone. The editor, export, and thumbnails draw the image through its mask and strokes, a cut-out makes the canvas export as PNG, saving a cut-out as a sticker trims to what the cut keeps, and a cut-out's bounds and hit-testing follow what it keeps. Tried on web, the Android emulator, and an iPhone 17 Pro Max.

### Stage 5 — Polish + Projects

Built early, alongside the stages above:

* Undo/redo.
* A small bundled font set.
* A simple layers panel.
* Freehand drawing: a Draw tool with a pen, marker, and neon brush, an eraser, colors and sizes it remembers between sessions, and each drawing kept as its own layer of strokes, so it can be moved, resized, drawn on again, or undone a stroke at a time.
* Shapes, in the Draw tool beside the pens and sharing their colors: rectangles, ellipses, lines, and arrows, each dragged out as its own layer. Rectangles and ellipses resize by their sides, and a line or arrow by dragging either end, which settles on level and upright. A tap inside an outline reaches what's under it, and the eraser removes a shape it passes over whole.
* Saved projects: each session autosaves as a local project (on web too, in IndexedDB), listed with thumbnails on the welcome screen to reopen, rename, duplicate, or delete. A project without a name is listed by its top text. Each project has its own route, so links and reloads open it.
* Stickers: a Sticker button in the dock opens a sheet with 123 emoji stickers from Google's Noto Emoji (Apache 2.0) in five categories, while Photo picks a photo directly. A sticker is copied into the project as an image layer, sized to the canvas, so it moves, resizes, and exports like an added photo, and older builds open it as one. People can keep their own images and cut-outs as stickers too, from the sheet's Yours tab or with Sticker on a selected photo; they're kept on the device, most recently used first.
* Opening photos shared from other apps: a share extension on iOS, a share activity on Android ("Edit in Tuck"), and the installed web app's share target (`share_target` on Android) and file handlers (`file_handlers`, "Open with" on the desktop) take an image and open it as a new project, saving whatever was open first. Tried on the iOS simulator (from Photos), the Android emulator, and headless Chrome; not yet on a real iPhone (which needs the App Group registered for a device build). On iOS 26 the share sheet names it "Tuck", after the app.
