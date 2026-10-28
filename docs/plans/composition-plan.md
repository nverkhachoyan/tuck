# Folders with clear edges

A plan written October 27, 2026, the next step after the tool definition refactors. The repo is to be open-sourced soon, and this plan reshapes `src/` for the people who'll read it: each area is one folder with a narrow public surface and import rules that say what it may use, and the editor becomes a component the app composes rather than a screen tangled with it. It ends with a map of the tree for readers and contributors.

Packages wait. Nothing outside this repo uses any part of it yet, and in an Expo app a workspace costs every contributor setup (Metro's package resolution, hoisting, autolinking) for boundaries that `biome.json` already enforces. The folders come out shaped so that one can become a package later with a file move, if something outside the repo comes to need it; [Later, if packages are needed](#later-if-packages-are-needed) says how.

**Status, October 27, 2026:** settled, and revised four times: twice after reviews against the code (the second added the places the tool list missed, the session's key, the editor's entry file, and smoke runs), a third time to aim at open-sourcing rather than a workspace (packages deferred, step 10 added), and a fourth after another review against the code (a tool's hook reaches the editor only through `env`, the redaction look's own preference, what Node's tests read on the spec, the host's Back and save state, the checkerboard in the editor, and plain string ids inside the editor); in progress, see [Progress](#progress).

It changes structure, not behavior, with three exceptions on purpose: step 4a makes two callers of one preference share its value, step 4b moves the redaction look to a preference of its own (reading the old one when it's missing), and step 8c orders a photo's tool buttons as the dock does. Two earlier plans are in git history as of `737ebdb`: tools that stand alone (`608877c` to `ce20692`) and each tool's spec and definition (`ecb4fa8` to `28ae186`).

## What happens today

Read at `737ebdb`, counting imports between areas.

| Area | Today | What's in the way of a narrow edge |
| --- | --- | --- |
| model | `src/model/` | Nothing: it imports nothing outside itself. |
| render | `src/render/` | `Checkerboard` reads `colors` and `LayerContent`'s `CanvasBackground` reads `CHECKER_CELL` from `ui/theme`, though only the editor's canvas and Crop's draw them; `LayerContent` and `DocumentRenderScene` import `lib/assertNever`, and `renderDocument` and `DrawingLayerView` import `lib/color`. |
| ui | `src/ui/` | `PageHead` imports `expo-router/head` and `lib/site`; `theme.ts` reads `platform/preferenceStore`. |
| platform | `src/platform/`, `src/lib/` | `lib/` mixes app facts (`site.ts`), projects' (`formatCreatedAt`), and plain helpers (`assertNever`, `color`, `errorMessage`). `platform/` itself brings `expo-haptics` and `expo-file-system`. |
| editor | `src/screens/editor/`, `src/store/` | See below. |

The editor is tied to the app in three ways:

1. **The app-wide store is the editor's state.** `store/editorSlice.ts` holds the document, selection, undo, and tool sessions. Home and Settings read `document !== null`, Create calls `openDocument`, Export reads `document`, and Home calls `openDocument` and `closeDocument` and reads `document` and `projectId` outside React (`useStore.getState()`, comparing a document from before an `await` with the current one). The slice's `projectId` is the projects' concept: once the host adds images to the project, the editor uses it only as Cut out's cache key (`useCutOut`).
2. **Projects and photos.** `EditorHeader` (the project's title, from `projectLabel` and `openProjectName`; the editor can't rename a project), `EditorScreen` (`addImage`, `exportHref`, and `session/`'s `useAutosave` and `SaveErrorBanner`, which it calls and draws in the editor's stage, beside the header's "Saved on this device" or "Not saved"), `useCutOutTool` (`addImage`), `useAddImage` (`pickPhoto`, `importPhoto`, `usePhotoDrop`), the sticker save (`importPhoto`), `useStickerActions` (the `PickedPhoto` type), and all of `session/`. `usePhotoDrop` imports only React: it hands over a file pasted or dropped onto the page, which is a port of the page rather than a photo's import.
3. **expo-router.** `EditorScreen` (params, the router for Back and Export, focus), `useEditorShortcuts` (`useFocusEffect`), `useProjectSession` (`useIsFocused`).

`EditorScreen.tsx` holds both sides: its default export is the route (params, `useProjectSession`, the opening and failed states, `leaveEditor`), and `ScreenContent` is the editor.

Stickers keep their own files with `expo-file-system` and `expo-asset` (`stickerStorage.ts`, `stickerFile.ts`, `stickerFile.web.ts`). That's the editor's own feature, not a tie to the app, and it stays in the editor.

And the tools aren't yet one list: `toolSpecs.ts` and `toolDefinitions.ts` import the five mode tools, `useEditorTools` calls each tool's hook by name (`EditorTools`), and `EditorMode` names Text and Crop (`type: "text" | "crop"`) and the sheets (`"layers" | "stickers"`) outside `defineTool`. The editor names a list tool in more places:

* `EditorCanvas` (`useFindTap`, `useDialDragGesture`), `EditorScene` (`DetectionOutline`, `LiveAdjustment`), and `canvasInputFor.ts` (`DetectionOverlayRegion`) import from Find and Adjust.
* `EditorScreen` zooms to Find's review (`useReviewZoom`), gives the header's Reset Adjust's neutral adjustments or else Cut out's `reset` (`resetEdit`), and announces Cut out's `news`.
* `useEditorTools`' `closeTool` calls `find.reset()` whenever any tool closes.
* `shell/layerActions.ts` (`layerActionsFor`) lists which tools act on which kind of layer: Redact, Adjust, Find, and Cut out on a photo (Redact and Adjust on a hidden one), Draw on a drawing or shape, and Redact on a redaction.
* `ToolKey` (`shortcuts.ts`) and `MarkedTool` (`shell/toolList.ts`) are unions of the tool names, and `TOOLS`' `needsImage` repeats what each spec's `target` says: it's set exactly for the tools whose target isn't `"none"`.
* `SHORTCUT_GROUPS` (`shortcuts.ts`) gives each tool its line in the shortcuts list ("Find faces or text to redact").
* `useEditNotice` words Find's notice (`redacted(count, feature)` and `regionsName`, with Find's `DetectionFeature`).
* The redaction look is the editor's, but it's kept in Redact's preference (`redactSettings`), parsed by Redact's `parseRedactSettings`, and `useEditorTools` reads it there.
* `ToolSpec`'s `id` repeats each spec's key in `TOOL_SPECS`, and only a test reads it.
* `editorMode.ts` derives each tool's mode in types (`ImageTool`, `ImageOf`, `Flat`, `TrayTool`), which `useEditorTools` meets with a cast (`as ToolStart`).

Each tool's hook runs in `useEditorTools`, which `EditorScreen` calls in its body, above the `EditorContext.Provider` it renders: a hook can't read the context, and today only the tools' views do.

## Decisions

* **Folders, not packages.** No `packages/` and no `workspaces`: the folders and `biome.json`'s import rules are the boundaries, and docs/architecture.md and the README make them visible.
* **The editor owns its store.** The store moves into the editor, which exports a narrow session surface that Home, Create, Export, Settings, and the route (its `session/` and its autosave) use: whether a session is open, the current document, and the session's key, each as a hook and as a read outside React, plus opening and closing a document. Nothing outside the editor reads its slice.
* **The session carries the app's key, not a project id.** `openDocument(document, key)` takes a key the app chooses (the project's id, or null when it couldn't be saved), and the editor uses it only as Cut out's cache key. It stays in the editor's store beside the document rather than in a store of the app's: Export selects both in one read, and Home compares the document from before an `await` with the current one, while two stores could each be seen halfway through a change.
* **One store per app.** Create opens a document before the editor mounts, so the store lives outside `<Editor>` as one module-level instance, as it does today. An app has one editor session at a time; `<Editor>` reads that store rather than making its own.
* **The editor leaves `screens/`.** It becomes `src/editor/`, the piece most worth embedding elsewhere one day; `src/screens/editor/` keeps only the route: its params, `session/` (opening and autosaving the project), and the export link. Screens may import `src/editor/` as they import `render/`, so "screens don't import each other" still holds.
* **The editor has one entry file.** `src/editor/index.ts` exports what the app uses: `Editor`, the `EditorHost` type, the session surface, and the built-in tools. Outside `src/editor/`, the app imports only `@/editor`, and `biome.json` bans deeper paths; inside it, nothing imports `@/editor`, which would make a cycle. The interactive docs are the exception: their lessons quote the editor's internals by path (`editorSlice.ts`, Crop's `cropGeometry.ts`, `canvas/hitTest.ts`, `canvas/layerBounds.ts`), so they keep reaching them through their `@src` alias, outside the app's rules.
* **The app hands the editor what it needs through an `EditorHost`**, a prop of `<Editor>` that the editor provides to its own parts as a context: picking and importing photos; adding an image to the project; the project's title, and whether it's saved (a save problem to show, and a retry); whether the editor is focused; and leaving and opening export, which the editor calls once it has finished any text being typed. The host carries only the app's own concepts (projects, photos, navigation). The editor declares the host's types (the picked image, and the photo options `maxShortSide` and `maxLongSide`), which `photos/` and `projects/` meet, and imports nothing from either, types included.
* **The route saves the project.** It runs `useAutosave` itself, with the document from the session surface, and hands the editor the save problem, which the editor draws in its header and its banner (`SaveErrorBanner`, which moves into the editor, since it imports only `ui/`).
* **A dropped file is the page's, not the host's.** `usePhotoDrop` moves to `platform/`, and the editor keeps calling it, since the editor decides when a drop is welcome (not while typing or cropping) and draws the drop overlay. Only the import of what's dropped goes through the host.
* **Sticker storage stays in the editor**, which may depend on `expo-file-system` and `expo-asset` itself.
* **Plain helpers go to the bottom of the graph.** `assertNever` and the document's color helpers (`isHexColor`, `mixColors`, `averageColor`) are plain TypeScript that render and the settings parsers need, so they join `model/`, which render already depends on; render then needs nothing from `platform/` and its native dependencies. The color picker's helpers (`Hsv`, `hexToHsv`, `hsvToHex`, `parseTypedHex`) go beside `shell/ColorPicker`, their only caller, so `model/` stays the document's. `errorMessage` formats an error for display rather than reaching the OS, so it joins `ui/` beside `showAlert`, which 7 of its 11 callers also use. `formatCreatedAt` goes to `projects/`, and `lib/` goes.
* **The checkerboard is the editor's.** `render/` is how a document draws, and no render of the document has a checkerboard: only the editor's canvas and Crop's draw one (`CanvasBackground`), while Export and Create use `ui/CheckerFill`. `Checkerboard` and `CanvasBackground` move to the editor's `canvas/`, so render needs nothing from `ui/`.
* **The redaction look keeps its own preference.** The look is the editor's, read by Redact, Find, and Cut out, so it moves from Redact's `redactSettings` to a key of its own (`redactLook`), kept by `shell/useRedactLook.ts` and parsed by `redactLook.ts`'s `parseRedactLook`. When nothing is saved under the new key, it parses `redactSettings`, so a look saved before carries over. Redact's preference keeps its sub-tool and brush sizes, and nothing outside `tools/` reads Redact's settings.
* **A tool's hook reaches the editor through `env`.** Hooks run in the editor's body, above the `EditorContext` it provides, so a hook reads nothing from the context: what it needs comes through `env`, from the store, or from a shared preference. The context stays for tools' views.
* **The site gets a folder of its own.** `site.ts` and `PageHead` move to `src/site/`, since the routes (`_layout.tsx`, `+html.tsx`), Home, and the info screens all use them, and `src/app/` may hold only routes.
* **No package names.** The app keeps its `@/` alias and tests keep relative `.ts` paths (Node's tests can't read `tsconfig` paths), so moves within `src/` are a mechanical rewrite of `@/` paths. `model/` keeps its name: in an app it's the name readers expect, and docs/architecture.md says what's in it.
* **Tools are an input.** `<Editor>` takes its list of tools and builds every controller the same way, and the built-in tools are only the default list. A tool carries everything the editor does for it by name today: its definition gives the header's Reset and what it announces, and its spec, plain TypeScript for the Node tests that read it, gives which layers it acts on, its button, its key, and its line in the shortcuts list. Text, Crop, Layers, and Stickers stay the editor's own modes and sheets, not definitions, and leave `tools/`.
* **A tool's id is a plain string inside the editor.** Once no code outside `tools/` names a built-in tool, literal ids would buy the mode, the chrome, and the shortcuts nothing but a type parameter to thread: they take `string` ids, and a tool's mode fields (`layerId`, `optionsOpen`) follow its spec at runtime, as the reducer's tests check. A tool's id is its key in the list (the spec loses `id`). One generic helper, where the app hands the editor its tools and toolbar, checks that the toolbar names only tools in the list.

## Steps

### Progress

- [x] 1. Give the site its own folder (October 27, 2026)
- [x] 2. Fold `lib/` into `model/`, `ui/`, and `projects/` (October 27, 2026)
- [x] 3. Give the checkerboard to the editor (October 27, 2026)
- [x] 4a. Share a preference between its callers (October 27, 2026)
- [x] 4b. Give the redaction look a preference of its own (October 27, 2026)
- [ ] 5. Move the editor out of `screens/`
- [ ] 6. Give the editor its store
- [ ] 7. Give the editor its host
- [ ] 8a. Build every tool's controller the same way
- [ ] 8b. Give the canvas's input kinds their own gestures and drawing
- [ ] 8c. Take the tool list as a prop
- [ ] 9. Docs
- [ ] 10. Give readers a map

Each step is its own commit and passes `npm run check`, `npm run typecheck`, `npm test`, and `npm run build --prefix docs/interactive`; steps that move `.web` files or entry imports also run `npm run build:web`. The interactive docs import much of what moves (`render/`, `store/`, `canvas/hitTest.ts`, `canvas/layerBounds.ts`, Crop's `cropGeometry.ts`), so each step updates the lessons' imports and `sources.ts` in the same commit.

Biome's relative bans need a pattern per depth, so a folder that moves can leave a ban that no longer matches anything, and it passes silently. After each step that changes `biome.json`'s rules, add an import that a changed rule bans, see `npm run check` fail, and take it out.

Those checks are all static, and steps 4a, 4b, 5, 6, 7, 8a, and 8b can change what the app does without meaning to: a shared preference, the look's new key, autosave in the route, the session surface, focus as a value, hook order, when Find resets. After each of them, a smoke run in the browser pane:

* Open a project, and open one from a reload.
* Open each tool, and leave it once with Done and once with Cancel.
* Change the redaction look in Redact, and see Find's and Cut out's redactions use it and a reload keep it.
* Reset an adjustment and a cut.
* Save a sticker, and drop a photo onto the canvas.
* Export. With the export sheet open, press a tool's key and drop a photo: the editor behind it ignores both.
* Go back home, and see the session saved.

After step 9, one pass in the iOS simulator, for expo-router's focus and the gestures. Step 10 changes only docs.

### 1. Give the site its own folder

* Move `lib/site.ts` and `ui/PageHead.tsx` to `src/site/`. The routes, Home, and the info screens import them from there.
* `ui/` then imports only `platform/` and its own files. `biome.json` gives `site/` its own rule: anything but `ui/`, `render/`, `model/`, and `platform/` may import it.

`refactor: give the site its own folder`

### 2. Fold `lib/` into `model/`, `ui/`, and `projects/`

* Move `assertNever` and the document's color helpers (`isHexColor`, `mixColors`, `averageColor`) into `model/` (`model/color.ts`), the color picker's (`Hsv`, `hexToHsv`, `hsvToHex`, `parseTypedHex`) into `shell/hsv.ts` beside `ColorPicker`, `errorMessage` into `ui/` beside `showAlert`, and `formatCreatedAt` into `projects/`, each with its tests (`color.test.ts` splits in two). Remove `lib/`.
* render now imports only `model/` and `ui/theme` (until step 3). Update `biome.json` and docs/architecture.md's boundaries (`lib/` beneath everything goes; `model/` stays plain TypeScript).

`refactor: fold lib into model, ui, and projects`

### 3. Give the checkerboard to the editor

* Move `Checkerboard.tsx` and `LayerContent.tsx`'s `CanvasBackground` to the editor's `canvas/` (`src/screens/editor/canvas/` until step 5), beside the two that draw them, `EditorScene` and Crop's `CropCanvas`. They keep reading `colors` and `CHECKER_CELL` from `ui/theme`, as `canvas/` may.
* `render/` stops importing `ui/` and imports only `model/`; tighten its `biome.json` rule.

`refactor: move the checkerboard into the editor's canvas`

### 4. Share preferences, and give the redaction look its own

Paths here are under `src/screens/editor/`, before step 5 moves them. It depends on nothing else here, and doing it first keeps step 8 smaller. Each part below is its own commit.

#### 4a. Share a preference between its callers

* `preferenceStore` tells subscribers when a key changes, and `usePreference` reads through `useSyncExternalStore`, so two callers of one key see one value.
* `useSyncExternalStore` compares snapshots by identity, and `parse` makes a new object on each call, so `usePreference` keeps each key's parsed value and parses again only when that key is written; otherwise every read is a new snapshot and React renders without end. A key therefore has one parser: a caller that wants part of a value reads all of it and picks its fields.
* It changes behavior on purpose: today two callers of a key each keep their own copy.
* docs/architecture.md's line that `usePreference` doesn't share a value between two callers goes.

`refactor: share a preference between its callers`

#### 4b. Give the redaction look a preference of its own

* `shell/useRedactLook.ts` (a file of its own, so `redactLook.ts` stays plain TypeScript for Node's tests) keeps the look under `redactLook`, parsed by `parseRedactLook`, falling back to `redactSettings` when nothing is saved under the new key, so a look saved by an earlier build carries over. It returns the look, a change to it, and its redaction effect for a document size.
* `redactSettings` keeps Redact's sub-tool and brush sizes: `RedactSettings` stops including `RedactLook`, and `parseRedactSettings` stops calling `parseRedactLook`.
* Redact's, Find's, and Cut out's hooks read the look through `useRedactLook`, and so do Find's views, which read it from the context today. `useEditorTools` stops owning Redact's settings and working out the effect, `useRedactTool` loses its `saved` and `setSaved` parameters, Find's and Cut out's hooks lose `redactionEffect`, and `editorContext.ts` loses `redactLook` and `changeRedactLook`.
* docs/architecture.md says where the look is kept, in place of its line that `useEditorTools` keeps it in Redact's saved settings.

`refactor: give the redaction look a preference of its own`

### 5. Move the editor out of `screens/`

* Move the editor to `src/editor/`, leaving `src/screens/editor/` with the route component, `session/`, and the export link. It still imports `projects/`, `photos/`, `expo-router`, and `store/` until steps 6 and 7.
* `EditorScreen.tsx` splits: its default export (params, `useProjectSession`, the opening and failed states, `leaveEditor`) stays as the route, and `ScreenContent` becomes `src/editor/Editor.tsx`.
* The route's open state, a component of its own as `ScreenContent` is today, calls `useAutosave` and works out the save problem, and hands `<Editor>` the problem and its retry as props until step 7 gathers them into the host. `SaveErrorBanner` moves into the editor's `shell/`. Otherwise the moved editor would import `session/` back from `screens/`.
* Text, Crop, Layers, and Stickers go straight to `text/`, `crop/`, `layers/`, and `stickers/` beside `shell/`, so each file moves once, and `tools/` holds only the list tools. They aren't list tools: Text's edit state lives in the mode and takes the keyboard, Crop replaces the canvas and takes keys, and Layers and Stickers are sheets over everything. Giving `ToolDefinition` a case for each would make it describe the editor rather than a tool, so they stay the editor's own.
* Add `src/editor/index.ts` with what the route uses, and have the route import only it.
* `biome.json` gives `src/editor/` the rules `screens/editor/` has today, each moved folder keeping its rule at its new path with its relative patterns rewritten for one folder less of depth; lets the rest of the app import `@/editor` and nothing deeper; bans `@/editor` inside `src/editor/`; and adds `src/editor/` to the folders that may not import `site/`.

`refactor: move the editor out of screens`

### 6. Give the editor its store

* Move `store/` (and its tests) into `src/editor/`; `useStore` becomes the editor's, still one module-level instance.
* The slice's `projectId` becomes `key`, which `openDocument(document, key)` sets and Cut out's cache (`useCutOut`) reads. Until step 7, the editor's own project calls read it as the project's id.
* Add the session surface to `src/editor/index.ts` (hooks and reads outside React for whether a session is open, the document, and its key; `openDocument` and `closeDocument`), and switch Home (`HomeScreen`, `useHomeProjects`), Create, Export, Settings, and the route (its `session/` and its autosave) to it. They turn the key into a project and back themselves (`projectRouteId`).
* Remove `src/store/`; update `biome.json` and the architecture doc. The interactive docs' store lessons (`lessonStore.ts`, the history and sessions lessons) follow the slice, its `key` included.

`refactor: let the editor own its store`

### 7. Give the editor its host

* Add `EditorHost`, a prop of `<Editor>` that the route passes and the editor provides to its parts as a context, and replace the editor's imports of `projects/`, `photos/`, and `expo-router`, and the save props step 5 gave `<Editor>`, with it. It carries `pickPhoto` and `importPhoto`; `addImage`; the project's `title`, its `saveProblem`, and `retrySave`; `focused`; and `leave` and `openExport`, which the editor calls once it has finished any text being typed. Its types come from today's call sites, declared by the editor: the picked image (today's `PickedPhoto`, which `useAddImage` and `useStickerActions` import) and the photo options. `photos/` and `projects/` meet them.
* `EditorHeader` takes the host's title and whether the project is saved; `projectTitle` moves to the route.
* Move `usePhotoDrop` (and its `.web.ts`) to `platform/`. Home and the editor import it from there.
* The route turns expo-router's focus into the host's `focused`, and `useEditorShortcuts`' `useFocusEffect` becomes an effect on it.
* Sticker storage stays in the editor's `stickers/` with its `expo-file-system` and `expo-asset` imports; only the sticker save's `importPhoto` goes through the host.
* `src/editor/index.ts` exports the `EditorHost` type. `src/editor/` then imports only `model/`, `render/`, `ui/`, `platform/`, `image-analysis`, and the packages it depends on itself (`expo-file-system`, `expo-asset`); `biome.json` enforces it.

`refactor: give the editor its host instead of the app`

### 8. Make the tools an input

Paths below are under `src/editor/`, after step 5. Today the editor root names its five list tools in `toolSpecs.ts`, `toolDefinitions.ts`, and `useEditorTools` (one hook call each, with arguments of their own), and in the places listed under [What happens today](#what-happens-today). Each part below is its own commit.

When the last part is done, no type outside `tools/` lists a built-in tool's name and no code there passes one as a tool id, except `builtInSpecs.ts`, `builtInTools.ts`, and the default toolbar. A search for each quoted id (`"draw"`, `"redact"`, `"find"`, `"cutOut"`, `"adjust"`) outside `tools/` checks it; at `737ebdb` it also finds `canvasTool.ts`'s `"draw"`, a stroke kind, and `LayerRow`'s `"draw"` icon, which aren't tool ids.

#### 8a. Build every tool's controller the same way

* A definition gives its hook as `useController(env)`, where `env` is what the editor gives the tool: `document`, `documentSize`, whether it's `open`, the `image` its spec's target gives (the target photo, or the image it started on), `close`, `notify(message)` (the edit notice, with Undo), and the canvas's `view` (`zoomToArea` and `fit`).
* A hook reads nothing from `editorContext.ts`: it runs in the editor's body, above the provider (see [Decisions](#decisions)).
* What only one or two tools were handed goes where it belongs: the redaction effect already comes from `useRedactLook` (step 4b); Find's notice goes through `env.notify`, its wording (`regionsName`) moving into Find, so `useEditNotice` loses `redacted` and its import of `DetectionFeature`; and Adjust's `setAdjustments` and Cut out's store actions are read from the store by the tools themselves.
* Find resets itself when `env.open` turns false, so `closeTool` stops calling `find.reset()`.
* A definition gives the header's Reset (`reset`: what Reset does, or nothing to hide it; Adjust's neutral adjustments, or Cut out taking back its cut) and what the editor announces for it (`announcement`: Cut out's `news`). `Editor` stops reading `tools.cutOut`, and `useEditorTools` stops returning `cutLayer`, which nothing reads.
* `useEditorTools` calls each definition's `useController` in the list's order, after `useToolSession` as now. The list must not change while the editor is mounted, so the hooks are always called in the same order; the editor reads its `tools` prop once (`useState`). Biome's `useHookAtTopLevel` flags a hook called in a loop, so that call carries a `biome-ignore` giving the reason: the list is fixed for the editor's life. `EditorTools` goes, and controllers meet their definitions only in `toolWithController`.
* Text's controller (`useTextEditing`) stays the editor's own (see step 5).

`refactor: build each tool's controller from its definition`

#### 8b. Give the canvas's input kinds their own gestures and drawing

* `regions` and `dial` are canvas behaviors named for what they do, so what they need moves into `canvas/`: `useFindTap` becomes `canvas/useRegionTap`, `useDialDragGesture` becomes `canvas/useDialDrag`, and `DetectionOverlayRegion` and `DetectionOutline` become the canvas's `CanvasRegion` and `RegionOutline`.
* Adjust's live preview (`LiveAdjustment`) reaches `EditorScene` from the `dial` input or from the definition (whichever needs less of the scene to change), not from an import of Adjust. `Editor`'s `adjusting` and `useEditorTools`' `adjustedLayer` go with it.
* `useReviewZoom` moves into Find's hook, which zooms through `env.view`. Not into one of Find's views: they mount and unmount with the tray and the layout, and a remount mid-review loses the ref that remembers it zoomed in, so leaving the review wouldn't fit the canvas again.
* `EditorCanvas`, `EditorScene`, `Editor`, and `canvasInputFor.ts` then import nothing from `tools/`.

`refactor: let the canvas own its region and dial input`

#### 8c. Take the tool list as a prop

* A spec also gives its button (`label`, `icon`, and its shortcut `key`), its line in the shortcuts list (`shortcut`), and which layers it acts on (`actsOn(layer)`). They go on the spec, not the definition, because the chrome, the shortcuts, and the layer actions are tested in Node, which can't load a definition's views; the icon's name is a type-only import, as in `toolList.ts`. `actsOn` replaces `layerActionsFor`'s lists: a selected layer's buttons are the tools that act on it, in the toolbar's order. That puts a photo's Find before Adjust, as the dock and the rail already do; a hidden photo still offers only Redact and Adjust, from their own `actsOn`.
* `ToolSpec` loses `id`, and so does `toolSpecs.test.ts`, which only checks it: a tool's id is its key in the list.
* `TOOLS`, `TOOL_KEYS`, and `SHORTCUT_GROUPS`' tool lines keep only the editor's own entries (Text, Sticker, Crop, Add photo); a tool's line comes from its spec, in the toolbar's order. `ToolKey` and `MarkedTool` become a `string` (a tool's id, or one of those entries), and whether a button waits for an image comes from its spec's `target` (`needsImage` goes).
* `toolSpecs.ts` and `toolDefinitions.ts` become `builtInSpecs.ts` (plain TypeScript, for Node's tests) and `builtInTools.ts`, the default list, which `src/editor/index.ts` exports.
* `<Editor>` takes `tools` and `toolbar` (the order of the dock's and rail's buttons, mixing tool ids and the editor's own entries), defaulting to the built-ins. The specs reach the mode reducer, the shortcuts, the chrome, and the rail from them, so `editorModeReducer`, `shortcutCommand`, `settle`, and `modeChrome` take the specs they work with.
* Inside the editor a tool's id is a plain `string` (`ToolId`), so none of the modules above is generic over the list. `ToolMode` becomes one shape, `{ type: "tool"; tool: ToolId; layerId: string | null; optionsOpen: boolean }`: the reducer sets `layerId` exactly when the spec's target is `"image"`, and opens the tray only for a spec with one, as its tests check. `ImageTool`, `ImageOf`, `Flat`, and `TrayTool` go, and so does `useEditorTools`' `as ToolStart` cast; `toolWithController`'s cast stays, since a list of tools can't carry each controller's type.
* One generic helper, where the app hands the editor its tools (`editorTools({ tools, toolbar })`), checks that `toolbar` names only tools in the list, so a misspelled id still fails to type-check. The tests run on the built-in specs and on a made-up tool.
* `biome.json`: nothing in the editor imports `tools/` except `builtInSpecs.ts` and `builtInTools.ts`, and tools still import only `defineTool.ts`, `toolSpec.ts`, `editorContext.ts`, `canvasInputFor.ts`'s types, `canvas/`, and `shell/`.

`refactor: take the editor's tools as a prop`

### 9. Docs

* docs/architecture.md, AGENTS.md's conventions and import flow, and `biome.json` match the new folders.
* docs/architecture.md says what reaches a tool from the editor: its hook gets `env` (and the store and shared preferences), and its views `editorContext.ts`; AGENTS.md gains that a tool's hook can't read the context, since it runs above the provider.

`docs: describe the editor's folder, its host, and its tools`

### 10. Give readers a map

* The README gains a short tree of `src/` and `modules/`, a line per area on what it is and what it may import, and points to docs/architecture.md for the rest and to the "Inside Tuck" lessons as an on-ramp.
* `CONTRIBUTING.md` says how to get running (a development build, not Expo Go), the four checks, the commit format, and the conventions a contributor meets first, taken from AGENTS.md rather than copied: AGENTS.md stays the full list and links to it.
* docs/architecture.md opens with what each area is for before its rules, so a reader new to the repo learns the shape before the bans.

`docs: map the codebase for contributors`

## Outside this plan

Open-sourcing needs more than structure, and these belong in docs/release-checklist.md rather than here: choosing a license, scanning git history for secrets and private names (machine names, device names, local paths), and checking that nothing in `docs/` or the memory of past work assumes a private repo.

## Later, if packages are needed

Make a package only once something outside this repo needs a part on its own: another app embedding the editor, or a tool reading the document format.

* **The editor first, as one package.** `packages/editor` with subpath exports: `@tuck/editor` (the `Editor`, `EditorHost`, the session surface, the built-in tools), `@tuck/editor/render`, and `@tuck/editor/document` (today's `model/`). Export and Home import `/render` without loading the editor; Biome keeps document from importing render and render from importing the editor, as it does now. One package means one set of `dependencies`, which costs nothing inside this repo.
* **A separate document package** only if something needs the format without Skia or Reanimated installed (a server, a CLI). It then needs a name of its own.
* **Start with a spike:** Metro resolving `.web.ts` inside a package through `exports`, tsc, Biome, Vite, and the Node tests. Already checked in a scratch workspace: Node's type stripping runs a workspace package's `.ts` through its `node_modules` symlink, so `npm test` keeps working.
* npm workspaces hoist dependencies to the root `node_modules`, so a package can import one it never declared, and `exports` doesn't stop that. Keep `biome.json`'s bans, or add a check that compares each package's imports with its `dependencies`.
* `modules/image-analysis` is autolinked from `modules/` today. With a `package.json` it's linked as a dependency the app names; the spike checks that Expo's autolinking still finds its native code on iOS and Android.
* The interactive docs read the editor's internals, which its `exports` won't offer, so they keep a path alias into `packages/editor/src`, as they reach into `src/` today.
