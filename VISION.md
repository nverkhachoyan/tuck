# Photo Editor — Product Vision

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

## New dependency

Add when required:

```bash
npx expo install expo-image-manipulator
```

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

# Stage 4 — Background Removal

## Goal

Allow a user to isolate the main subject of a photo with one action.

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

## Architecture

Background segmentation is intentionally platform-specific.

Expose one shared TypeScript interface.

Example:

```ts
type SegmentationResult = {
  maskUri: string;
  width: number;
  height: number;
};

removeBackground(
  imageUri: string
): Promise<SegmentationResult>;
```

The editor should not care which native implementation produced the mask.

## iOS

Implement using:

```text
Swift
Apple Vision
```

Prefer Apple's foreground-instance segmentation APIs.

## Android

Implement using:

```text
Kotlin
Google ML Kit Subject Segmentation
```

## Expo integration

Create a local Expo module rather than scattering native bridges throughout the project.

Suggested structure:

```text
modules/
└── image-segmentation/
    ├── ios/
    ├── android/
    └── src/
```

At this point the project should use an Expo development build when required for custom native functionality.

## Rendering

Native code should primarily produce segmentation results or masks.

Skia remains responsible for:

* applying the alpha mask
* displaying the cutout
* transforming the resulting layer
* compositing it with other content
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

unless the product direction explicitly changes later.

## Stage 4 completion criteria

A user can select an image, tap `Remove Background`, and receive a clean foreground layer that can be positioned and exported over a transparent or custom background.

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
Face blur detection
Automatic text-region detection
Automatic license-plate blur
Collages
Image annotations
Shapes and arrows
Custom canvas sizes
Clipboard image import
Share-extension integration
Batch redaction
HEIC / RAW improvements
More advanced filters
```

These should be evaluated individually rather than assumed.

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

Treat background removal as an isolated native capability exposed through a small cross-platform API.

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

The current milestone is:

> **Stage 1 — Canvas + Text**

The immediate product test is simple:

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

Do not expand scope until this workflow feels fast, predictable, and polished on both iOS and Android.

## Status

The Stage 1 workflow is implemented; what remains is confirming save and share on real iOS and Android devices.

A few Stage 5 items were built early, alongside Stage 1: undo/redo, a small bundled font set, a simple layers panel, and saved projects (each session autosaves as a local project, listed on the welcome screen to reopen; on web too, in IndexedDB). They are part of the app now; this doesn't mean the rest of Stage 5 has started.
