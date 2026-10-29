# Architecture

The editor keeps the original photo and represents edits as an
`EditorDocument`. Layer transforms use document-space coordinates, independent
of the preview size. The canvas fits that document into the available screen
space, while gesture state is held outside React during an interaction and
committed to the document when the gesture ends. Export and project thumbnails
render the same document offscreen with Skia.

Skia draws the whole editing surface: the canvas is never a set of positioned
React Native views, which only make the chrome around it (toolbars, panels,
dialogs). The editor is the project's own, with no commercial photo-editor SDK,
and native code stays behind narrow modules (`modules/`) rather than taking
over any of the editor.

## The shape

Each area of `src/` has one job, and imports flow from the top of this list
down:

- **Routes** (`app/`) name the URLs and hand each to a **screen** (`screens/`):
  Home, Create, Export, the info pages, and the editor's route, which opens a
  project and saves it.
- The **editor** (`editor/`) is a component the app composes rather than a
  screen. It knows nothing of projects, photos, or navigation: the app hands it
  an `EditorHost` for those, and a list of tools, each a folder of its own.
- **Photos** (`photos/`) and **projects** (`projects/`) are the app's concepts:
  picking and importing images, and keeping each session as a project on the
  device.
- **Render** (`render/`) draws a document with Skia, for the editor's canvas,
  export, and thumbnails alike.
- The **model** (`model/`) is the document and every edit to it, in plain
  TypeScript, which the rest builds on and Node's tests run directly.
- Underneath, `site/` holds what the web site says about itself, `ui/`
  the shared controls and theme, and `platform/` the OS ports (preferences,
  haptics, files).

[Modules](#modules) says what each folder holds, and
[Boundaries](#boundaries-and-platform-files) the import rules that keep it
that way.

## Modules

- `src/app/` holds only thin Expo Router route files (every file there becomes a screen). A project's editor is at `/projects/[id]` and its export at `/projects/[id]/export`, so a link or a reload opens the project from storage (`useProjectSession`); `vercel.json` serves those routes from the static export.
- `src/screens/` has a folder per screen: `home/`, `create/`, `editor/` (the editor's route), `export/`, and `info/` (`InfoPage`, Settings, the support, privacy, and licenses pages, which the stores link to, and the 404 page). The home screen starts from a photo, a pasted or dropped image, a photo shared from another app, or, through Create, an empty canvas at a preset or custom size. Screens compose the shared capabilities (home and the editor hand `renderThumbnail` from `render/` to `closeProject`) and don't import each other. A folder lives in the screen that uses it, or at `src/` when several screens do.
- `src/screens/editor/` is the editor's route: `EditorScreen` opens the project from its params (`session/`'s `useProjectSession`), shows it opening or why it couldn't, saves it as it's edited (`useAutosave`), and hands `<Editor>` the document and its host.
- `src/editor/` is the interactive editor. `index.ts` is its entry file, the only one the rest of the app imports: `Editor`, the `EditorHost` type, and the session (`session.ts`) that Home, Create, Export, Settings, and the editor's route open, close, and read: the document open in it, or none, and the key the app opened it with (a project's id, or null when it couldn't be saved), through `useSession` in React and `getSession` outside it. The editor uses the key only as Cut out's cache key. The editor knows nothing of projects, photos, or navigation: the app hands it an `EditorHost` (`editorHost.ts`), which picks and imports photos, keeps an image the document gains, names the document and says whether it's saved, says whether the editor is in front, and leaves or opens export. The editor declares the host's types (the picked image and its size limits), which `photos/` and `projects/` meet without the editor importing either. Every part that needs the host runs in `Editor`'s body, so `Editor` hands each what it needs as arguments. The rest is in a folder per part:
  - `store/` holds the editor's state as one Zustand store, outside `<Editor>` since Create opens a document before the editor mounts: `index.ts` makes `useStore`, and `editorSlice.ts` owns the document, its key, selection, undo history, tool sessions, and every edit that mutates them (the edits themselves are in `model/edits/`). Nothing outside the editor reads it but through the session. State local to one screen stays in `useState`, or `usePreference` from `platform/` when it should outlast the session (a tool's settings), which every caller of a key shares; a preference has one parser beside its settings that makes a valid value of anything saved, since an older build or a damaged file may have written it. Components select the narrowest value they need.
  - `canvas/` holds the canvas pieces every mode shares: the viewport and zoom (which Crop draws with too), live transforms (`LiveLayerContent`, `LiveStrokeOverlay`), the selection overlay, handles and cursors, hit-testing, snapping, touch metrics, and the stroke pipeline Draw, Redact, and Cut out share, the gestures and drawing of the `regions` and `dial` inputs (`useRegionTap` and `RegionOutline`, which Find's found regions use; `useDialDrag`, the sideways drag that turns Adjust's dial), and the checkerboard that stands for transparency (`CanvasBackground`), which no render of the document draws.
  - `tools/` has a folder per tool in the dock: `adjust/`, `crop/`, `cutout/`, `draw/`, `find/`, `redact/`, and `stickers/`. A tool reaches the canvas only through its input (`canvasInputFor.ts`), whose gestures and drawing are the canvas's, or draws its own canvas in the stage's place (Crop's `Stage`).
    - `find/` holds face and text detection (`useImageDetection`, `FindPanel`), and the review that zooms to each region (`useReviewZoom`, in Find's hook rather than a view, which the tray and the layout mount and unmount).
    - `cutout/` holds subject and object selection, mask refinement brushes, invert, and mask-shaped redactions.
    - `adjust/` holds color adjustments: its `dial` input carries the drag's dial and the photo it changes, which the canvas draws live (`LiveAdjustment`).
    - `crop/` crops, turns, flips, and straightens the photo (the lowest locked one, or just the canvas without one) and expands the canvas around it. Its hook keeps a draft, started from the document each time it opens, which its Done reframes the document to in one step; its spec takes the keys (`takesKeys`). `CropCanvas` is its `Stage`, and `CropPanel` holds its tabs, its bar, and its `Controls`. Its geometry is in `cropGeometry.ts` and its box dragging in `cropDrag.ts`.
    - `stickers/` holds the sticker sheet, bundled stickers, and the ones people save, with their storage (and its `.web` files), so a toolbar without Stickers leaves all of it out. Adding a sticker closes Stickers, so its layer is an undo step of its own, and its layer action keeps a selected photo as a sticker. The photo picker waits for the sheet to finish closing (`sheetDismissed`), since on iPad one opened sooner goes down with the popover.
  - The editor's own mode and panel sit beside `tools/`, since neither is a tool in the list:
    - `text/` holds the text panel, starting and finishing an edit (`useTextEditing`; `Editor` mounts the package's `HiddenTextInput`, which takes the keyboard), and text's pieces on the canvas: `EditedTextView`, which draws the draft with the package's `Caret` and `SelectionHighlight`, and its edit gesture (`useTextEditGesture`).
    - `layers/` holds the layers panel, where any layer is hidden, locked, deleted, or reordered.
  - A tool's settings module (`brushSettings`, `redactSettings`, `cutOutSettings`, Crop's `cropOptions`) holds its rules: which size the sub-tool in use keeps, what counts as a brush, which ratios Crop offers. Its panel file holds one table per list of choices (`BRUSHES`, `REDACT_TOOLS`, `CUT_TOOLS`, `BRUSH_EDGES`, `CROP_TABS`; Redact's effects are shell's `EFFECTS`). Its dock panel, bar, and tray read both, and keep only what differs between them: what a press on the sub-tool in use does, how a choice is drawn, and its label.
  - `shell/` holds the dock, the wide editor's context bar, the toolbar, the header's actions, layer actions, the selection bar, tool buttons, trays, the dial, color swatches and the color options built on them (`ColorOptions`, `ColorChip`), the banner for a failed save (`SaveErrorBanner`), and the other controls every tool's panel is built from.
  - How new redactions look (`RedactLook`: the effect, color, and strength) is the editor's, not Redact's: `shell/redactLook.ts` holds it and turns it into a `RedactionEffect`, and `shell/redactStyle.tsx` its controls. Redact, Find, and Cut out each add redactions in it, and none opens another: Find's Done adds the regions chosen and closes Find, and Cut out's Redact takes back the cut, adds a redaction in its shape, and closes Cut out. `shell/useRedactLook.ts` keeps it under its own preference (`redactLook`), which Redact's, Find's, and Cut out's hooks and Find's views each read, and which starts from the look earlier builds kept in Redact's settings (`redactSettings`, now only its sub-tool and brush sizes).
  - `detection/` is the editor's only bridge to `image-analysis`: `imageDetection.ts` finds faces and text for Find, and `subjectDetection.ts` selects subjects and objects for Cut out.
  - Each tool in the mode (Draw, Redact, Find, Stickers, Crop, Adjust, Cut out) describes itself in two files of its own folder:
    - Its spec (`drawSpec.ts`, a `ToolSpec` from `toolSpec.ts`), in plain TypeScript so Node's tests can read it: what it works on (nothing, any photo, or the image it started on), whether it has a tray, whether `[` and `]` step its brush, whether it keeps a draft and takes the keys while it's open (`takesKeys`: the editor's shortcuts, paste, and drop wait, Escape and Enter run Done, Export hides, and the layers can't be changed), its button (label, icon, and key), its line in the list of shortcuts, and which selected layers offer it (`actsOn`). `builtInSpecs.ts` lists the built-in ones by id, with the default toolbar (`BUILT_IN_TOOLBAR`). A tool's id is its key in the list, and inside the editor a plain string: `editorMode.ts` keeps one shape of tool mode, whose image and tray follow the spec at runtime, and the mode reducer, `settle`, `shortcutCommand`, and the chrome take the specs they work with. Adding a tool adds no case there.
    - Its definition (`drawTool.ts`), built with `defineTool` from its spec: its hook (`useController`), given what the editor gives it (`ToolEnv`: the document and its size, whether it's open, the image its target gives, closing, the edit notice, zooming the canvas, keeping an image, adding an image layer one at a time as Add photo does, and picking or reading a photo as the host does); its views for the dock, the bar, the tray, the results over the canvas, the inspector, a canvas of its own in the stage's place (`Stage`, for a tool with no canvas input), a strip under it (`Controls`), and a sheet (`Sheet`, which the editor shows in a bottom sheet on a phone and a popover beside the tool's rail button on a wide window, with what it does once that has closed), each given its controller (what its hook returns); what readies it before it opens, like picking the sub-tool that fits the selection (`prepare`), and what it does with its photo once its undo session has begun (`started`); what input on the canvas does while it's open, and what a finished stroke does (`canvasInput`, `finishStroke`); what Done says and does; whether Done lets go of the selection; what the header's Reset does while it's open (`reset`) and what the editor announces for it (`announcement`); a button it adds to a selected layer's actions (`layerAction`); and, exactly when its spec is `sized`, how `[` and `]` step its brush. `builtInTools.ts` lists the built-in ones by id, the list `<Editor>` has unless it's given its own `tools` and `toolbar` (the order of the dock's and the rail's buttons, mixing tool ids and the editor's own Text and Add photo); `editorTools({ tools, toolbar })` (`defineTool.ts`) checks that a toolbar names only listed tools. The editor reads the list once, since each tool's hook runs every render. Nothing in the editor but those two files imports a tool. A tool's hook runs in `Editor`'s body, above the context it provides, so it reads what it needs from `ToolEnv`, the store, and shared preferences. A tool's views read what isn't the tool's (the custom color and eyedropper, the tray, the inset, whether the window is wide, Cancel) from `editorContext.ts`, and the redaction look from its shared preference (`useRedactLook`), (`useEditorContext`, `useColorTarget`), which `Editor` provides.
  - The editor root holds `Editor`, `EditorHeader`, `PanelViews` (which shows the open tool's views, or text's or a selected layer's, in each slot), `EditorRail`, `EditorInspector`, `EditorCanvas` and `EditorScene` (which compose the canvas with each input's gestures and overlays), `LayerSelectionBar`, and `editorChrome` with `useEditorChrome` (see [Editor layouts](#editor-layouts)), which compose the parts, and what spans the whole editor: adding images (`useAddImage`), its mode, what input on the canvas does (`useCanvasInput`, `canvasInputFor`: the eyedropper's pick, the open tool's input, typing, or selecting, whose kinds name what they do rather than a tool), how its tools are built and how they open and close (`useEditorTools`, which calls each definition's `useController` in the list's order and starts any tool from its spec and definition), keyboard shortcuts, and the edit notice (`useEditNotice`: deleting, and what a tool notifies, like Find's redaction, with Undo). The background picker is in `src/ui/` because Create also uses it.
- `src/model/` defines the document, layers, cutout masks, geometry, and the document's colors (`color.ts`) as plain TypeScript: no React, React Native, or Skia. The document is the canvas (its size, and a background fill or transparency) and its layers, which may be none. Each layer type has a file in `model/layers/` with its type, its factory, its check for a saved layer, and helpers only it needs (`base.ts` holds what every layer shares, `layer.ts` the `Layer` union and what works on any layer); `document.ts` holds the document, its groups, and whole-document checks. Callers import from the file that declares a name: there's no barrel. Pure logic only the editor uses (`canvas/viewport.ts`, `canvas/layerBounds.ts`, `canvas/handleGeometry.ts`) lives in `editor/` instead.
  - A photo is an image layer like any other: a document's own photo starts locked, and can be unlocked, reordered, hidden, or deleted; photos added later start unlocked. `framing.ts` moves the framing's anchor (the lowest visible locked image, or with none, the canvas itself) to a new place on a new canvas and keeps every other layer over the same spot, which is all cropping, turning, and flipping are.
  - Imported photos are already upright: the import's re-encode applies EXIF orientation and writes no orientation tag (web re-encodes through a canvas), so a layer's `width` and `height` are the upright size. `image-analysis` applies EXIF orientation itself, so its rectangles are in upright pixels for any file.
- `src/photos/` picks, pastes, or receives a shared photo and re-encodes it as JPEG (iPhone photos are commonly HEIC, which Skia cannot decode).
- `src/projects/` keeps every editing session as a local project: its photos move into it, each as a file of its own, edits autosave, and the home screen lists projects to reopen, rename, duplicate, or delete, each with a thumbnail rendered when its editor closes. `projectFile.ts` is the saved format (versioned, with image layers naming their file in the project); `projectLifecycle.ts` opens, saves, and closes projects, removing files no layer uses once one closes, with storage passed in so Node can test it.
- `src/render/` is how a document draws: a view for each layer type in document space (in `layers/`), `LayerContent` and `useDecodedImage` (which the editor's canvas and crop use too), the decoded-image cache, `fonts.ts` (which bundles the text fonts so text renders identically on iOS, Android, and web), and `DocumentRenderScene`, which renders offscreen for export and project thumbnails. It takes plain props and never reads the store, so export can render any document. `src/screens/export/` chooses output sizes and format, then saves the image to Photos, copies it, or shares it: as JPEG, or as PNG when some of the canvas is transparent.
- `src/ui/` holds reusable controls, including `Popover`, `ColorPicker`, `SwatchChip`, and `FadeRow` (a scrolling row that fades between whole options), and `theme.ts`.
- `src/site/` holds what the site says about itself: its address and support email (`site.ts`) and each page's head (`PageHead`), which the routes, Home, and the info screens use.
- `src/platform/` holds the OS ports any caller can use: haptics, preferences (`preferenceStore`, `usePreference`), temporary files, a file pasted or dropped onto the page (`usePhotoDrop`), and the service worker, each with a `.web.ts` version where the web differs.
- `modules/` holds local Expo modules with native code, autolinked without a `package.json` entry. `modules/image-analysis/` does on-device face, text, subject, and object detection (Apple Vision, Google ML Kit, MediaPipe, Tesseract, and MobileSAM with ONNX Runtime; see [on-device-detection.md](./on-device-detection.md)); the app imports it as `image-analysis` through a `tsconfig.json` path. `modules/share-target/` is the share extension on iOS and the share activity on Android.
- The repository is a pnpm workspace (`pnpm-workspace.yaml`): the app at the root, `docs/interactive/`, and `packages/*`. `packages/skia-text-input/` (`@tuck/skia-text-input`, private for now) is the canvas text editing the editor builds on. Its `/core` entry is plain TypeScript and Skia's types: word selection, and `createCaretLayout`, which measures where a caret, a selection, and a tap fall in a paragraph the caller builds (`render/textLayerLayout.ts` gives it the text layer's). Its root entry adds the React Native parts (`HiddenTextInput`, `Caret`, `SelectionHighlight`), which need Reanimated too; the gesture follows by [the text input package plan](./plans/text-input-package-plan.md). Only the editor imports the root entry, so `render/` and the interactive docs load no React Native from it. The app depends on it as `workspace:*`, and its `exports` point at its `.ts` source, so nothing builds it first. A package there lists React, React Native, and any native library it uses as `peerDependencies`, so the app keeps one copy of each, and imports nothing from `src/`.
- `index.ts` / `index.web.ts` are the app entry. On web, it loads Skia's WASM build before any app code runs.

## Boundaries and Platform Files

Imports flow one way: `app` → `screens` → `editor` → `photos` / `projects` /
`render` → `model`, with `ui/` beneath the screens and the editor,
and `platform/` beneath them and `ui/`. `model/` stays plain TypeScript, so its helpers
(`assertNever`, the document's colors) serve any layer.

- `photos/`, `projects/`, `render/`, and the editor's `store/` import only `model/`.
- `ui/` never imports app code, except `platform/preferenceStore`, which `theme.ts` reads at launch, and `model/color.ts`, which the color picker's HSV math (`hsv.ts`) builds on. `platform/` and `site/` import only themselves, and only routes and screens import `site/`, never the editor.
- Outside `src/editor/`, the app imports the editor only from `@/editor`, and nothing inside the editor imports `@/editor`: its files reach each other by relative path. The editor imports no route, screen, `photos/`, `projects/`, or `expo-router`: what it needs from the app comes through its host. The route's `session/` imports only the editor's entry file.
- In the editor, tools, Layers, and Text don't import each other. A tool reaches the rest of the editor only through `defineTool.ts`, `toolSpec.ts`, `editorContext.ts`, the canvas's input types (`canvasInputFor.ts`), the host's types (`editorHost.ts`), the store, `canvas/`, `shell/`, and `detection/`; Layers and Text through `editorContext.ts`, the store, `canvas/`, and `shell/`, and Text through its mode (`editorMode.ts`) too. What reaches a tool at runtime splits the same way: its hook runs in `Editor`'s body, above the context `Editor` provides, so it gets `ToolEnv`, the store, and shared preferences, and only its views read `editorContext.ts`. `shell/` imports nothing else from the editor (except `shortcuts.ts` for the editor's own keys); `detection/` imports nothing else from it; `canvas/` imports nothing else from the editor but `shell/`, and tools may import `canvas/`.

No tool enforces these boundaries: this list is the rule, and changes when
the structure does. That's on purpose. Encoding them in `biome.json` took over
a thousand lines, so `biome.json` stays small and nothing checks imports. If a
boundary ever truly needs a check, it gets a few lines, not a rule set.

Adding a layer type means a file in `model/layers/` for its type and factory,
a case in the `Layer` union (`model/layers/layer.ts`), a view in
`render/layers/`, and a case in `LayerContent` and `DocumentRenderScene`
(`assertNever` flags any you miss).

Platform differences live in `.web.ts` files next to their native versions
(`saveImage.web.ts` downloads instead of saving to Photos;
`projectStorage.web.ts` keeps projects in IndexedDB, since `expo-file-system`
has no web implementation; `showAlert.web.tsx` draws its own dialog because
React Native Web's `Alert` does nothing).

## Editor Layouts

Phones keep the dock and its trays. A wide window (1024 points and up, web and
iPad) puts the tools in the rail and the open tool's options in the header's
context bar (`shell/ContextBar`), with the layers in the inspector; DESIGN.md
gives the sizes, and the shorter-window and fine-pointer variants.

- `editorChrome.ts` builds the toolbar's buttons from the specs and the editor's own entries (`toolbarEntries`, with `TOOLS` and `TOOL_KEYS` holding only the editor's own), and a selected layer's actions: the tools whose spec acts on it, in the toolbar's order (`layerActionsFor`), followed by the buttons tools add for it (a definition's `layerAction`, like Save as sticker). The list of shortcuts takes its tool lines from the same buttons (`shortcutGroups`).
- `modeChrome` (`editorChrome.ts`) chooses the panel, its title, and what ✕ and ✓ do, once for both layouts, and whether the panel sits in the bar (on a wide window, every panel but `"idle"`). The bar's ✕ and ✓ are `ModeActions`, shared with the dock's footer, which only draws them.
- What each panel shows comes from the open tool's definition (its `views`), or, for text and a selected layer, from `PanelViews.tsx`. A tool's title and actions stay in `editorChrome.ts`. So the two layouts can't disagree about which panel shows, what it does, or which tools they offer.
- A tool's `Stage` (Crop's canvas) is drawn opaque over the canvas inside the stage, clear of the rail, the inspector, and the dock (`ToolStage` in `PanelViews.tsx`), with its `Controls` strip under it: above the dock on a phone, along the stage's bottom on a wide window. A tool's `Sheet` (Stickers') is a bottom sheet on a phone and a popover beside its rail button on a wide window (`ToolSheet`); the rail gives each such tool's button an anchor.
- Find's Faces, Text, and Both, and Adjust's dial, are inspector sections above the layers, because they need the column's height. `AdjustPanel` is `flex: 1` for the phone dock's fixed slot, so the inspector's Adjust section leaves `flex` off and follows its content (`AdjustInspector`), while the layers take the rest.
- `optionsOpen` (the context's `trayOpen`) is only the phone's tray; the wide layout never reads it. A popover's open state belongs to its chip.
- The layers inspector stays open when the window is at least 960 points tall (`editorFrame`).
- A fine pointer gets controls sized for a mouse (`compactControls` from `ui/density.ts`). It's read once as the page loads, like the palette, so each size is a constant chosen when its module loads (`HEADER_HEIGHT`, `PANEL_GAP`, `RAIL_WIDTH`).

### The context bar

A tool returns its options as `BarGroup`s and the bar (`BarSections`) inserts
the rules between them: `Children.toArray` doesn't enter a component, so the
bar can't find groups inside one. A fragment is one child of a group, so the
buttons inside it stack in that slot. The row scrolls, and its fade covers
from the first option that doesn't fit whole (`ui/FadeRow.tsx`, its geometry in `ui/rowFade.ts`); `onLayout` x is
relative to the parent, not the scrolled viewport, and a chip's popover sits
outside that measurement parent so its choices don't count as options.

### Popovers

`ui/Popover` is modal on web and on native. `placement` is `below` (under the
control, or above it near the window's bottom) or `beside` (at the control's
right, top-aligned, for a button in the rail). On web it portals to
`document.body`, sits under tooltips and alerts, and stops Escape in the
window's capture phase, so the editor doesn't also finish the tool.

While text is being typed, a press in the context bar would blur the hidden
input: the bar prevents that mousedown's default on web (`keepFocus`), as the
canvas does, and the popover's `restoreFocus` returns the caret to the input.

## Rendering

- **Straight onto the canvas.** The editor and export draw each document layer straight onto the canvas, never inside a saved layer: a Skia backdrop filter reads only the layer it's drawn in (so redactions blur the photo), and a highlighter's multiply blends onto whatever is beneath.
- **Redactions.** The declarative API can't draw into a backdrop layer, so `RedactionLayerView` records an `SkPicture` that calls `saveLayer` with a backdrop itself. Pixelation is built from blur, displacement map, shader, offset, and morphology filters (`pixelateFilter`), since Skia's web build has no runtime-shader or picture image filters.
- **Highlighter.** A highlighter stroke starts a drawing whose `blend` is `"multiply"` (`strokeBlend` in `model/layers/drawing.ts`). `drawStroke` joins the selected drawing only when the stroke blends the same way, so a pen or the see-through marker (`tip: "ink"`, drawn at `MARKER_OPACITY`) stays on its own layer, while an eraser joins either. `DrawingLayerView` sets the blend on the group's paint and draws the strokes at full strength, so strokes in one layer composite normally and the group multiplies once: two highlights darken where they cross only when each is its own layer. A marker saved before the field has no `blend` and still draws at `MARKER_OPACITY`. Multiply vanishes on a near-black canvas and turns white text the highlight color there, which is why the see-through marker remains. On web, multiply was checked over white (`#FFD60A` stays 255, 214, 10, black text under it stays black), over a second highlight (`#FFB400`), and over a blue sticker (dark olive); the export preview matched by day and at night.
- **Color space.** Skia works filters and color matrices in the surface's color space. On iOS a `Canvas` defaults to Display P3, while offscreen renders (export, thumbnails, the eyedropper) and the web are sRGB, so the editor's and crop tool's canvases set `colorSpace="srgb"`; any canvas that previews the document should too.
- **Decoded images.** Image layers load through `decodeImage` and the shared `decodedImages` cache (`render/decodedImages.ts`), so the editor and export hold one copy of each image and a failed read or decode rejects instead of resolving to `null`. A holder releases an image and forgets it in the same cleanup. `useDecodedImage` keeps showing its image until the next has decoded, and releases it only in the step that swaps its state. Anything that keeps an image past its holder (a recorded `SkPicture` keeps its pixels) is cached by the decoded image, as `maskedRedactionPicture` is. The cache waits two animation frames before freeing, since on web a Skia canvas can still replay the scene recorded before React let go of an image.
- **Offscreen.** `render/drawOffscreen.ts` is `drawAsImage` on native and one shared surface on web, where each `drawAsImage` would make a WebGL context of its own. The export sheet shows its render as a small PNG data URL in a React Native `Image`, not the render's `SkImage`, which quick size changes disposed while Skia still drew it.
- **Text** is edited in place: the canvas draws the draft layer, its caret, and its selection with Skia, and a `HiddenTextInput` takes the keyboard, out of sight behind the header. A visible input can't match: React Native lays out text differently from a Skia paragraph, and can't draw the outline, per-line boxes, or a stretched layer. Caret geometry comes from `@tuck/skia-text-input/core` (`packages/skia-text-input/`), which `render/textLayerLayout.ts` gives the text layer's paragraph.
- **Worklets.** Geometry gestures need on the UI thread is marked `"worklet"`, in `model/` as well (`geometry.ts`, `strokes.ts`'s hit testing, `layers/shape.ts`'s line checks), `render/layerTransform.ts`, and the editor's `canvas/`, crop, layer reorder, and dial modules. The directive is just a string, so `model/` stays free of React Native.

## Web

The web app is a static export hosted on Vercel at tuck.tools.

- **Entry.** Skia's module binds to CanvasKit the moment it's first evaluated, and Expo Router evaluates every route at startup, so `index.web.ts` loads CanvasKit and only then dynamically imports `expo-router/entry`. It imports `expo` first, because Expo's runtime installs the loader Metro's dynamic `import()` needs.
- **No hydration.** `index.web.ts` sets `__EXPO_ROUTER_HYDRATE__` to false, so the browser renders each page afresh. The server's HTML can't match the client's: it's in the day palette, and the server has no icon font. The prerendered HTML is only a placeholder until the bundle and CanvasKit load. `+html.tsx` applies a chosen palette to the page before the app loads.
- **Hosting.** Vercel only serves files: `vercel.json` turns on `cleanUrls` (`/create` → `create.html`) and rewrites each dynamic route to the page Expo exports for it, named without `.html` (`/projects/:id` → `/projects/[id]`). A new dynamic route needs a rewrite there, and a moved route a redirect there: Expo Router's `redirects` option doesn't run in a static export's client. Vercel answers an unknown path with `404.html`, which `build:web` copies from Expo's `+not-found.html`.
- **Routes.** A project's routes can be the first screen, from a link, a reload, or Back and Forward. The editor opens its project itself with `useProjectSession`; export sends the user to the editor to do that. Export is a `containedTransparentModal` sheet (`src/app/_layout.tsx`), so the editor stays mounted behind it, unfocused, with its keyboard shortcuts off. `unstable_settings.anchor` isn't used to put home underneath, because Expo Router hands the anchor the link's params (going back shows `/?id=…`). The editor's Back replaces the route with home when there's nothing behind it.
- **Content Security Policy.** `vercel.json` allows only the site itself, plus `blob:`, `data:`, and `'wasm-unsafe-eval'`. Anything new the app loads or connects to, or a new inline script, needs it changed; `pnpm build:web` fails when an inline script's hash is missing from `script-src` (`scripts/check-csp.mjs`). `connect-src 'self'` also keeps MediaPipe from sending its usage logs to `odml.pa.googleapis.com`, which it does unconditionally.
- **Service worker.** `build:web` writes `dist/sw.js` from `scripts/service-worker.js` (`scripts/write-service-worker.mjs` adds the version, a hash of the precached files, and the list). It precaches the pages, scripts, fonts, icons, and CanvasKit; keeps the detection engines with the version that first used them and stickers from their first use; and serves pages from the network while online. A new version waits until home's "A new version of Tuck is ready" Reload, or every tab closes. Each version's cache holds unhashed files too, so lookups check `CURRENT` before other versions (`caches.match` alone returns the oldest copy). `index.web.ts` registers it only in a production build. Removing it means deploying a `sw.js` that unregisters itself on activate: deleting the file leaves installed workers running.
- **Shared photos.** Photos shared to the installed app (the manifest's `share_target`) are posted to the service worker, which keeps them in the `tuck-shared` cache and redirects to home's `shared` param; ones opened with it (`file_handlers`) arrive through `window.launchQueue` and are kept there too (`photos/sharedPhoto.web.ts`).

## Native

- Native configuration lives in `app.json` and config plugins, since `ios/` and `android/` are generated by `expo prebuild` (see [development.md](./development.md)).
- iOS 27 stops an app built with its SDK at launch (`EXC_BREAKPOINT` in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) unless it adopts the scene life cycle. Expo 58's template does: its `SceneDelegate.swift` creates the window and starts React Native once a scene connects.
- The app runs on iPad (`ios.supportsTablet`). An iPad app must allow every orientation and a resizable window, so Expo writes all four orientations to `UISupportedInterfaceOrientations~ipad` while the iPhone stays portrait.
- **Shared photos** come in through `modules/share-target`: an iOS share extension (a target its config plugin adds to the Xcode project) and an Android `ShareActivity`. Both copy the photo where the app can read it (the App Group `group.<bundle id>` on iOS, which Expo autolinking reads from the entitlements and `expo-file-system` can open; the cache on Android, since the content URI's grant belongs to the share activity) and open `<scheme>://share?file=<name>`. `src/app/+native-intent.ts` turns that into home's `shared` param. A link that arrives while the app runs goes through `router.dismissTo`, since a plain navigate pushes a second home over the editor.

## Documentation

- [DESIGN.md](../DESIGN.md) is the design system, [PRODUCT.md](../PRODUCT.md) the product's principles, and [development.md](./development.md) how to build, run, and test.
- `docs/interactive/` is a separate Vite app of interactive lessons ("Inside Tuck"), a workspace package with its own `package.json` and `tsconfig.json` (the root `tsconfig.json` excludes it). Lessons import the real `src/model` through its `@model` alias and quote code with `SourceView` by declaration name, so renaming or retyping something a lesson covers breaks its build (`pnpm --dir docs/interactive build`, which CI runs) or shows the lesson's "has moved" notice. Its rendering lessons run `src/render/` on CanvasKit through Vite (see its README), so a change to `render/`'s imports (a new Expo module, a native-only file without a `.web` counterpart) can break that build too.
- [AGENTS.md](../AGENTS.md) holds the implementation lessons and conventions for working in the code.
