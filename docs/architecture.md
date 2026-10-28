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

## Modules

- `src/app/` holds only thin Expo Router route files (every file there becomes a screen). A project's editor is at `/projects/[id]` and its export at `/projects/[id]/export`, so a link or a reload opens the project from storage (`useProjectSession`); `vercel.json` serves those routes from the static export.
- `src/screens/` has a folder per screen: `home/`, `create/`, `editor/`, `export/`, and `info/` (`InfoPage`, Settings, the support, privacy, and licenses pages, which the stores link to, and the 404 page). The home screen starts from a photo, a pasted or dropped image, a photo shared from another app, or, through Create, an empty canvas at a preset or custom size. Screens compose the shared capabilities (home and the editor hand `renderThumbnail` from `render/` to `closeProject`) and don't import each other. A folder lives in the screen that uses it, or at `src/` when several screens do.
- `src/screens/editor/` is the interactive editor, in a folder per part:
  - `canvas/` holds the canvas pieces every mode shares: the viewport and zoom (which crop draws with too), live transforms (`LiveLayerContent`, `LiveStrokeOverlay`), the selection overlay, handles and cursors, hit-testing, snapping, touch metrics, and the stroke pipeline Draw, Redact, and Cut out share, and the checkerboard that stands for transparency (`CanvasBackground`), which no render of the document draws.
  - `tools/` has a folder per tool: `adjust/`, `crop/`, `cutout/`, `draw/`, `find/`, `layers/`, `redact/`, `stickers/`, and `text/`. A tool's own gestures and overlays on the canvas live in its folder too (Text's `useTextEditGesture`, Find's `useFindTap`).
    - `crop/` holds `CropTool`, the overlay that crops, turns, flips, and straightens the photo (the lowest locked one, or just the canvas without one) and expands the canvas around it, with its own canvas, header, and keys. `CropPanel` holds its options on both layouts. Its geometry is in `cropGeometry.ts` and its box dragging in `cropDrag.ts`.
    - `text/` holds the text panel, `TextEditor` (the hidden input that takes the keyboard), and text's pieces on the canvas: `EditedTextView`, which draws the draft with its caret and selection, and its edit gesture.
    - `find/` holds face and text detection (`useImageDetection`, `FindPanel`), and the found regions' outlines and taps (`DetectionOutline`, `useFindTap`).
    - `cutout/` holds subject and object selection, mask refinement brushes, invert, and mask-shaped redactions.
    - `adjust/` holds color adjustments, and the sideways drag on the photo that turns the dial (`useDialDragGesture`).
    - `layers/` holds the layers panel, where any layer is hidden, locked, deleted, or reordered; `stickers/` holds the sticker sheet, bundled stickers, and the ones people save.
  - A tool's settings module (`brushSettings`, `redactSettings`, `cutOutSettings`, Crop's `cropOptions`) holds its rules: which size the sub-tool in use keeps, what counts as a brush, which ratios Crop offers. Its panel file holds one table per list of choices (`BRUSHES`, `REDACT_TOOLS`, `CUT_TOOLS`, `BRUSH_EDGES`, `CROP_TABS`; Redact's effects are shell's `EFFECTS`). Its dock panel, bar, and tray read both, and keep only what differs between them: what a press on the sub-tool in use does, how a choice is drawn, and its label.
  - `shell/` holds the dock, the wide editor's context bar, the toolbar, the header's actions, layer actions, the selection bar, tool buttons, trays, the dial, color swatches, and the other controls every tool's panel is built from.
  - How new redactions look (`RedactLook`: the effect, color, and strength) is the editor's, not Redact's: `shell/redactLook.ts` holds it and turns it into a `RedactionEffect`, and `shell/redactStyle.tsx` its controls. Redact, Find, and Cut out each add redactions in it, and none opens another: Find's Done adds the regions chosen and closes Find, and Cut out's Redact takes back the cut, adds a redaction in its shape, and closes Cut out. `useEditorTools` keeps it in Redact's saved settings (`redactSettings`).
  - `detection/` is the editor's only bridge to `image-analysis`: `imageDetection.ts` finds faces and text for Find, and `subjectDetection.ts` selects subjects and objects for Cut out.
  - `session/` holds the project session: `useProjectSession` opens the project, `useAutosave` saves it, and `SaveErrorBanner` shows a failed save.
  - Each tool in the mode (Draw, Redact, Find, Cut out, Adjust) describes itself in two files of its own folder:
    - Its spec (`drawSpec.ts`, a `ToolSpec` from `toolSpec.ts`), in plain TypeScript so Node's tests can read it: what it works on (nothing, any photo, or the image it started on), whether it has a tray, and whether `[` and `]` step its brush. `toolSpecs.ts` lists them by name, and `editorMode.ts` derives from them the tool modes, which tool is put down when its photo or image goes, and whether `[` and `]` reach it. Adding a tool adds no case there.
    - Its definition (`drawTool.ts`), built with `defineTool` from its spec: its views for the dock, the bar, the tray, the results over the canvas, and the inspector, each given its controller (what its hook returns); what readies it before it opens, like picking the sub-tool that fits the selection (`prepare`), and what it does with its photo once its undo session has begun (`started`); what input on the canvas does while it's open, and what a finished stroke does (`canvasInput`, `finishStroke`); what Done says and does; whether Done lets go of the selection; and, exactly when its spec is `sized`, how `[` and `]` step its brush. `toolDefinitions.ts` lists them by name. A tool's views read what isn't the tool's (the custom color and eyedropper, the redaction look, the tray, the inset, Cancel) from `editorContext.ts` (`useEditorContext`, `useColorTarget`), which the screen provides.
  - The editor root holds `EditorScreen`, `EditorHeader`, `PanelViews` (which shows the open tool's views, or text's or a selected layer's, in each slot), `EditorRail`, `EditorInspector`, `EditorCanvas` and `EditorScene` (which compose the canvas with each tool's gestures and overlays), `LayerSelectionBar`, and `editorChrome` with `useEditorChrome` (see [Editor layouts](#editor-layouts)), which compose the parts, and what spans the whole editor: adding images (`useAddImage`), its mode, what input on the canvas does (`useCanvasInput`, `canvasInputFor`: the eyedropper's pick, the open tool's input, typing, or selecting, whose kinds name what they do rather than a tool), how its tools are built and how they open and close (`useEditorTools`, which starts any tool from its spec and definition), keyboard shortcuts, and the edit notice (`useEditNotice`: deleting, and redacting what Find found, with Undo). The background picker is in `src/ui/` because Create also uses it.
- `src/model/` defines the document, layers, cutout masks, geometry, and the document's colors (`color.ts`) as plain TypeScript: no React, React Native, or Skia. The document is the canvas (its size, and a background fill or transparency) and its layers, which may be none. Each layer type has a file in `model/layers/` with its type, its factory, its check for a saved layer, and helpers only it needs (`base.ts` holds what every layer shares, `layer.ts` the `Layer` union and what works on any layer); `document.ts` holds the document, its groups, and whole-document checks. Callers import from the file that declares a name: there's no barrel. Pure logic only the editor uses (`canvas/viewport.ts`, `canvas/layerBounds.ts`, `canvas/handleGeometry.ts`) lives in `screens/editor/` instead.
  - A photo is an image layer like any other: a document's own photo starts locked, and can be unlocked, reordered, hidden, or deleted; photos added later start unlocked. `framing.ts` moves the framing's anchor (the lowest visible locked image, or with none, the canvas itself) to a new place on a new canvas and keeps every other layer over the same spot, which is all cropping, turning, and flipping are.
  - Imported photos are already upright: the import's re-encode applies EXIF orientation and writes no orientation tag (web re-encodes through a canvas), so a layer's `width` and `height` are the upright size. `image-analysis` applies EXIF orientation itself, so its rectangles are in upright pixels for any file.
- `src/store/` holds only state shared across screens, as Zustand slices: `index.ts` combines them into `useStore`, and `editorSlice.ts` owns the document, selection, undo history, tool sessions, and every edit that mutates them (the edits themselves are in `model/edits/`). State local to one screen stays in `useState`, or `usePreference` from `platform/` when it should outlast the session (a tool's settings), which every caller of a key shares; a preference has one parser beside its settings that makes a valid value of anything saved, since an older build or a damaged file may have written it. Components select the narrowest value they need.
- `src/photos/` picks, pastes, drops, or receives a shared photo and re-encodes it as JPEG (iPhone photos are commonly HEIC, which Skia cannot decode).
- `src/projects/` keeps every editing session as a local project: its photos move into it, each as a file of its own, edits autosave, and the home screen lists projects to reopen, rename, duplicate, or delete, each with a thumbnail rendered when its editor closes. `projectFile.ts` is the saved format (versioned, with image layers naming their file in the project); `projectLifecycle.ts` opens, saves, and closes projects, removing files no layer uses once one closes, with storage passed in so Node can test it.
- `src/render/` is how a document draws: a view for each layer type in document space (in `layers/`), `LayerContent` and `useDecodedImage` (which the editor's canvas and crop use too), the decoded-image cache, `fonts.ts` (which bundles the text fonts so text renders identically on iOS, Android, and web), and `DocumentRenderScene`, which renders offscreen for export and project thumbnails. It takes plain props and never reads the store, so export can render any document. `src/screens/export/` chooses output sizes and format, then saves the image to Photos, copies it, or shares it: as JPEG, or as PNG when some of the canvas is transparent.
- `src/ui/` holds reusable controls, including `Popover`, and `theme.ts`.
- `src/site/` holds what the site says about itself: its address and support email (`site.ts`) and each page's head (`PageHead`), which the routes, Home, and the info screens use.
- `src/platform/` holds the OS ports any caller can use: haptics, preferences (`preferenceStore`, `usePreference`), temporary files, and the service worker, each with a `.web.ts` version where the web differs.
- `modules/` holds local Expo modules with native code, autolinked without a `package.json` entry. `modules/image-analysis/` does on-device face, text, subject, and object detection (Apple Vision, Google ML Kit, MediaPipe, Tesseract, and MobileSAM with ONNX Runtime; see [on-device-detection.md](./on-device-detection.md)); the app imports it as `image-analysis` through a `tsconfig.json` path. `modules/share-target/` is the share extension on iOS and the share activity on Android.
- `index.ts` / `index.web.ts` are the app entry. On web, it loads Skia's WASM build before any app code runs.

## Boundaries and Platform Files

Imports flow one way: `app` → `screens` → `photos` / `projects` / `render` /
`store` → `model`, with `ui/` beneath the screens and `platform/`
beneath the screens and `ui/`. `model/` stays plain TypeScript, so its helpers
(`assertNever`, the document's colors) serve any layer.

- `store/`, `photos/`, and `projects/` import only `model/`; `render/` imports only `model/`.
- `ui/` never imports app code, except `platform/preferenceStore`, which `theme.ts` reads at launch. `platform/` and `site/` import only themselves, and only routes and screens import `site/`.
- In the editor, tools don't import each other, and reach the editor through `defineTool.ts`, `toolSpec.ts`, and `editorContext.ts`, besides the types of the canvas's input (`canvasInputFor.ts`) and, for text, its mode (`editorMode.ts`). `shell/` and `tools/stickers/` import nothing else from the editor (except `shortcuts.ts` for tool key labels); `session/` and `detection/` import nothing else from it; `canvas/` imports nothing else from the editor but `shell/`, and tools may import `canvas/`.

`biome.json`'s `noRestrictedImports` overrides enforce these boundaries, and
change when the structure does.

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

- `modeChrome` (`editorChrome.ts`) chooses the panel, its title, and what ✕ and ✓ do, once for both layouts, and whether the panel sits in the bar (on a wide window, every panel but `"idle"`). The bar's ✕ and ✓ are `ModeActions`, shared with the dock's footer, which only draws them.
- What each panel shows comes from the open tool's definition (its `views`), or, for text and a selected layer, from `PanelViews.tsx`. A tool's title and actions stay in `editorChrome.ts`. So the two layouts can't disagree about which panel shows, what it does, or which tools they offer.
- Find's Faces, Text, and Both, and Adjust's dial, are inspector sections above the layers, because they need the column's height. `AdjustPanel` is `flex: 1` for the phone dock's fixed slot, so the inspector's Adjust section leaves `flex` off and follows its content (`AdjustInspector`), while the layers take the rest.
- `optionsOpen` (the context's `trayOpen`) is only the phone's tray; the wide layout never reads it. A popover's open state belongs to its chip.
- The layers inspector stays open when the window is at least 960 points tall (`editorFrame`).
- A fine pointer gets controls sized for a mouse (`compactControls` from `ui/density.ts`). It's read once as the page loads, like the palette, so each size is a constant chosen when its module loads (`HEADER_HEIGHT`, `PANEL_GAP`, `RAIL_WIDTH`).

### The context bar

A tool returns its options as `BarGroup`s and the bar (`BarSections`) inserts
the rules between them: `Children.toArray` doesn't enter a component, so the
bar can't find groups inside one. A fragment is one child of a group, so the
buttons inside it stack in that slot. The row scrolls, and its fade covers
from the first option that doesn't fit whole (`barFade.ts`); `onLayout` x is
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
- **Text** is edited in place: the canvas draws the draft layer, its caret, and its selection with Skia, and `TextEditor`'s `TextInput` is hidden, only taking the keyboard. A visible input can't match: React Native lays out text differently from a Skia paragraph, and can't draw the outline, per-line boxes, or a stretched layer. Caret geometry comes from `model/textEditing.ts`.
- **Worklets.** Geometry gestures need on the UI thread is marked `"worklet"`, in `model/` as well (`geometry.ts`, `strokes.ts`'s hit testing, `layers/shape.ts`'s line checks), `render/layerTransform.ts`, and the editor's `canvas/`, crop, layer reorder, and dial modules. The directive is just a string, so `model/` stays free of React Native.

## Web

The web app is a static export hosted on Vercel at tuck.tools.

- **Entry.** Skia's module binds to CanvasKit the moment it's first evaluated, and Expo Router evaluates every route at startup, so `index.web.ts` loads CanvasKit and only then dynamically imports `expo-router/entry`. It imports `expo` first, because Expo's runtime installs the loader Metro's dynamic `import()` needs.
- **No hydration.** `index.web.ts` sets `__EXPO_ROUTER_HYDRATE__` to false, so the browser renders each page afresh. The server's HTML can't match the client's: it's in the day palette, and the server has no icon font. The prerendered HTML is only a placeholder until the bundle and CanvasKit load. `+html.tsx` applies a chosen palette to the page before the app loads.
- **Hosting.** Vercel only serves files: `vercel.json` turns on `cleanUrls` (`/create` → `create.html`) and rewrites each dynamic route to the page Expo exports for it, named without `.html` (`/projects/:id` → `/projects/[id]`). A new dynamic route needs a rewrite there, and a moved route a redirect there: Expo Router's `redirects` option doesn't run in a static export's client. Vercel answers an unknown path with `404.html`, which `build:web` copies from Expo's `+not-found.html`.
- **Routes.** A project's routes can be the first screen, from a link, a reload, or Back and Forward. The editor opens its project itself with `useProjectSession`; export sends the user to the editor to do that. Export is a `containedTransparentModal` sheet (`src/app/_layout.tsx`), so the editor stays mounted behind it, unfocused, with its keyboard shortcuts off. `unstable_settings.anchor` isn't used to put home underneath, because Expo Router hands the anchor the link's params (going back shows `/?id=…`). The editor's Back replaces the route with home when there's nothing behind it.
- **Content Security Policy.** `vercel.json` allows only the site itself, plus `blob:`, `data:`, and `'wasm-unsafe-eval'`. Anything new the app loads or connects to, or a new inline script, needs it changed; `npm run build:web` fails when an inline script's hash is missing from `script-src` (`scripts/check-csp.mjs`). `connect-src 'self'` also keeps MediaPipe from sending its usage logs to `odml.pa.googleapis.com`, which it does unconditionally.
- **Service worker.** `build:web` writes `dist/sw.js` from `scripts/service-worker.js` (`scripts/write-service-worker.mjs` adds the version, a hash of the precached files, and the list). It precaches the pages, scripts, fonts, icons, and CanvasKit; keeps the detection engines with the version that first used them and stickers from their first use; and serves pages from the network while online. A new version waits until home's "A new version of Tuck is ready" Reload, or every tab closes. Each version's cache holds unhashed files too, so lookups check `CURRENT` before other versions (`caches.match` alone returns the oldest copy). `index.web.ts` registers it only in a production build. Removing it means deploying a `sw.js` that unregisters itself on activate: deleting the file leaves installed workers running.
- **Shared photos.** Photos shared to the installed app (the manifest's `share_target`) are posted to the service worker, which keeps them in the `tuck-shared` cache and redirects to home's `shared` param; ones opened with it (`file_handlers`) arrive through `window.launchQueue` and are kept there too (`photos/sharedPhoto.web.ts`).

## Native

- Native configuration lives in `app.json` and config plugins, since `ios/` and `android/` are generated by `expo prebuild` (see [development.md](./development.md)).
- iOS 27 stops an app built with its SDK at launch (`EXC_BREAKPOINT` in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) unless it adopts the scene life cycle. Expo 57's template doesn't; `plugins/withSceneLifecycle.js` makes the SDK 58 template's changes and can go once the template has them.
- The app runs on iPad (`ios.supportsTablet`). An iPad app must allow every orientation and a resizable window, so Expo writes all four orientations to `UISupportedInterfaceOrientations~ipad` while the iPhone stays portrait.
- **Shared photos** come in through `modules/share-target`: an iOS share extension (a target its config plugin adds to the Xcode project) and an Android `ShareActivity`. Both copy the photo where the app can read it (the App Group `group.<bundle id>` on iOS, which Expo autolinking reads from the entitlements and `expo-file-system` can open; the cache on Android, since the content URI's grant belongs to the share activity) and open `<scheme>://share?file=<name>`. `src/app/+native-intent.ts` turns that into home's `shared` param. A link that arrives while the app runs goes through `router.dismissTo`, since a plain navigate pushes a second home over the editor.

## Documentation

- [DESIGN.md](../DESIGN.md) is the design system, [PRODUCT.md](../PRODUCT.md) the product's principles, and [development.md](./development.md) how to build, run, and test.
- `docs/interactive/` is a separate Vite app of interactive lessons ("Inside Tuck"), with its own `package.json` and `tsconfig.json` (the root `tsconfig.json` excludes it). Lessons import the real `src/model` through its `@model` alias and quote code with `SourceView` by declaration name, so renaming or retyping something a lesson covers breaks its build (`npm run build --prefix docs/interactive`, which CI runs) or shows the lesson's "has moved" notice. Its rendering lessons run `src/render/` on CanvasKit through Vite (see its README), so a change to `render/`'s imports (a new Expo module, a native-only file without a `.web` counterpart) can break that build too.
- [AGENTS.md](../AGENTS.md) holds the implementation lessons and conventions for working in the code.
