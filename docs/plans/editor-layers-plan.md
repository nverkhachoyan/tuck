# Editor layers

Written October 29, 2026. This plan moves `src/render/` and `src/model/` into `src/editor/`, and gathers everything about one layer type (its type, its edits, and its view) into one folder under `editor/layers/`.

**Status:** not started.

## 1. Why

* **Related ideas live together.** Today a text layer is spread over five places: `model/layers/text.ts`, `model/edits/text.ts`, `render/layers/TextLayerView.tsx`, `render/textLayerLayout.ts`, and `render/fonts.ts`. After this plan they all sit in `editor/layers/text/`.
* **One `layers/`.** The code has three folders named `layers` (`model/layers/`, `render/layers/`, `editor/layers/`), and the last one is the Layers panel, not layers. After this plan there's one.
* **Adding a layer type means adding a folder.** It now means touching `model/layers/`, `render/layers/`, `model/edits/`, and two switches. That matches how a tool is a folder in `editor/tools/`.
* **The document is the editor's.** Only the editor edits a document. Projects, photos, and the screens only read one, render one, or make an empty one.

Export stays a screen. It reaches what it needs through `@/editor` (section 3).

## 2. Where things go

### What uses what today

* `render/`: within the editor, the canvas, the scene, and the Crop, Text, and Cut out tools. Outside it, export (`renderDocument`, `drawOffscreen`), the home screen and the editor's route (`renderThumbnail`, when a project closes), and `app/_layout.tsx` (`LoadFonts`, `resetFailedFonts`). Every one of those screens already imports `@/editor` for the session, so exporting these through `@/editor` adds no dependency. `_layout.tsx` is the only new importer.
* `model/edits/`: imported only by `editor/store/editorSlice.ts`, and quoted by four of the docs' sources (`adjust`, `crop`, `draw`, `layers`).
* `model/` outside the editor:
  * `projects/projectFile.ts` uses `EditorDocument`, `isLayer`, `layerFiles`, and the checks in `values.ts`. Its tests build layers with every type's factory.
  * `projects/projectLifecycle.ts` uses the document.
  * The screens use `createBlankDocument`, `createDocumentFromImage`, `hasEdits`, `hasTransparency`, and `Size`.
  * `photos/photoScale.ts` uses only the `Size` type.
  * `ui/hsv.ts` uses `parseHex`, `toHex`, and `Rgb`.
  * `docs/interactive` uses about 80 imports and source paths.

### Where `edits/` goes

The edits go next to their layer type, not next to the store:

* They're plain functions from document to document, and they're already split by what they edit, nearly one file per layer type. Next to the store they'd be grouped by who calls them, and the store is their only caller anyway.
* Next to their type, a layer folder holds everything about it, and the edits' tests keep importing by relative path.
* The store imports ten model files today. Afterwards it imports about the same number, from the layer folders.

Edit files take their folder's name as a prefix (`textEdits.ts`), as tools do (`drawTool.ts`). That way an editor tab or a search result names its layer, instead of showing seven files called `edits.ts`. "Edits" is already the codebase's word (`useEditNotice`, "every edit to it"), so this plan doesn't introduce "operations".

| Now (`model/edits/`) | Goes to |
| --- | --- |
| `adjust.ts`, `cutout.ts` | `layers/image/imageEdits.ts` (both edit image layers) |
| `draw.ts`: `drawStroke` | `layers/drawing/drawingEdits.ts` |
| `draw.ts`: `addShape`, `setShapeStyle` | `layers/shape/shapeEdits.ts` |
| `redact.ts` | `layers/redaction/redactionEdits.ts` |
| `text.ts` | `layers/text/textEdits.ts` |
| `layers.ts` (flags, delete, move, transform, resize, nudge) | `layers/layerEdits.ts`: these work on any layer |
| `crop.ts` (`reframe`, `setBackground`) | `document/documentEdits.ts`: these change the canvas |

Their tests move with them, renamed to match.

### The tree afterwards

```
editor/
  core.ts                plain-TypeScript entry for code outside the editor (step 3)
  document/              the document and what spans it, plain TypeScript
    document.ts, documentEdits.ts, framing.ts, geometry.ts, values.ts, assertNever.ts
  layers/
    layer.ts, base.ts, strokes.ts, layerEdits.ts      plain TypeScript
    LayerContent.tsx, layerTransform.ts               draws any layer
    image/      image.ts, adjustments.ts, mask.ts (from model/cutout.ts), imageEdits.ts, ImageLayerView.tsx
    text/       text.ts, textEdits.ts, TextLayerView.tsx, textLayerLayout.ts, fonts.ts
    drawing/    drawing.ts, drawingEdits.ts, DrawingLayerView.tsx
    shape/      shape.ts, shapeGeometry.ts (from model/shapes.ts), shapeEdits.ts, ShapeLayerView.tsx
    redaction/  redaction.ts, redactionEdits.ts, RedactionLayerView.tsx
    panel/      LayersPanel, LayerRow, layerListEntries, layerReorder (the Layers panel, now editor/layers/)
  render/                draws a whole document, plain props, no store
    renderDocument.tsx, DocumentRenderScene.tsx, drawOffscreen(.web).ts, decodedImages.ts,
    imageCache.ts, useDecodedImage.ts, decodeImageLayers.ts, keptBounds.ts
ui/
  color.ts               from model/color.ts (step 2)
```

Notes on the tree:

* **What goes in `layers/` and what goes in `render/`.** A layer type's folder holds whatever only that type needs. Text fonts only matter to text layers, so they go in `text/`. Image decoding and the offscreen surface serve the whole document (masks and masked redactions decode images too), so they stay in `render/`. `keptBounds` is used only by `renderDocument`'s trim, so it stays there too.
* **Shared stroke geometry.** `strokes.ts` stays at the root of `layers/`, since drawing, image (cut strokes), and redaction (mask strokes) all use it.
* **Layer folders that import each other.** `drawingEdits.ts` imports `shape/shapeGeometry.ts`, since an eraser removes whole shapes, and `layer.ts` imports every type. Type folders may import each other's plain files. Only `LayerContent` and `DocumentRenderScene` import every view.
* **Out of scope.** `canvas/layerBounds.ts` switches on layer type too, but it's canvas geometry that the canvas, hit-testing, and two tools use. It stays where it is. A later pass can decide whether each type's bounds belong in its own folder.

## 3. Rules afterwards

* **Two entry files.**
  * `@/editor` (`index.ts`) gains `renderDocument`, `renderThumbnail`, `drawOffscreen`, `LoadFonts`, and `resetFailedFonts`.
  * `@/editor/core` (`core.ts`) is new. It re-exports, in plain TypeScript, what `projects/`, `photos/`, the screens, and their Node tests use: the document and its checks, `isLayer`, `layerFiles`, the layer types and their factories, `values.ts`, and `Size`. It's the same split the text input package has between its root entry and `/core`.

  Node tests import `core.ts` by relative path. Nothing inside the editor imports either entry. Outside the editor, code imports only these two.
* **The plain-TypeScript rule is now per file.** Today it's "`model/` stays plain TypeScript". Afterwards: `document/` and the lowercase `.ts` files in `layers/` (types, factories, checks, edits, geometry) import no React, React Native, or Skia, so Node's tests run them. The views and `layerTransform.ts` are the only Skia files in `layers/`.
* **What `render/` may read.** "`render/` never reads the store" now applies to `editor/render/` and the views in `editor/layers/`.
* **The Layers panel.** "Tools and Layers don't import each other" becomes "tools and the Layers panel (`layers/panel/`) don't import each other". Tools, `canvas/`, and the store import the layer types freely.
* **`ui/`.** `ui/` no longer needs its exception for `model/color.ts`. The editor imports `ui/color.ts` as it imports the rest of `ui/`.
* **Import order.** `app → screens → editor → photos / projects` doesn't hold any more, since `projects/` and `photos/` import `@/editor/core`. The order becomes `app → screens → editor`, with `photos/` and `projects/` beside the screens and importing only `@/editor/core`. The editor still imports neither.

## 4. Steps

Each step leaves the app working and is its own commit. Each runs `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build:web`, and `pnpm --dir docs/interactive build`, and in the same change updates docs/architecture.md, AGENTS.md (the paths named in Learnings and Conventions), and the docs lessons. Move files with `git mv` so their history follows. `build:web` checks only the web bundle. A step that moves a file with a `.web.ts` counterpart (`drawOffscreen`) also bundles for iOS (`pnpm expo export -p ios`, output not kept), and the app opens on web to check that the editor, export's preview, and a home thumbnail still render.

1. **Render into the editor.**
   * Move `editor/layers/*` to `editor/layers/panel/`.
   * Move each `render/layers/<Type>LayerView.tsx` into `editor/layers/<type>/`, `textLayerLayout.ts` and `fonts.ts` into `layers/text/`, `LayerContent.tsx` and `layerTransform.ts` into `layers/`, and the rest of `render/` (with its three tests) into `editor/render/`.
   * Export the five names in section 3 from `@/editor`, and point export, home, the editor's route, and `_layout.tsx` at them.
   * Update the docs' render chapter (its folder becomes `src/editor/render`, as section 5 says) and the `@src/render/...` sources. `model/` stays where it is. In the meantime the editor's `layers/` and `render/` import it, which the editor may already do.
2. **Colors into `ui/`.** Move `model/color.ts` and its test to `ui/color.ts`. Point `ui/hsv.ts`, the layer types, the editor, and `render/` at it. Drop `ui/`'s exception from the boundaries. This is small, and it's separate so step 3 is only moves.
3. **Model into the editor.**
   * Move `model/layers/*` into the type folders as `<type>.ts`. Move `shapes.ts` to `shape/shapeGeometry.ts`, `cutout.ts` to `image/mask.ts`, `adjustments.ts` to `image/`, and `strokes.ts`, `base.ts`, and `layer.ts` to `layers/`.
   * Split `model/edits/` as in section 2.
   * Move `document.ts`, `framing.ts`, `geometry.ts`, `values.ts`, and `assertNever.ts` to `editor/document/`.
   * Add `core.ts`. Point `projects/`, `photos/`, the screens, and their tests at `@/editor/core` (relative `.ts` in tests). Point the store and the rest of the editor at the new files by relative path.
   * Retarget the docs' `@model` alias (or replace it with `@src/editor/...`) and every `@model/` and `@src/model/` path. Delete `src/model/`.

   This step is the largest. It's all moves and import rewrites, and `tsc` and the Node tests catch any path that's missed.
4. **Read-through.**
   * Rewrite docs/architecture.md's Modules and Boundaries sections around the new tree, rather than leaving step-by-step patches, including "Adding a layer type", which becomes "add a folder in `editor/layers/`, a case in the `Layer` union, `LayerContent`, and `DocumentRenderScene`".
   * Read the docs app's chapters through once more (section 5).
   * Check that AGENTS.md names no old path (`grep -rn "model/\|render/" AGENTS.md docs`).

## 5. The docs app's chapters

Each chapter in `docs/interactive/src/lessons.ts` names a folder:

* "The model" becomes **"The document"**, with folder `src/editor/document`. Its lessons cover the document's transforms, layers, strokes, and framing.
* "Rendering" keeps its title, with folder `src/editor/render`. Its first lesson draws each layer type with that type's view, now in `editor/layers/`.
* The store chapter is unchanged.

The chapters keep their ids (`model`, `render`), so links to lessons still work. The comment above the list ("down to the model") becomes "down to the document". Step 1 changes the render chapter's folder and step 3 the model chapter's. The lessons themselves stay as they are.
