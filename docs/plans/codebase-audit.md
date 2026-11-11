# Codebase audit: structure, readability, and performance

Written November 10, 2026, at `95c1693`. It replaces the audit of November 9, most of which [#111](https://github.com/nverkhachoyan/tuck/pull/111) built. It covers `src/`, `packages/`, the TypeScript side of `modules/`, and their tests, and changes no code. Remove this file once its findings are built or filed, as with other plans.

This pass was asked to treat every structural decision as open, including the conventions in AGENTS.md, the module map in docs/architecture.md, and what #111 just landed. Measurements, platform quirks, and bugs in docs/GOTCHAS.md still bind. Where the current shape wins after a real attempt at something else, this says so.

**How the numbers were taken.** Headless Chrome 157 over CDP on the Apple M1 Mac, 1280×800, at 60 fps. The production export was built at this commit into a scratch directory (`expo export -p web`) and served by a small static server with Brotli and `vercel.json`'s cache headers. Input was synthetic mouse events. Costs come from CPU profiles (sampled every 0.1 ms, on a second export built with `--no-minify` so functions keep their names), `Performance.getMetrics`, and rAF frame times. "Fast 4G" is DevTools' preset (9 Mbit/s down, 60 ms latency). No timing code was added to the repository. Nothing was measured on a phone: native claims are marked `needs device`.

Two notes on reading the numbers:

- `Performance.getMetrics`' `ScriptDuration` runs 1.5 to 2.5 times a CPU profile's active time for the same work here, since it counts time the profiler books as "(program)". The tables say which they use. The previous audit's live-stroke table doesn't match either exactly (3.5 ms at 1 mark agrees with the profile, 9.3 ms at 200 marks is higher), though the slopes agree.
- The import fix in #111 holds on this export: a pasted 6000×4000 JPEG (5.9 MB) reached the editor's route in 1.08 s. The previous audit measured 3.1 s, with a larger file.

## 1. Summary

The changes that would most help a newcomer, none of which costs performance:

1. **One word for one thing, and one module for one job, around the project session** (finding 2). "Session" names three different things in three folders. `projectLifecycle.ts` is now a 51-line barrel, two modules each build "the app's instance" and re-export its functions, and the two largest test files are still named and shaped for files that were split.
2. **Sort the editor's root by what a file is for** (finding 4). Its 31 files are four kinds of thing. The canvas isn't in `canvas/`, the tool contract isn't in `tools/`, and the frame around the canvas is split between the root and `shell/`.
3. **Let the compiler list where a layer type is handled, and make the plain-TypeScript rule true** (finding 5). The checklist names three places; there are nine. The rule that keeps `layers/`'s lowercase files plain is broken by two files, and nothing noticed.
4. **Give a project's previews to the project** (finding 3). They live in `photos/` with their own storage, keyed by project. Deleting remembers them, duplicating doesn't, and nothing lets go of them when a project closes.

The single biggest performance opportunity is startup (finding 1). Every page, Privacy and Support included, waits for CanvasKit (2.8 MB of the 4.8 MB a first visit downloads) and then shows an empty page while the editor's five text fonts load. Warm, that blank lasts 0.3 s on every page load. On a first visit over Fast 4G, content appears at 4.5 s, 3 s after the page's own scripts have arrived.

Carried forward from the last audit: its finding 4 (every redraw replays every stroke) is now finding 6, with numbers that pass its own bar on web and evidence that the gain is web-only. Its finding 5 (stroke copies to the UI thread) is finding 7, unchanged, still waiting for a phone. Its finding 8 stays closed, and this pass's profiles agree with #111's.

## 2. The shape I'd build

### The sketch, before reading the module map

I listed what the app does (five screens; eleven tools; five layer types; three platforms; projects that autosave and reopen; offscreen export and thumbnails; on-device detection) and sketched this before reading docs/architecture.md's map:

```
src/
  app/                  routes only
  screens/              home/ create/ editor/ export/ info/
  projects/             the saved format, storage, the open project, the list, and the session
  photos/               pick, paste, share, re-encode
  editor/
    model/              plain TypeScript: document, layers/<type>.ts, edits, history
    render/             Skia, a pure function of a document: layers/<Type>View.tsx, image caches, offscreen
    state/              the store
    canvas/             the interactive surface, including the canvas component itself
    tools/              the tool contract, the registry, and <tool>/
    chrome/             everything around the canvas
    Editor.tsx index.ts
  detection/ platform/ ui/
```

### Today, and what reading changed

```
Today                                   Proposed (changes only)
src/
  app/ screens/ ui/ platform/ site/     as today
  session/                              as today, holding the only "session" (finding 2)
    projectSession.ts
    useProjectSession.ts                hooks only; the instance moves to appSession.ts
    useAutosave.ts
  projects/
    projectFile.ts
    openProjects.ts projectLibrary.ts
    projectLifecycle.ts                 removed: projectService.ts builds both halves
    projectService.ts
    projectStorage(.web).ts             also keeps each image's preview (finding 3)
  photos/
    photoImport(.web).ts                also makes a preview for an image that lacks one
    previewCache.ts                     removed
    previewStorage(.web).ts             removed
  editor/
    index.ts core.ts                    plus a Skia-free entry for the open document (finding 1)
    session.ts                          renamed openDocument.ts
    Editor.tsx editorHost.ts            as today
    editorMode.ts useEditorMode.ts      as today
    shortcuts.ts useEditorShortcuts.ts  as today
    useAddImage.ts useEditNotice.ts     as today
    EditorCanvas.tsx EditorScene.tsx    -> canvas/
    canvasInputFor.ts useCanvasInput.ts -> canvas/ (canvasInput.ts)
    toolSpec.ts defineTool.ts           -> tools/
    builtInSpecs.ts builtInTools.ts     -> tools/
    useEditorTools.ts editorContext.ts  -> tools/
    EditorHeader EditorRail             -> chrome/
    EditorInspector PanelViews          -> chrome/
    LayerSelectionBar ShortcutsOverlay  -> chrome/
    editorChrome.ts useEditorChrome.ts  -> chrome/
    useEditorLayout.ts editorFrame.ts   -> chrome/
    canvas/ tools/ store/ render/       as today, plus the files above
    document/ layers/<type>/            as today, with layers/panel/ -> chrome/layersPanel/
    shell/                              the kit tools build panels from; its six frame-only files -> chrome/
    detection/ savedStickers/           as today
```

Differences that matter, each argued in its finding:

- **The editor's root** (finding 4). Every tool reaches up two levels for its own contract, and the 694-line canvas component sits beside the folder named for it.
- **Previews** (finding 3). A project-scoped cache with its own storage sits in the folder for importing photos.
- **The names** (finding 2). One word, three meanings.
- **A third entry to the editor** (finding 1). `@/editor` is one barrel, so the root layout importing a font loader pulls in Skia.

Where reading changed the sketch, and the current shape wins:

- **`model/` and `render/layers/` against a folder per layer type.** My sketch split each layer type across a pure folder and a Skia folder. The tree was exactly that until October 29 (`7ca6d08`, "move render and model into the editor"), which moved to `layers/<type>/` with the type, its edits, and its view together. Having traced "add a layer type" and "change how a drawing draws" both ways, the folder per type wins: `drawing.ts` and `DrawingLayerView.tsx` change together (`needsOwnLayer`, `inkRect`, `layerBlend` exist for the view), and one folder answers "what is a redaction". What the split bought, purity you can see from the path, is better had from a check (finding 5). The interactive lessons still teach it as model, render, and store (`docs/interactive/src/lessons/`), which is the right way to explain it and not a reason to file it that way.
- **`session/` inside `projects/`.** My sketch folded them. But `projects/` importing only `@/editor/core` is what lets Node test all of it with fake storage, and `session/` is the one place that knows both the editor's store and projects. Keep it separate.
- **`document/` and `layers/` import each other** (6 imports one way, 31 the other). A document is a list of layers, and every layer edit takes and returns a document, so the cycle is the design. Moving `geometry.ts` out of `document/` would tidy the picture and change nothing a newcomer does.

Differences that are taste, which I'd leave:

- Renaming `shell/` to `controls/`. It would say what the folder is, but 44 imports from tools change for a name.
- Calling `editorSlice.ts` a slice when the store has one. `store/index.ts` is written to take more.
- One registry file in place of `builtInSpecs.ts` and `builtInTools.ts` (section 6 says why two).

## 3. Newcomer walkthroughs

Files a newcomer opens to do each task, and the ideas they must hold. "Proposed" assumes findings 2 to 5.

| Task | Today | Proposed |
| :--- | :--- | :--- |
| **Add a tool** | 5 new files in `tools/<name>/` (spec, definition, hook, panel, settings) and 2 to 4 edits: `builtInSpecs.ts` (twice: the map and the toolbar), `builtInTools.ts`, and for a new edit, `store/editorSlice.ts` and a `layers/…Edits.ts`. Its imports reach `../../defineTool`, `../../toolSpec`, `../../canvasInputFor`, `../../editorContext`. Ideas: spec, definition, a hook that gets `ToolEnv` and can't read the context, view slots, `CanvasInput`, and the tool's "session", which shares its name with two other things. | The same files and edits, all inside `tools/` except the edit itself. One idea fewer: "tool session" is the only session in the editor. |
| **Add a layer type** | 3 new files in `layers/<type>/` and about 9 edits: `layers/layer.ts`, `layers/LayerContent.tsx`, `render/DocumentRenderScene.tsx`, `canvas/layerBounds.ts`, `canvas/layerTargets.ts`, `layers/panel/LayerRow.tsx` (two switches), `canvas/SceneLayer.tsx` if it resizes live, `store/editorSlice.ts`, `core.ts`. The checklist names three; `assertNever` flags five; `layerTargets.ts` is flagged by nothing. | 3 new files and about 7 edits, every one a compile error until it's done. One render switch, not two. |
| **Fix undo across a crop** | 7 files: `tools/crop/useCropTool.ts` (the draft, and `reframe` on Done), `tools/crop/cropSpec.ts` (`takesKeys`, `cancels`), `document/documentEdits.ts`, `document/framing.ts`, `useEditorTools.ts` (`useToolSession`, `finishTool`), `store/editorSlice.ts`, `store/history.ts`. Then the tests: 43 on history and sessions, inside the 1,934-line `editorSlice.test.ts` from line 1108. Ideas: draft against document, the tool session and its undo stops, snapshots carrying the selection, the framing anchor. | The same 7 files. The tests are `store/__tests__/history.test.ts`. |
| **Change what's saved in a project** | `projects/projectFile.ts` (format and version), `openProjects.ts` (`savedDocument`, `serializeOpenProject`), `projectLibrary.ts` (`writeCopy`, and the rewrites for rename and thumbnails), both `projectStorage` files for a new kind of file, the layer's own saved-file check in `layers/<type>/<type>.ts`, and for anything about images, `photos/previewCache.ts` and both `previewStorage` files, a second store. Reached through `projectService.ts` then `projectLifecycle.ts`. Tests in `projectLifecycle.test.ts`, 1,146 lines for both halves. | The same without the second store and without the barrel: 5 or 6 files. Tests named for the half they test. |
| **Change export** | `screens/export/` (the sheet, `useRenderedDocument.tsx`, sizes, format, `saveImage`, `copyImage`) and `editor/render/` (`renderDocument.tsx`, `DocumentRenderScene.tsx`, `drawOffscreen`, `offscreenPhotos`). Easy to follow end to end. It needs AGENTS.md's Skia notes first (one shared surface on web, sRGB, who disposes the image). | No change. The flow is already in two folders with one seam. |
| **Add a `.web.ts` implementation** | 1 new file beside its native twin, with the same extension, importing only types from it, then `pnpm build:web`. For storage, copy one of three near-identical IndexedDB openers (`projectStorage.web.ts:71`, `previewStorage.web.ts:17`, `stickerStorage.web.ts:19`). | The same. Finding 3 removes one of the three openers; a shared helper isn't worth it for two. |

The counts barely move. What moves is where the files are and how many ideas share a name. That's the honest size of the structural findings: they make the first week easier, not the code smaller.

### The four flows, end to end

- **Pick a photo, create a project.** `HomeScreen` → `useHomeProjects.open` → `pickPhoto` (one decode, the photo and its preview in one pass) → `startFromPhoto` → `createProject` (stores both) → `openDocument` → `router.push`. Since #111 it does no work it doesn't need: 1.08 s for a 24 MP photo on the export. What's hard to follow is the chain of seven files between the tap and storage (finding 2).
- **Open the editor, draw, type, crop, undo.** `EditorScreen` → `Editor` → `useEditorTools` (which opens the tool's session) → the canvas's gesture → the tool's `finishStroke` → a store action → an edit in `layers/` → `setDocument`. Then everything that follows a document change runs: `Editor` renders again with all eleven tool hooks (3.9 ms, section 6), Skia records the scene again (finding 6), the hit targets are rebuilt and sent to the UI thread (finding 7), and an autosave is queued for 500 ms later, which stringifies the document once (about 0.2 ms a landing at 200 marks). Two things are hard to follow: which "session" is meant, and that a tool's session is ended in two places in `useEditorTools.ts`: `finishTool` and `cancelTool` end it at once, and `useToolSession`'s effect cleanup ends it again as the tool closes, which is what covers leaving the editor with a tool open.
- **Save, then reopen.** The editor's route never closes its project. Home regaining focus does (`useHomeProjects.ts:112-133`), whichever way the editor was left, and a link to another project closes the first from `projectSession.open`. That's the one thing here a newcomer won't guess, and the comment says it. Reopening waits for previews (finding 3).
- **Export.** `ExportScreen` → `useRenderedDocument` → `renderDocument` → `drawOffscreen`, then a second small draw and a PNG encode for the sheet's preview. One render at a time, the latest size winning. Nothing to remove.

What only makes sense after docs/GOTCHAS.md: `render/imageCache.ts` counting releases, `drawOffscreen.web.ts` freeing its WebGL context by hand, and the tool card's constant inset. No file in `src/` mentions GOTCHAS.md. A one-line pointer beside each would cost nothing.

## 4. Conventions on trial

AGENTS.md's conventions, then docs/architecture.md's rules.

| Convention | Verdict | Reason, and the wording if it changes |
| :--- | :--- | :--- |
| Imports flow one way, `app` → `screens` → `session` → `editor` and `projects` | **Keep** | The measured import graph matches it, with one drift: `HomeScreen.tsx:26` and `SettingsScreen.tsx:3` read the editor's session directly, past `session/`. |
| Keep `biome.json` small; no import-boundary overrides, no import-checking script | **Change** | Keep `biome.json` small: the evidence (a thousand lines of overrides) binds. But "nothing checks imports" has let two boundaries drift that fail silently (finding 5, and finding 1 once built). New wording: "Nothing in `biome.json` checks imports. One Node test (`src/__tests__/imports.test.ts`, under 50 lines) checks the two boundaries that break without an error: the plain-TypeScript files import no React, React Native, Skia, or Expo, and Home's route reaches Skia only through a dynamic `import()`." |
| Only routes in `src/app/`; screens don't import each other | **Keep** | Expo Router makes every file there a route. |
| `document/` and `layers/`'s lowercase `.ts` files stay plain TypeScript | **Change** | True of the idea, false of the files: `layers/text/fonts.ts:6-9` imports `expo-asset`, `expo-font`, `react`, and Skia, and `layers/text/textLayerLayout.ts:14` imports Skia. New wording: "In `document/` and `layers/`, a file is plain TypeScript unless it's a view (`.tsx`) or is listed in the import test's short list of exceptions," with `fonts.ts` moved to `render/` and `textLayerLayout.ts` listed. |
| `render/` and the layer views never read the store | **Keep** | It's why export and the lessons can draw any document. `layers/panel/` takes the store's action types (`LayersPanel.tsx:30`), which is another reason it belongs in `chrome/`. |
| Everything about one layer type lives in `editor/layers/<type>/` | **Keep** | Section 2. The Layers panel isn't about one type and moves out. |
| Colors from `colors`; sizes from `typography`, `radii`, `space` | **Keep** | Design, and out of this audit's scope. |
| PascalCase components, camelCase modules | **Keep** | |
| Prefer growing an existing file; split when it gains a second responsibility | **Change** | The second half never fires, because "responsibility" has no test. `ProjectList.tsx` holds a grid, a card with three interaction systems, a context menu, and an inline rename that commits on unmount. New wording: "Prefer growing an existing file over adding a single-use one. Split out a component once it keeps state or effects of its own that the rest of the file doesn't read, and a module once its tests would need a separate setup." Finding 8 applies it. |
| A long doc comment is a sentence, then a list | **Keep** | `defineTool.ts`'s contract reads well this way. |
| Name the editor document `document`, not `doc` | **Keep** | The reason is evidence: the DOM's global hides a missing parameter. |
| Tests in `__tests__/` beside the code, `.ts` imports, nothing React-based | **Keep, and add** | Node's type stripping is a platform fact. Add: "A test file is named for the source file it tests." Two aren't (finding 2). |
| A tool's hook runs above `EditorContext`, so it takes `ToolEnv` | **Keep, reworded** | The stated reason is where the provider sits, which is incidental (only `cancel` in the context comes from the tools, `Editor.tsx:487`). The real split is worth keeping: a hook gets what the tool works on, a view reads the frame around it. New wording: "A tool's hook takes what it works on through `ToolEnv`; its views read the frame around them (`wide`, the tray, the insets) from `editorContext.ts`." |
| Outside `src/editor/`, import only `@/editor` or `@/editor/core` | **Change** | Keep the boundary, add an entry. `@/editor` is one barrel, so `app/_layout.tsx:8` importing `LoadFonts` loads the whole editor. Three entries by weight: `core` (plain), `openDocument` (the store, no Skia), and `index` (Skia and React). |
| Nothing but `builtInSpecs.ts` and `builtInTools.ts` imports a tool; tools don't import each other | **Keep** | It held: #111 took the last tool ids out of `Editor.tsx`. |
| Update the lesson when renaming what it covers | **Keep** | The docs build is the check. |
| architecture.md: what a tool may import (a list of eleven files and folders) | **Change** | After finding 4 it's one line: "A tool imports from `tools/`'s own contract files, the store, and the folders beneath it (`document/`, `layers/`, `render/`, `canvas/`, `shell/`, `detection/`, `savedStickers/`), never another tool, `Editor.tsx`, or `chrome/`." |
| architecture.md: `shell/` imports nothing else from the editor | **Keep** | It's what makes `shell/` a kit, and it's why the frame pieces that need tools and the mode can't live there. |
| architecture.md: "Add a layer type" checklist | **Change** | It names 3 of 9 places (`docs/architecture.md:106`). New wording: "Create its folder, add it to the `Layer` union, and fix every compile error." Finding 5 makes that true. |
| architecture.md: "Add a tool" and "Add a canvas stroke kind" checklists | **Keep** | Both match the code as of this commit. |

## 5. Findings

### 1. Every page waits for the editor's text fonts, and for CanvasKit

**What costs time.** Measured on the export, loading Home (`/`):

| Load | First client commit | Content on screen |
| :--- | :--- | :--- |
| Warm cache | 113 ms | 430 ms |
| Warm cache, CPU throttled 4× | 284 ms | 616 ms |
| First visit, Fast 4G | 3.67 s | 4.52 s |
| First visit, Fast 4G, `/privacy` | 3.65 s | 4.47 s |
| First visit, Slow 4G | 19.1 s | not recorded |

A first visit downloads 4.81 MB: `canvaskit.wasm` 2.79 MB, scripts 0.79 MB (3.7 MB before compression, in two shared chunks every route loads), the five text fonts 0.82 MB, and the icon font 0.38 MB. On Fast 4G the scripts have arrived by 1.44 s and CanvasKit by 3.45 s. Two things stand between the scripts and the page:

- **CanvasKit gates the router.** `index.web.ts:50-53` imports `expo-router/entry` only once `LoadSkiaWeb` resolves, because Skia binds to CanvasKit when its module is first evaluated and Expo Router evaluates every route at startup. That quirk is real. But Home, Create, Settings, Privacy, Support, and Licenses draw nothing with Skia, and they wait for it because `@/editor` is one barrel and the routes are imported eagerly.
- **The fonts blank the page.** `app/_layout.tsx:22-23` puts `<LoadFonts />` inside the root `Suspense` with `fallback={null}`, and `LoadFonts` suspends until all five fonts are registered with both Skia and the page (`layers/text/fonts.ts:36-48`, `:94-99`). So React's first commit replaces the prerendered page with nothing. On a warm load in the day palette, the page's text was there at 32 ms, gone at 132 ms, and back at 431 ms. In the night palette the prerender is hidden anyway (`+html.tsx`), so the page is simply blank until then. `ui/theme.ts:186-189` already says the system font stands in for the wordmark until Anton loads, which this never lets happen.

Checked and not a problem: each font is requested twice (once by Skia, once by `expo-font`), but the second is served from the HTTP cache.

**The shape.** Two steps, the first small.

- **Step A: load fonts where text is laid out.** `LoadFonts` leaves the root layout. The editor's route suspends on it (`screens/editor/EditorScreen.tsx`, which already shows an "opening" state), and `renderDocument` and `renderThumbnail` await `loadFonts()` themselves, since both are already async. `fonts.ts` moves to `render/` (it's Skia and Expo, not a layer's plain file). The layout's error boundary keeps `resetFailedFonts`.
- **Step B: pages that draw nothing don't wait for CanvasKit.** This needs a plan of its own, because it changes how AGENTS.md's load-order rule is met, not the rule.
  - `index.web.ts` starts the router at once and loads CanvasKit beside it.
  - The editor and export routes load their screens with a dynamic `import()` that first awaits CanvasKit. Home's thumbnail refresh imports `renderThumbnail` the same way.
  - The editor gets a third entry, `@/editor/openDocument` (today's `session.ts`): the store and nothing that imports Skia. `session/` and the screens use it.
  - The import test from section 4 fails if Home's route can reach `react-native-skia` through static imports, since one stray import silently restores the wait.

**The case for the current shape.** One load order, one rule ("nothing imports Skia above this line"), and no page can ever see a dead Skia API. The service worker precaches CanvasKit, so only first visits pay for the download. That's all true, and it's why step B needs its own plan. It doesn't cover step A: the blank costs every load, cached or not, and the stores link straight to Privacy and Support.

**Performance.** Step A, better, by the measured gap: content at the first commit, 0.3 s sooner warm and 0.85 s sooner on a first visit over Fast 4G. Step B, better, by an estimate: Home's first commit when its scripts have run, about 1.5 s on Fast 4G in place of 3.67 s. How much smaller Home's own scripts become isn't measured (the export has no module names; `EXPO_ATLAS=1` would say). Native: fonts are local files there, so the gain is small (`needs device`).

**Risk and size.** Step A is S: three call sites, and text can't be laid out before fonts, which `getFontProvider` already throws on. Step B is M: any path from a route file to Skia breaks it, and Expo Router's static export must keep working (`pnpm build:web`, and the CSP check for any new inline script). The lessons load `fonts.ts` (`SkiaStage.tsx`, `sources.ts`, and their Expo shims), so update those paths.

**Verify.** The same CDP run: on a warm load the root's text never drops to zero, and the first commit and content coincide. For step B: Home's network log shows it interactive before `canvaskit.wasm` finishes, then open a project on Slow 4G and by a direct link to `/projects/:id`.

### 2. "Session" means three things, and the project code kept the scaffolding of the file it was split from

**What a newcomer trips on.**

- **Three sessions.** `src/session/` is the project session: the project open across screens. `src/editor/session.ts:10` exports `Session`, the document and key the app sees. `src/editor/store/history.ts:24` exports `EditorSession`, the span from a tool opening to its Done, with `beginSession`, `commitSession`, and `cancelSession` on the store and a `session` field in its state (`editorSlice.ts:93`). The word appears 61 times in `editorSlice.ts`, nearly always meaning the third, and 35 times in `projectSession.ts`, nearly always meaning the first; `editorSlice.ts:84` uses it for the second. To the question in the brief: `src/session/` and `editor/session.ts` are two halves of one idea (the second is the editor's side of the first), and the store's is unrelated to both.
- **`projectLifecycle.ts` is a barrel.** After #111 it's 51 lines: it re-exports ten names from the two halves and joins their factories. Only `projectService.ts` calls `createProjectLifecycle` outside tests. But the storage files import their own interface through it (`projectStorage.ts:2`), and "open a project" now reads through seven files: `useHomeProjects.ts` → `useProjectSession.ts` → `projectSession.ts` → `projectService.ts` → `projectLifecycle.ts` → `openProjects.ts` → `projectStorage`.
- **Two "the app's one instance" modules.** `projects/projectService.ts` builds the lifecycle and re-exports 13 of its functions. `session/useProjectSession.ts:20-39` builds the session and re-exports 10, renamed (`open` as `openProjectSession`, `end` as `endSession`). That file is named for a hook and is mostly not hooks: screens import `startFromPhoto` and `endSession` from a file called `useProjectSession`.
- **Tests shaped like the old files.** `projects/__tests__/projectLifecycle.test.ts` (1,146 lines) tests `openProjects.ts` and `projectLibrary.ts` through the barrel; neither has a test file under its own name. `store/__tests__/editorSlice.test.ts` (1,934 lines) holds the 43 tests of `history.ts` (from `:1108` and `:1284`), which has none.

**The shape.**

- **Names.** "Session" stays with `src/session/`. The store's becomes the tool session: `ToolSession`, a `toolSession` field, `beginToolSession`, `commitToolSession`, `cancelToolSession`. `editor/session.ts` becomes `editor/openDocument.ts`: `OpenDocument`, `useOpenDocument`, `getOpenDocument`, beside the `openDocument` and `closeDocument` it already exports.
- **`projectLifecycle.ts` goes.** `projectService.ts` calls `createOpenProjects` and `createProjectLibrary` and passes the coordination between them (ten more lines). Callers import a name from the file that declares it, as AGENTS.md already asks inside the editor.
- **`session/appSession.ts`** holds the instance and its ten functions under the names the factory gives them. `useProjectSession.ts` keeps the hooks. Home and Settings ask it whether a session is open.
- **Tests follow.** `store/__tests__/history.test.ts` takes the history and sessions blocks. `projects/__tests__/openProjects.test.ts` takes autosave, closing and reopening, added photos, and thumbnails; `projectLibrary.test.ts` takes listing, deleting, renaming, duplicating, and thumbnails after a session that ended without closing. The in-memory storage at the top of today's file becomes a helper beside them, which `session/__tests__` can use too.

**The case for the current shape.** `projectLifecycle.ts` gives the tests one factory and gives `projectSession.ts` one type to `Pick` from, and #111 kept it on purpose so the tests and `projectService.ts` kept their entry. Renaming the store's session touches the lessons. Both are costs of the change, not reasons the names are right: a newcomer debugging undo and a newcomer debugging autosave shouldn't both be reading about "the session".

**Performance.** Neutral.

**Risk and size.** M, all renames and moves. `SessionsLesson.tsx`, `HistoryLesson.tsx`, `HistoryTimeline.tsx`, `IdentityLesson.tsx`, `lessonStore.ts`, and `sources.ts` quote the store by declaration name: update them in the same change. Tests must move without changing an assertion, so the diff is reviewable as a move.

**Verify.** `pnpm test` with the same tests passing under new file names, `pnpm typecheck`, and `pnpm --dir docs/interactive build`.

### 3. A project's previews belong to no one

**What a newcomer trips on, and what costs time.** A preview is the smaller copy of a large photo that the canvas draws. It's scoped to a project and an image file, and it's spread like this:

- `photos/previewCache.ts` keeps a module-level map keyed by project id and image URL (`:7-9`), stores previews (`:31-41`), and rebuilds missing ones (`:47-84`).
- `photos/previewStorage.ts` keeps the files in `Paths.cache/previews/<projectId>/` on native; `previewStorage.web.ts:3` keeps them in a database of their own, `tuck-previews`, beside the projects' `tuck`.
- `projects/projectService.ts` hands three of those functions to the lifecycle, which calls them at create (`openProjects.ts:292-294`), add (`:472-474`), open (`:376-378`), and delete (`projectLibrary.ts:82-89`).
- `session/useProjectSession.ts:24` hands a fourth, the lookup, to the session for thumbnails, and `EditorScreen.tsx` hands the same lookup to the editor's host.

What falls between the owners:

- **Duplicate doesn't copy them.** `writeCopy` copies the image files (`projectLibrary.ts:143-145`) and nothing else, so a duplicate, or "Open a copy", opens without previews.
- **A missing preview blocks opening, on the slow path.** `openProject` awaits `prepareProjectPreviews`, which rebuilds each one in turn with `ImageManipulator.manipulate(uri).resize().renderAsync()` (`previewCache.ts:70-72`). On web that's the path whose hidden PNG encode the last audit measured, and which #111 replaced for import only. Measured on the export, opening a project with one 6000×4000 photo: **50 to 59 ms with its preview stored, 926 to 992 ms without.** Five such photos would take about five seconds (an estimate: the loop awaits each).
- **Nothing lets go on close.** On web `imageUrl` makes a new object URL each time a project opens (`projectStorage.web.ts:141-146`), so `memoryPreviews` gains an entry per image per open, and `previewStorage.web.ts:7`'s `activeUrls` keeps one URL per preview until the project is deleted or the page reloads. Small, but it's state with no owner.

**The shape.** This moves stored data, so it's a plan of its own. The saved project file (`projectFile.ts`, `PROJECT_VERSION`) doesn't change.

- `projectStorage` keeps an image's preview with the image: `storeImage` takes it, `copyImage` copies it, `imageUrl` gives both URLs, `releaseImage` frees both, and removing a project removes both. On web that's a second key beside the image's in the `photos` store, so the database needs no version change. On native, either the project's directory or the cache directory as today: the plan decides, since the cache can be purged and the project directory is backed up.
- `openProjects` keeps `previews` beside `images` in its `OpenProject` record, answers `previewUri(id, url)`, and drops both when the project closes.
- `photos/` only makes previews: one function that builds a preview for an image that lacks one, using the one-pass encoder `photoImport(.web).ts` already has. `previewCache.ts` and both `previewStorage` files go (272 lines).
- Migration: none is required for correctness, since a missing preview is rebuilt on open. The plan should delete the old `tuck-previews` database and the old cache directory, and say whether to rebuild eagerly or on first open.

Two parts can land alone before any of that, with no storage change: `writeCopy` copies the previews, and the rebuild uses the one-pass encoder on web.

**The case for the current shape.** Previews are derived, so keeping them out of project storage keeps that contract small, and a cache directory the system may purge is the honest place for a cache. #111 built exactly this, deliberately, a day ago. It still loses: the cache is keyed by project, deleted with the project, and needed before the project opens, so the project already owns it in every way but the code. And the purge that makes the cache "honest" is what sends a project down the one-second path.

**Performance.** Better for duplicates and for any project whose previews are gone: the measured 0.9 s per large photo becomes a file copy, or with only the encoder swapped, an estimated 0.3 to 0.4 s (the full import, with its second encode, takes 1.08 s). Blocking the open stays: letting CanvasKit decode a 24 MP photo while the preview is made would grow a heap that never shrinks. Neutral otherwise.

**Risk and size.** The two parts that land alone are S. The move is M: both storage implementations, their in-memory twin in the tests, and the migration. No lesson imports these files.

**Verify.** Node tests in `projects/__tests__`: a duplicate has its previews, a deleted project leaves none, a closed project holds no URLs. On web, the reopen timing above, before and after, with the preview store emptied.

### 4. The editor's root holds four kinds of file

**What a newcomer trips on.** `src/editor/` has 31 files at its root and nine folders. Read by what imports what, the files are four groups that the flat list hides:

- **The canvas.** `EditorCanvas.tsx` (694 lines) and `EditorScene.tsx` are imported only by `Editor.tsx`, and account for nearly all of the root's 33 imports from `canvas/`. They are the canvas, and they aren't in `canvas/`, because they need `canvasInputFor.ts`, which is at the root because tools import it. `canvasInputFor.ts` itself imports only `canvas/`, two types from `layers/`, and `shell/dialDrag.ts`.
- **The tool contract.** `toolSpec.ts`, `defineTool.ts`, `editorContext.ts`, `builtInSpecs.ts`, `builtInTools.ts`, and `useEditorTools.ts`. Tools import the root 51 times, nearly all of it these files, as `../../defineTool`.
- **The frame.** `EditorHeader`, `EditorRail`, `EditorInspector`, `PanelViews`, `LayerSelectionBar`, `ShortcutsOverlay`, `editorChrome.ts`, `useEditorChrome.ts`, `useEditorLayout.ts`, and `editorFrame.ts` at the root; `Dock`, `ToolsPanel`, `HeaderActions`, `SaveErrorBanner`, `DevHud`, and `SelectionBar` in `shell/`, used by nothing but the root; and the Layers panel in `layers/panel/`. "Where's the toolbar?" has five answers: `EditorRail.tsx`, `shell/ToolsPanel.tsx`, `shell/ToolButton.tsx`, `editorChrome.ts`, and `Editor.tsx:379-470`, which builds each button's variants, busy state, and starter after `editorChrome.ts` built the buttons.
- **What's the editor's own.** `Editor.tsx`, the entries, the host's types, the mode, the shortcuts, adding images, and the edit notice.

Two leftovers from #111 belong here too. The canvas still names one stroke kind: `EditorCanvas.tsx:478-516` and `:604-614` build the Eraser's ring, `:595` passes its scope, and `EditorScene.tsx:141-143` decides what its scope dims. The kinds have a module each now, and this one's overlay isn't in it.

**The shape.**

- `canvas/` gains `EditorCanvas.tsx`, `EditorScene.tsx`, `canvasInput.ts` (today's `canvasInputFor.ts`), and `useCanvasInput.ts`. A stroke kind may declare what it draws over the scene, and `strokes/erase.tsx` takes the ring.
- `tools/` gains the six contract files at its top, beside the tool folders. Adding a tool then happens inside `tools/`.
- `chrome/` (the name the code already uses: `editorChrome`, `modeChrome`) takes the ten root files, the six frame-only files from `shell/`, and `layers/panel/` as `chrome/layersPanel/`. `useEditorChrome` takes the toolbar's derivation from `Editor.tsx`, which drops to about 600 lines of wiring.
- `shell/` stays the kit that tool panels are built from, with its rule intact: it imports nothing else from the editor.
- The root keeps 11 files.

**The case for the current shape.** The last audit called this taste: the names group the files, every root file is something `Editor.tsx` composes, one flat level means no hunting, and the tree was reshaped four times in three weeks already. That's a real case, and "stop moving files" has value of its own. The change still wins on three specifics that aren't taste. The canvas component not being in `canvas/` contradicts the folder's name. A tool's contract living two levels above every tool means the folder you're told to work in isn't where its rules are. And the frame is split by an import rule a newcomer can't see (`shell/` may not import tools) rather than by what the files are. It should be the last move of the root for a while: the proposed groups are the import graph's own clusters, so there's no next arrangement waiting behind it.

**Performance.** Neutral: moves, and one derivation changing files. Keep `toolEntries` memoized on the same inputs when it moves.

**Risk and size.** M to L by line count, low by risk: about 30 files move and about 150 import paths change, with no behavior change. One commit, so a bisect never lands in the middle. docs/architecture.md's map, its boundary list, and the "add a tool" and "add a stroke kind" checklists change with it, and so do AGENTS.md's conventions that name `canvasInputFor.ts`, `defineTool.ts`, and `builtInSpecs.ts`. Lessons import `canvas/layerBounds.ts` and `canvas/hitTest.ts`, which don't move.

**Verify.** `pnpm typecheck`, `pnpm test`, `pnpm build:web`, and the docs build. Then follow-ups-plan.md §1's "every canvas tool kind" list on web at 390 and 1440 points, since the Eraser's ring changes hands.

### 5. A layer type is handled in nine places, and the rule that keeps its files plain is already broken

**What a newcomer trips on.**

- **The checklist is short by six.** docs/architecture.md:106 says to add a case in `LayerContent` and `DocumentRenderScene`, and that `assertNever` flags any you miss. `assertNever` guards five switches (`LayerContent.tsx:77`, `DocumentRenderScene.tsx:74`, `canvas/layerBounds.ts:35`, `LayerRow.tsx:231` and `:302`). It doesn't guard `canvas/layerTargets.ts:41-57`, where `resizeMode` and `layerStrokes` are chains of `if`s that fall through to "none" and `null`: a new type compiles, can't be resized, and is hit anywhere in its box. `SceneLayer.tsx` and `EditorScene.tsx:120` and `:143` branch on type the same way.
- **Two functions named `LayerContent`.** `layers/LayerContent.tsx:22` is the editor's, which decodes images with a hook. `render/DocumentRenderScene.tsx:44` is export's, which takes them decoded. They switch over the same five types to the same five views.
- **The plain-file rule isn't true.** AGENTS.md says the lowercase `.ts` files in `layers/` use no React, React Native, or Skia, and docs/architecture.md:57 says the views and `layerTransform.ts` are the only files there that use Skia. `layers/text/fonts.ts` imports `expo-asset`, `expo-font`, `react`, and Skia; `layers/text/textLayerLayout.ts` imports Skia; and `layerTransform.ts` imports only a type. Neither offender has a Node test, which is the only thing that would have noticed.
- **The Layers panel is in `layers/`.** `layers/panel/` is React Native chrome that takes the store's actions, in the folder whose files "never read the store".

**The shape.**

- Every site that branches on layer type becomes a `switch` ending in `assertNever`, `layerTargets.ts` first. The checklist becomes "add it to the union and fix every compile error", and stays true without anyone maintaining it.
- One switch draws a layer: `render/LayerView.tsx` takes the layer and its decoded image and mask. The editor's async wrapper (today's `AsyncImage` and `AsyncMaskedRedaction`) and export's scene each resolve the images their own way and call it.
- `fonts.ts` moves to `render/` (finding 1 moves it anyway). `textLayerLayout.ts` stays, named as the exception: text can't be measured without Skia.
- The import test from section 4 checks the rule: 40 lines that read each plain file's imports.
- `layers/panel/` moves to `chrome/` (finding 4).

**The case for the current shape.** Five layer types change rarely, the two `LayerContent`s differ in real ways (one suspends on images, one can't), and an `if` chain is shorter than a switch. A registry of per-type descriptors would be the heavier answer, and I'd reject it (section 6). But exhaustive switches cost a few lines each and turn a document that drifts into a check that can't.

**Performance.** Neutral. `LayerView` must stay a plain function of props, with no hook, so export's single offscreen frame still draws.

**Risk and size.** S. `LayersLesson.tsx` quotes `LayerContent` and, with `layerViews.tsx`, imports the layer views: update the lesson for the new name and run the docs build.

**Verify.** Add a throwaway sixth layer type to the union and count the compile errors against the list above. `pnpm test`, and an export of a project with every layer type compared with one from before.

### 6. Every redraw replays every stroke (carried forward, with new numbers)

**What costs time.** `DrawingLayerView.tsx:99-115` still draws one `<Path>` with its own paint per stroke. On web, Skia records the whole scene again in JavaScript each time a shared value it reads changes (`play`), then draws the recording. Measured from CPU profiles of a live pen stroke, 100 moves 20 ms apart, over a 1600×1200 photo:

| Document | CPU per redraw | Re-recording in JavaScript (`play`) | Inside CanvasKit |
| :--- | :--- | :--- | :--- |
| 1 mark | 3.5 ms | 0.3 ms | 78% |
| 200 marks, 1 stroke each | 5.9 ms | 2.2 ms | 58% |
| 200 marks, 3 strokes each | 9.8 ms | 4.7 ms | 51% |

Re-recording costs about 0.006 ms per stroke per redraw: for each one, `Player.ts:170` copies a paint, `:135` sets its properties and parses its color, and the path and paint cross embind. Landing a stroke shows the same cost from the other side. By `ScriptDuration`, a landing takes 27 ms at 1 mark, 38 ms at 200, and 47 ms at 600 strokes, where it first drops a frame (33 ms); with the CPU throttled 4× at 200 marks it takes 74 ms with a 50 ms frame. A profile of 20 landings at 200 marks puts 77% of it in Skia's recording and drawing and 8.6% (3.9 ms a landing) in React.

**What's new since the last audit.**

- **The estimate now passes the bar.** The last audit said to build this only if a prototype saved 2 ms per move. A picture per drawing leaves one command per mark, so at 600 strokes in 200 marks it removes about 400 strokes' recording: about 2.5 ms of the 9.8 ms, from the measured slope. A page of handwriting has more strokes per mark, and gains more. With one stroke per mark it gains almost nothing.
- **It's a web fix.** On native the recording is handed to the view and replayed in C++ off the JavaScript thread (`Container.native.ts:56-62`), so there's no per-stroke JavaScript to remove. [#95](https://github.com/nverkhachoyan/tuck/issues/95) is still the phone's question, and it's about rasterizing, which this doesn't change.

**The shape.** As before: record a drawing's settled strokes once into an `SkPicture` with explicit bounds from `inkRect`, and draw it with one `<Picture>` inside the same group, saved layer, and clip. Strokes record in index order inside the drawing's own layer, so an eraser still clears only what came before it, and the multiply stays on the group's paint. Keep per-stroke nodes where something wraps each stroke (the Stroke eraser's `wrapStroke`) and for the live stroke, which stays last.

Two things to decide while prototyping. Cache by layer id with the strokes array as the check, not in a `WeakMap` by array: undo history keeps up to 100 old arrays alive, and each would keep its picture. And every landed stroke makes a new strokes array, so the picture is recorded again on each landing; that's cheap while `pathFor` hits, and it's where [#109](https://github.com/nverkhachoyan/tuck/issues/109) (a recentering drawing rebuilds every path) would show.

**The case for the current shape.** One path per stroke is the simplest thing that draws, it's what the lessons show, and the M1 drops no frame until 600 strokes. That's a fair reason to prototype before building, which is what the last audit said. It isn't a reason to stop, with a mid-range phone's browser four times slower.

**Performance.** Better on web by the estimate above; neutral on native.

**Risk and size.** S to M, in one file. `LayersLesson.tsx` and `layerViews.tsx` import `DrawingLayerView`.

**Verify.** Prototype, then rerun the 200×3 profile: `play` should fall from 4.7 ms toward 2 ms. Then compare an export of a drawing with erasers, a highlight, and a dimmed scope against one from before, pixel for pixel.

One thing this pass found and didn't chase: at 1 mark, 2.3 ms of each redraw is inside CanvasKit's `drawPicture` for a scene of one photo and one stroke. `EditorScene.tsx:162-191` draws two blurred shadows the size of the canvas and a fill on every redraw, which is the obvious suspect and an unmeasured one. A prototype that draws them once would say.

### 7. On native, every document change copies every stroke to the UI thread (`needs device`, carried forward)

Nothing here changed in #111, and I read the same code again:

- `EditorCanvas.tsx:269-276` rebuilds `targets` on every document change and settled zoom and assigns it to a shared value.
- Each target for an unlocked drawing, brushed redaction, or shape carries its strokes, points and all (`layerTargets.ts:28`, `:50-57`).
- The JavaScript side caches each array's clone by identity, but the UI runtime's copy is built fresh on every assignment: `SerializableArray::toJSValue` makes a new array and converts each element (`SerializableArray.cpp:19-26`).

The estimate stands: a few milliseconds on the UI thread per landed stroke at 600 short strokes, several times that for a page of long ones. Web has one runtime and no copy.

The case for the current shape is that it's one assignment, the hit tests read plain arrays on both threads, and nobody has seen it drop a frame. That holds until a phone says otherwise, which is why this waits.

The shape also stands: a small record per layer on every change, and each layer's stroke geometry sent once per strokes array as a typed array, with the hit tests in `layers/strokes.ts` reading `ArrayLike<number>`. It still waits for [#105](https://github.com/nverkhachoyan/tuck/issues/105), which touches the same functions, and for a phone: time from assigning `sharedTargets` to a worklet scheduled right after it, in an iPhone Release build with 200 marks. Build only if it's over 4 ms. Add the number to #95.

Performance: better on native if the estimate holds, neutral on web. Size M: it changes the signatures of hit tests that the canvas and the edits share, which their tests pin.

### 8. The big files, one by one

The last audit called splitting these taste. Judged one at a time, by the wording proposed in section 4 (split out a component that keeps state the rest of the file doesn't read):

| File | Lines | Verdict |
| :--- | :--- | :--- |
| `screens/home/ProjectList.tsx` | 911 | **Split.** `ProjectCard` (275 lines: hover and keyboard reveal, the context menu's anchor, the name field's focus) and `NameField` (120 lines: a draft that commits on blur and on unmount, with a cancel flag in refs) each keep state the grid never reads. Two files, `ProjectCard.tsx` and `NameField.tsx`. |
| `tools/text/TextStylePanel.tsx` | 739 | **Split when [#107](https://github.com/nverkhachoyan/tuck/issues/107) is done.** `InlineTextColorPicker` (150 lines) repeats `ui/ColorPicker`'s HSV logic; fixing that removes most of it. |
| `editor/Editor.tsx` | 707 | **Shrinks in finding 4** (the toolbar's derivation moves). The rest is one component's wiring and reads top to bottom. |
| `editor/EditorCanvas.tsx` | 694 | **Moves in finding 4**, and loses the Eraser's ring. It's one component with twelve gesture hooks; splitting it further would hide how they compose. |
| `screens/home/HomeScreen.tsx` | 675 | **Leave.** Seven small views and one hook, little state. |
| `screens/create/CreateScreen.tsx` | 634 | **Leave.** `CustomSize` is the only part with state of its own, and it's 135 lines. |
| `tools/find/FindPanel.tsx` | 574 | **Leave.** follow-ups-plan.md already weighed splitting its views; six of its functions are the slots one tool fills. |
| `projects/openProjects.ts` | 556 | **Leave.** The autosave queue (`:192-277`) is the one separable part, and it shares `saveProject` and the open-project map with the rest. Split it if it grows a second policy. |
| `store/editorSlice.ts` | 556 | **Leave.** #111 did the work. |
| `screens/export/ExportScreen.tsx` | 546 | **Leave.** Its two hooks are already separate functions. |
| `layers/panel/LayersPanel.tsx` | 537 | **Leave**, apart from the move in finding 4 and [#106](https://github.com/nverkhachoyan/tuck/issues/106). |
| `tools/crop/CropPanel.tsx` | 532 | **Leave.** |
| `canvas/useLayerTransformGesture.ts` | 488 | **Leave.** One gesture, fifteen shared values, and worklet helpers that must sit above their callers. |

So one split now, one behind an open issue, and two that other findings handle. Performance: neutral. Size: S. Verify `ProjectList` by hand on web: hover, keyboard focus, right-click, rename with Enter, Escape, blur, and Home's Done while a name is being typed.

## 6. Considered and rejected

Each says whether the reason is evidence, which the next audit should overturn only with new evidence, or judgment, which it may reopen.

- **Moving the document subscription down so `Editor` doesn't re-render on every edit, or memoizing its children.** Evidence. `Editor` subscribes to the document (`Editor.tsx:107`), nothing in `src/` uses `React.memo`, and all eleven tool hooks run on every edit, so I expected this to be the largest cost of a landed stroke. It's 3.9 ms of React at 200 marks on the export (8.6% of the profile), 16 ms with the CPU throttled 4×. Skia's redraws are the cost. This agrees with both earlier audits, now with the profile to show it.
- **Splitting each layer type into `model/` and `render/layers/`.** Judgment, after tracing two tasks both ways, and with the history: the tree had this shape until October 29. See section 2.
- **A registry of layer-type descriptors** (bounds, resize mode, hit strokes, row, view per type, looked up by `layer.type`). Judgment. It would make "add a layer type" one folder and one line, for five types that rarely change, at the price of a level of indirection in the hot hit-testing path. Exhaustive switches get the same guarantee from the compiler.
- **One registry file for tools.** Evidence. `builtInSpecs.ts` exists apart from `builtInTools.ts` because three Node test files import `BUILT_IN_SPECS` (`editorMode.test.ts`, `editorChrome.test.ts`, `shortcuts.test.ts`), and Node's type stripping can't load a tool's `.tsx` views.
- **Folding `src/session/` into `projects/`.** Judgment. See section 2.
- **Import boundaries in `biome.json`.** Evidence: it took a thousand lines. The Node test proposed in section 4 is a different thing, two checks in under 50 lines.
- **Moving the context provider above the tool hooks, so hooks can read it.** Judgment, unchanged from the last audit: `ToolEnv` is easier to test than a context. Section 4 rewords the convention's reason.
- **Rebuilding a missing preview in the background and opening on the full photo meanwhile.** Evidence. On web CanvasKit would decode the full photo into a heap that grows and never shrinks (AGENTS.md, [#74](https://github.com/nverkhachoyan/tuck/issues/74)).
- **An incremental live path.** Evidence. #111 measured `strokePath` at 4.1% of a 1,400-point stroke. In this pass's profiles it's 2.2% of a live stroke at 1 mark.
- **Loading the text fonts once instead of twice.** Evidence: the second request is served from the cache.
- **A shared IndexedDB helper in `platform/`.** Judgment. Three openers of 30 lines each is real repetition, but finding 3 removes one, and two don't justify a module.
- **A summary index for Home's list; flattening the layers under a dragged one into a texture; letting only the selected layer follow the live transform.** Evidence, from the last audit, not measured again: 0.1 ms to read a typical project, backdrop filters reading the canvas they're drawn in, and 0.03 ms per move for the mappers.
- **From the editor audit, not reopened:** stroke IDs, `SkPath.offset`, the two-group dimming split, gating idle tool hooks, bounding live redaction by the document, and the `sameDocument` and `layers.find` changes. Each was rejected on evidence in docs/plans/editor-audit-plan.md, and I found none against it.

## 7. Suggested order

1. **Finding 1, step A** (fonts out of the root layout) first, alone: the largest measured gain for the smallest change.
2. **Finding 3's two small parts** (copy previews on duplicate; rebuild with the one-pass encoder), alone.
3. **Finding 5** (exhaustive switches, one `LayerView`, the import test) before the moves, so the test is there to hold the boundaries while files change folders. It moves `fonts.ts`, so it follows step 1.
4. **Finding 2** (names, the barrel, the tests) as one change for the renames and one for the test moves, so each diff reads as what it is.
5. **Finding 4** (the editor's root) as a single commit after finding 2, since both rewrite import paths across the editor and `layers/panel/` moves here. Update docs/architecture.md and AGENTS.md in the same commit.
6. **Finding 8's split of `ProjectList.tsx`** any time; it touches nothing else.
7. **Finding 6** (a picture per drawing) starts with a prototype and its profile, and may end there. It's independent of everything above.
8. **Finding 1, step B** and **finding 3's storage move** each need a plan of their own first. Step B should come after finding 2, which creates the `openDocument` entry it needs.
9. **Finding 7** waits for #105 and a phone, and shares that phone session with #95.
