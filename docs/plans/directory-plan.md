# Directory structure

A refactor plan for the source tree, written October 2026. The current top level holds up: `screens/` versus the shared capabilities (`model/`, `store/`, `photos/`, `projects/`, `render/`) tells a reader at a glance what is a screen and what several screens share. What doesn't hold up is inside the editor, where nine tool folders sit beside `canvas/` and `controls/` and the project session sits loose at the root; the two native-bridge files buried in tools; and `lib/`, meant for pure helpers, holding the OS ports the whole app shares. This plan moves files to fix those three things. The app's behavior, the project file format, and the native modules stay as they are.

Each stage leaves the app building. A stage that needs a behavior change stops and splits that change out.

## Target

```
src/
  app/                        # Expo Router. Route files only
  model/                      # plain TypeScript: the document and its geometry
  store/                      # Zustand, shared across screens
  photos/                     # picker, paste, drop, share, re-encode
  projects/                   # project file, storage, lifecycle
  render/                     # Skia. Editor, export, and thumbnails
    layers/                   # one view per layer type
  screens/
    home/ create/ export/ info/
    editor/
      EditorScreen.tsx        # and the other files that span the editor
      session/                # open the project, autosave, the save error
      canvas/                 # viewport, gestures, hit testing, overlays
      shell/                  # dock, toolbar, dial, swatches, selection bar
      detection/              # the only app code that imports image-analysis
      tools/
        adjust/ crop/ cutout/ draw/ find/
        layers/ redact/ stickers/ text/
  platform/                   # OS ports any caller can use
  ui/                         # theme and primitives
  lib/                        # pure helpers
```

`modules/`, `assets/`, `public/`, `plugins/`, `scripts/`, `index.ts`, and `index.web.ts` stay where they are.

## Rules the tree is there to keep

**Screens stay under `screens/`.** A screen doesn't import another screen. `store/` stays a top-level folder because Home, Create, Export, Settings, and the editor all read it, and its Biome rule (only `model/` and `lib/`) stays a folder rule.

**Tools are leaves.** A tool doesn't import another tool. Only `tools/crop/` imports `canvas/`. Tools may import `shell/`, `detection/`, and the files at the editor root (`editorMode.ts`, `shortcuts.ts`, and the others), except `stickers/`, which imports nothing from the editor but `shortcuts.ts`. `canvas/` imports no tool, and `shell/` imports nothing else from the editor except `shortcuts.ts`. These are today's rules with the new paths.

**`platform/` holds ports any caller can use.** A module goes in `platform/` when it imports no app code and isn't tied to one feature: haptics, preferences, temporary files, the service worker. A pair that imports its feature's modules, or that only one feature uses (photos' paste and drop, export's copy), stays beside that feature with its `.web` sibling. Callers import the unsuffixed path (`@/platform/haptics`). Metro resolves the `.web` file beside it only when the extensions match (`.ts` with `.web.ts`, `.tsx` with `.web.tsx`).

**`ui/` keeps theme and primitives**, including the primitives with a web version (`Tooltip`, `CheckerFill`, `showAlert`). `BackgroundPicker` stays in `ui/`: Create uses it, and Create can't import the editor.

**Filenames stay.** A stage moves files. It doesn't rename them. A hook keeps its `use` prefix.

**Tests stay in `__tests__/`**, as AGENTS.md describes. When a tested module moves a level deeper, its relative imports and its test's imports gain a `../`.

**`"worklet"` stays on the function.** A move doesn't strip it.

## Imports

```
app         → screens
screens     → store, photos, projects, render, model, platform, ui, lib
store       → model, lib
photos      → model, lib
projects    → model, lib
render      → model, ui, lib
ui          → platform/preferenceStore (theme.ts reads it at launch), lib
platform    → platform
lib         → lib
model       → model
```

Inside the editor:

```
root        → session, canvas, shell, tools
session     → (nothing else in the editor)
tools/*     → root, shell, detection; crop also canvas; stickers only shortcuts.ts
canvas      → root, shell
shell       → shortcuts.ts
detection   → image-analysis
```

## How to work through it

* One stage at a time, in the order below. Each stage is its own `refactor:` commit, reviewed as a move. `git mv` so history follows. Create the destination folder first (`mkdir -p`): `git mv` refuses to move into a folder that doesn't exist, for one source or several. A stage contains no logic edits. `git diff -M` is the review.
* Biome's import bans match the text of the import, not the file it resolves to, so a relative pattern counts levels from the importing file. When a folder moves a level deeper, every relative pattern in its overrides that reaches outside it needs one more `../`, for source files and for tests (which sit one level deeper still). Overrides for folders that stay put need checking too: a pattern that named the moved folder at its old path now matches nothing, and the import it banned goes through without an error.
* Overrides don't stack. When several set `noRestrictedImports` for the same file, the last one in `biome.json` replaces the others, so a file is held only to the patterns of the last override that matches it. Put a pattern in that override, and keep a stricter override after a looser one that matches the same files. To check a rewritten override, add an import it should ban to a file and a test it covers, confirm `npm run check` flags both, and delete them.
* In the same commit, update every path the stage invalidates: imports, `biome.json` overrides and their messages, `docs/architecture.md`, the Project Structure section of `AGENTS.md`, and any learning in `AGENTS.md` that names a moved file. Leave the text of a learning alone apart from the path.
* Lessons quote files by path in two places: the `file` strings in each lesson, and the raw imports keyed by path in `docs/interactive/src/source/sources.ts`. A stage that moves a quoted file updates both.
* After every stage: `npm run check`, `npm run typecheck`, `npm test`. When a quoted file or a `render/` import moved: `npm run build --prefix docs/interactive`. When a platform pair moved: `npm run build:web`. TypeScript doesn't resolve Metro's platform extensions, so a split pair typechecks while the web bundle loads the wrong file. A pure move doesn't need a device pass.
* Tick the stage here when it lands, with the commit subject.

## Stage 1: Tools under `tools/`

- [x] Landed: `refactor: move the editor's tools under tools/`

```
mkdir -p src/screens/editor/tools
git mv src/screens/editor/{adjust,crop,cutout,draw,find,layers,redact,stickers,text} src/screens/editor/tools/
```

What changes:

* The editor root's imports (`EditorDock.tsx`, `EditorScreen.tsx`, `useAddImage.ts`) gain `tools/`.
* Tool imports of root files gain a level: `../editorMode` and `../shortcuts` become `../../editorMode` and `../../shortcuts`.
* Tested modules that import `model/` or `lib/` by relative path gain a `../`: `cropGeometry.ts`, `cropDrag.ts`, `cutOutSettings.ts`, `redactSettings.ts`, `brushSettings.ts`, `findResults.ts`, `mapDetectionRects.ts`, and the others. So do their tests.
* `biome.json`: the `includes` globs and the alias patterns (`@/screens/editor/X/**`) take `tools/`. Inside the tool overrides, `../X/**` and `../../X/**` still name sibling tools, because each tool keeps its siblings. Every relative pattern that reaches past `tools/` gains a level, and these three overrides need more than that:
  * **`canvas/` and `crop/` share one override today, which splits in two.** `canvas/` doesn't move, so from there crop and the other tools are now `../tools/X/**` (`../../tools/X/**` from a test) and `@/screens/editor/tools/X/**`. The old `../crop/**` and `@/screens/editor/crop/**` patterns would match nothing and let `canvas/` import any tool. `crop/`'s half keeps its sibling patterns (`../X/**`, `../../X/**`) and doesn't ban `canvas/`, which crop alone among the tools may import.
  * **`controls/` and `stickers/` share one override today, which splits in two.** Its exceptions count levels: `!../shortcuts` and `!../../../**` (three levels up is `src/`, so it allows anything reached through `src/`). From `tools/stickers/`, three levels up is `screens/`, so copying the pattern would allow `../../../home`. The stickers half recounts: `!../../shortcuts` and `!../../../../**` for source files, and `!../../../shortcuts` and `!../../../../../**` for its tests. The `../**` ban, the tests' `!../*` (which lets `savedStickers.test.ts` import `../savedStickers.ts`), and `!@/screens/editor/shortcuts` stay. Keep the stickers override after the tools override, as it is today: stickers matches both, and the later, stricter one has to win. The `controls/` half moves to `shell/` in stage 2 with its patterns unchanged.
  * **The tools' ban on `canvas/`** lists `../canvas/**` and `../../canvas/**`. From a test in `tools/X/__tests__/`, canvas is `../../../canvas/**`, so add that level too.
* The editor-wide ban on other screens (`../create/**` through `../../../create/**`, and the same for `export`, `home`, and `info`) needs no new level. The files that use it, the editor root and `session/`, reach another screen at `../create` or `../../create`. Tool files and their tests match the tools override instead, which replaces it.
* `scripts/fetch-stickers.mjs` reads `src/screens/editor/stickers/bundledStickers.ts` (line 20) and names it in its header comment. Both become `src/screens/editor/tools/stickers/bundledStickers.ts`.
* Lessons: `src/screens/editor/crop/cropGeometry.ts` becomes `src/screens/editor/tools/crop/cropGeometry.ts`, in the lesson and in `sources.ts`.
* `AGENTS.md`: the folder-per-tool line, the "only `crop/` imports `canvas/`" line, and the worklet learning's paths (`crop/cropGeometry.ts`, `crop/cropDrag.ts`, `layers/layerReorder.ts`). `docs/architecture.md`: the editor list.

## Stage 2: `controls/` becomes `shell/`

- [x] Landed: `refactor: rename the editor's controls/ to shell/`

`git mv src/screens/editor/controls src/screens/editor/shell`. `ui/` holds the app's reusable controls, and AGENTS.md calls them that, so the editor's own folder takes another name. "Shell" is the editor's frame around the canvas: the dock, the toolbar, the tools panel, layer actions, the dial, swatches, and the selection bar.

`canvas/` imports `Dial` from it (`useDialDragGesture.ts`, `canvasInput.ts`, and the `canvasInput` test). The tools import their panels' building blocks from it. The `controls/` half of the override that stage 1 split takes the new path, and the messages that say `controls/` say `shell/`. `AGENTS.md`: the Project Structure lines that name `controls/` (what the tools share, and "`controls/` and `stickers/` import nothing else from the editor"). `docs/architecture.md`: the `controls/` entry in the editor list.

One seam stays as it is: `draggedDialValue` and `DialDrag`, the dial's gesture math, live in `shell/Dial.tsx`, and `canvas/` imports them from there. Moving that worklet out of the frame is a split of a file, not a move, so it waits for a commit of its own after this plan. `ShortcutsOverlay.tsx` stays at the editor root: only `EditorScreen` imports it.

## Stage 3: The session

- [x] Landed: `refactor: move the editor's project session into session/`

```
mkdir -p src/screens/editor/session
src/screens/editor/useProjectSession.ts → src/screens/editor/session/useProjectSession.ts
src/screens/editor/useAutosave.ts       → src/screens/editor/session/useAutosave.ts
src/screens/editor/SaveErrorBanner.tsx  → src/screens/editor/session/SaveErrorBanner.tsx
```

`EditorScreen` is the only caller. The store stays in `store/`. The other root files (`EditorDock.tsx`, `editorMode.ts`, `useEditorMode.ts`, `useEditorActions.ts`, `useEditorShortcuts.ts`, `useAddImage.ts`, `useDeleteNotice.ts`, `shortcuts.ts`, `ShortcutsOverlay.tsx`) stay at the root, because they span the editor or several tools import them.

## Stage 4: Detection

- [x] Landed: `refactor: move the image-analysis bridge into the editor's detection/`

```
mkdir -p src/screens/editor/detection
src/screens/editor/tools/find/imageDetection.ts     → src/screens/editor/detection/imageDetection.ts
src/screens/editor/tools/cutout/subjectDetection.ts → src/screens/editor/detection/subjectDetection.ts
```

These are the only app modules that import `image-analysis`. The folder sits in the editor because only the editor uses it. The tool hooks that call them (`useImageDetection`, `useCutOut`) stay in their tools and import `detection/`. `mapDetectionRects.ts` and `findResults.ts` stay in the Find tool: they map engine rectangles into document space and import only `imageDetection`'s types. Both are tested, so their type imports keep a relative `.ts` path: `./imageDetection.ts` becomes `../../detection/imageDetection.ts` in each.

`biome.json`: today's exception turns `noRestrictedImports` off for the two files, so they could import any screen. Replace it with an override for `src/screens/editor/detection/**` that repeats the editor-wide patterns without `image-analysis`: it allows the bridge and keeps the ban on routes and other screens. It goes after the editor-wide override, which matches the same files, so it's the one that applies. The tool overrides keep banning `image-analysis` with no exception inside them. The messages that name `find/imageDetection.ts` and `cutout/subjectDetection.ts` name `detection/` instead. `AGENTS.md`: the line that names the two files.

## Stage 5: Layer views

- [x] Landed: `refactor: move the layer views into render/layers/`

Create `src/render/layers/`, then move the layer views into it and keep their names:

* `ImageLayerView.tsx`
* `TextLayerView.tsx`
* `DrawingLayerView.tsx`
* `RedactionLayerView.tsx`
* `ShapeLayerView.tsx`

`LayerContent.tsx`, `DocumentRenderScene.tsx`, `renderDocument.tsx`, `decodedImages.ts`, `fonts.ts`, `textLayerLayout.ts`, and the other render modules stay at `render/`. Callers: `LayerContent`, `DocumentRenderScene`, `renderDocument`, and in the editor `EditedTextView`, `LiveStrokeOverlay`, and `cutMask`. The views import mostly through `@/`; the one relative import that changes is `./textLayerLayout`, which becomes `../textLayerLayout` (`./DrawingLayerView` moves along with the view that imports it). The `render/` Biome override covers subfolders, but its `../**` ban caught `TextLayerView`'s `../textLayerLayout`, so `src/render/layers/**` got an override of its own after it, counted a level deeper (`!../*` for the render modules, `!../../model/**` and `!../../lib/**`). The lessons quote `ImageLayerView`, `TextLayerView`, and `RedactionLayerView` (the `file` strings and `sources.ts`), and `docs/interactive/src/lessons/render/LayersLesson.tsx` imports all five views as components it renders, through `@src/render/…`. Update all three places, then build the lessons, which run `render/` on CanvasKit. Drawing code doesn't change.

## Stage 6: The platform ports

- [x] Landed: `refactor: move the OS ports from lib/ into platform/`

Create `src/platform/`, then move both files of a pair in the same commit, and keep the names.

| From | To |
| --- | --- |
| `lib/haptics.ts` | `platform/haptics.ts` |
| `lib/preferenceStore.ts`, `.web.ts` | `platform/preferenceStore.ts`, `.web.ts` |
| `lib/usePreference.ts` | `platform/usePreference.ts` (no web sibling; it calls the store, and `lib/` stays self-contained) |
| `lib/temporaryFile.ts`, `.web.ts` | `platform/temporaryFile.ts`, `.web.ts` |
| `lib/serviceWorker.ts`, `.web.ts` | `platform/serviceWorker.ts`, `.web.ts` |

None of these imports app code, and callers across the app use them: the editor's canvas, shell, and tools, Create, Settings, Home, `ui/theme.ts`, and `index.web.ts`. After the move `lib/` holds only `assertNever.ts`, `color.ts`, `errorMessage.ts`, and `site.ts`.

Left in place, because only one feature uses each, and someone looking for paste, drop, or copy looks in that feature's folder:

* `photos/clipboardImage.ts` and `.web.ts`: Home's paste, which hands the importer a file to re-encode.
* `photos/usePhotoDrop.ts` and `.web.ts`: dropping a photo on the page, for Home and the editor's add-image. The native file is a stub, since only the web has a page to drop onto.
* `screens/export/copyImage.ts` and `.web.ts`: the export sheet's Copy.

Left in place, because each imports its feature's modules and would make `platform/` import a feature:

* `projects/projectStorage.ts` and `.web.ts` import `projectLifecycle` and `projectFile`.
* `screens/export/saveImage.ts` and `.web.ts` import `exportFormat`.
* `screens/editor/tools/stickers/stickerFile.ts` and `stickerStorage.ts`, with their `.web` siblings, import `bundledStickers` and `savedStickers`.
* `photos/sharedPhoto.ts` and `.web.ts` import `photoImport`.
* `ui/showAlert.tsx`, `ui/Tooltip.tsx`, and `ui/CheckerFill.tsx`, with their `.web` siblings, are `ui/` primitives. `showAlert.web.tsx` draws with `Button` and `theme`, so in `platform/` it would make `platform/` and `ui/` import each other.

`biome.json`: a new `src/platform/**` override that allows only `platform/` itself, and the `ui/` override allows `@/platform/preferenceStore`. `index.web.ts` imports `@/platform/serviceWorker`. `AGENTS.md`: the Project Structure line on import direction gains `platform/`, and "`usePreference` from `lib/`" becomes `platform/`. `docs/architecture.md`: `src/lib/` no longer "holds platform shims, preferences", and `src/platform/` gets its own line. Then `npm run build:web`.

## Later: edits out of `editorSlice`

Start this only after stages 1–6 are in. It changes the shape of functions rather than their paths, and the directory refactor is done without it.

Take one editor action at a time. Where `editorSlice.ts` (about 800 lines) works out the next document inline, move that work to `model/edits/<tool>.ts` as a function `(document) => document`. The slice keeps history, the session bounds, and the call. The existing `editorSlice` tests still pass, and the new function gets its own test in `model/edits/__tests__/`. Order, one tool per commit: redact, draw, text, crop (framing is already `model/framing.ts`), adjust, cutout, layers. The store lessons quote `editorSlice.ts` 21 times. Update each quote in the commit that moves the code it quotes.

Splitting `model/document.ts` into one file per layer type waits until those edits want a smaller module. `shapes.ts`, `cutout.ts`, and `framing.ts` import `document.ts`, so a split that leaves a cycle isn't done. Re-exporting everything from `document.ts` would be a barrel. Callers move to the new file instead, and the lessons update their declaration paths in that commit.

- [x] Landed: `refactor: split document.ts into a file per layer type`

`model/layers/` holds `base.ts` (`LayerBase`, `identityTransform`, `createLayerId`, `centeredTransform`, and the area helpers), `image.ts`, `text.ts`, `drawing.ts`, `redaction.ts`, `shape.ts`, and `layer.ts` (the `Layer` union, `layerFiles`, `resizeLayerBox`, `duplicateLayer`, `reorderLayer`). `document.ts` keeps `EditorDocument`, `LayerGroup`, the document factories, `withLayers`/`findLayer`/`addLayerOnTop`/`replaceLayer`, `hasEdits`, and `hasTransparency`. To leave no cycle, the image, sticker, and text factories (and `maxNewImageShortSide`) take the canvas as a `Size` instead of an `EditorDocument`, which callers pass unchanged, and `CutStroke` moved from `cutout.ts` into `layers/image.ts` beside `ImageLayer`, whose field it types. `model/drawing.ts` (stroke geometry for drawings, redactions, cuts, and shape outlines) became `model/strokes.ts`, so it isn't confused with `layers/drawing.ts`. `biome.json` has a `src/model/layers/**` override, and the other model overrides allow `layers/`. The tests stay in `model/__tests__/` (`drawing.test.ts` is now `strokes.test.ts`).

## Done

- [x] Landed, with `chore: enforce the editor's import rules for session/ and detection/`, which makes the "Inside the editor" table true for `session/` and `detection/` (and bans both from `canvas/`, and `session/` from the tools).
- [x] "Later: edits out of `editorSlice`" landed as seven `refactor: move the <tool> edits out of editorSlice into model/edits` commits (redact, draw, text, crop, adjust, cutout, layers). Each edit returns the document it was given when nothing changes; `setDocument` skips those and works out the selection (`selectionAfter`). `addLayerOnTop`, `replaceLayer`, `withLayers`, and `findLayer` joined `document.ts`, and `biome.json` has overrides for `model/edits/` and its tests. Splitting `document.ts` is still for later.

Stages 1–6 are in. The editor root holds only what spans the editor. Tools sit under `tools/`, the bridge to `image-analysis` is one folder, and a port any caller can use lives in `platform/`. `npm run check`, `npm run typecheck`, `npm test`, `npm run build:web`, and `npm run build --prefix docs/interactive` pass.

## Considered and left out

* **Lifting the screens to `src/`** (`src/home`, `src/editor`, and the rest). That would put fifteen folders at the top level, screens mixed in with capabilities, and drop the at-a-glance split `screens/` gives.
* **Moving the store into the editor.** Four other screens read it. Under `editor/`, they would import the editor, and the store would share a folder with `useProjectSession`, which imports `render/` and `projects/`. That would cost `store/`'s folder-level import rule.
* **Renaming `model/` to `document/`.** The folder holds geometry, caret math, and hit testing as well as the saved document. `@/document/document` stutters, and the lessons' `@model` alias would point at a folder with another name. Lots of churn for a name that isn't clearer.
* **"Same name at each runtime."** Layer types (image, text, drawing, redaction, shape) don't map to tools (text is the only one that matches). Redactions come from Redact, Find, and Cut out; images come from Stickers and adding a photo. The tree can't promise one tool folder per layer type.
* **Moving tests out of `__tests__/` to sit beside their modules.** It works, but it reverses a convention for little gain. If it's wanted, it's a change of its own.
* **Renaming `photos/` and `projects/`** (`intake/`, `persistence/`). The current names are clear.
* **Moving `BackgroundPicker` into the editor.** Create uses it.
* **A `web/` folder for the service worker.** It's a platform pair, so it goes in `platform/`.
* [x] Landed after the plan: `chore: ban the editor's relative imports of other screens`. **Closing the relative-import gap.** Because the tools override and the `canvas/`/`crop/` override replace the editor-wide one, those files can import another screen by relative path today (`../../home/HomeScreen` lints clean from `adjust/`, `canvas/`, and `crop/`; checked with Biome 2.5.14). Only the alias form, `@/screens/**`, is banned there. `controls/` and `stickers/` ban every `../**` and allow back `shortcuts.ts` and `!../../../**`, so `../../home/HomeScreen` is flagged there. But a negation allows a whole subtree: `!../../../**` is everything from `src/` down, so `../../../screens/home/HomeScreen` lints clean from both (also checked with 2.5.14). Stage 1's recount for stickers keeps that shape at its new depth. Adding the other screens' relative patterns to the tool overrides, to both halves of the split `canvas/`/`crop/` override, and to the `shell/` and `stickers/` overrides (in the climb-to-`src/` form) would close it. Count the levels for when the commit lands: before stage 1, `canvas/` and `crop/` sit at the same depth and take the same patterns; after it, `crop/` is under `tools/` and needs one more `../` than `canvas/`. That changes a rule rather than moving files, so it belongs in a commit of its own, before or after this plan.
* Changing the project file format, the document schema, undo behavior, the native modules, or the Expo entry files, and rewriting tools, gestures, or Skia drawing as part of a move.
