# Codebase audit: readability and performance

Written November 9, 2026, at `0923463`. It covers `src/`, `packages/`, and the TypeScript side of `modules/`. It changes no code. Each finding says what a newcomer trips on or what costs time, the shape I'd build instead, and how to check it. Remove this file once its findings are built or filed, as with other plans.

How the numbers were taken: headless Chrome 157 over CDP on the Apple M1 Mac, a 1280×773 viewport at 60 fps, with synthetic mouse input, `Performance.getMetrics`, rAF frame times, and CPU profiles (docs/development.md). "Dev" is the Metro dev server at this commit. "Prod" is the `dist/` export built the same evening, three commits earlier; none of those commits touch the pen, drag, or import paths measured here. Parsing was timed in Node 24 with the app's own modules. Nothing was measured on a phone: every native claim is marked `needs device`, with its reasoning.

One lesson from measuring belongs up front. The dev build triples React's cost: a landed stroke at 200 marks costs 64 ms of script in dev and 20 ms in prod, because React's dev-mode element bookkeeping (`jsxDEV`, `createTask`, `logComponentRender`) is nearly a third of the profile. The editor audit's numbers were all from the dev server. Time anything React does against an export.

## 1. Summary

The changes that would most help a newcomer, none of which costs performance:

1. **Give the project session one owner** (finding 1). Opening, saving, and closing a project is spread over four screens and two registries that must agree. One `session/` module would hold it, and `projectLifecycle.ts` would split along the line it already has.
2. **Organize the canvas's stroke code by kind, not by mechanism** (finding 2). Adding a canvas tool kind touches about ten places today, and the Eraser fills most of two files named for something else.
3. **Make a photo and its preview one value, made in one pass** (finding 3). The preview is threaded four ways, one of them dead code, and this is also the largest measured performance win.
4. **One flyout mechanism, and no tool names in `Editor.tsx`** (finding 6). The editor hard-codes `"cut"`, `"removeBg"`, and `"adjust"` while architecture.md says adding a tool adds no case there.
5. **Take the history math out of the store's action table, and replace architecture.md's tool paragraphs with three checklists** (findings 7 and 9).

The single biggest performance opportunity is the photo import on web: a pasted 24 MP photo takes 3.1 s to reach the canvas, and 2.1 s of that is two PNG encodes nobody reads, a second full decode, and a CanvasKit decode to check for transparency (finding 3). The biggest per-frame cost is that every redraw replays every stroke in the document (finding 4), and the biggest unmeasured risk is that on native every document change copies every stroke to the UI thread (finding 5, `needs device`).

## 2. The shape I'd build

```
src/
  app/                     routes only                       (as today)
  screens/                 home/ create/ export/ info/ editor/ — status and navigation
  session/                 projectSession.ts: start, open, end a session   (new)
                           useProjectSession.ts, useAutosave.ts            (from screens/editor/session/)
  projects/
    projectFile.ts         the saved format                  (as today)
    openProjects.ts        open, save, autosave, add image, close
    projectLibrary.ts      list, rename, duplicate, delete, copy, closed thumbnails
    projectStorage(.web).ts
  photos/
    photoImport(.web).ts   one pass: the photo and its preview
    previewCache.ts        only for projects saved without a preview
  editor/
    Editor.tsx             composition only
    defineTool.ts, toolSpec.ts, builtIn*.ts, useEditorTools.ts   (as today)
    canvas/
      SceneLayer.tsx       one layer in the scene (today's StrokeTarget + LiveLayer)
      strokes/             draw, erase, redact, shape, cut: one file per kind
      useToolStroke.ts     the gesture, the landing, the intent
    store/
      editorSlice.ts       state and the action table
      history.ts           sessions, undo steps, stepsByMark
    document/ layers/ render/ shell/ tools/ detection/ savedStickers/   (as today)
```

Differences that matter:

- **`session/`.** Today four screens each import both `@/editor`'s session and `projects/` and keep them in step by hand. One module between them removes the checks each screen repeats.
- **`photos/` returns the preview with the photo.** Today `photos/` makes a photo, `projects/` asks `photos/` to decode it again for a preview, and the editor reaches the preview through a function passed down four levels.
- **`canvas/strokes/`.** The canvas owns each tool kind's live drawing, which is right, but spreads each kind over a union, a table, a hook, and a 574-line switch.
- **`store/history.ts`.** The part of the store worth reading sits under 320 lines of one-line wrappers.

Differences that are taste, and I'd leave:

- **The 31 files at the editor's root** could sit in `mode/` and `chrome/` folders. The directory refactor of October 23 settled this recently, and the names already group them.
- **The big screen files** (`ProjectList.tsx` 911 lines, `HomeScreen.tsx` 675, `CreateScreen.tsx` 645, `ExportScreen.tsx` 548). I read each expecting a tangle. They hold four to eight small components with little state each (`ProjectList.tsx` has hooks at four sites: lines 96–109, 283–287, 627–653, 741) and 140 lines of styles. They're long, not hard. "Prefer growing an existing file" works here.
- **Tool hooks running above the context.** Only `cancel` in `EditorContextValue` comes from the tools (`Editor.tsx:525`), so the provider could move above `useEditorTools` and the "hooks can't read the context" rule would go. But an explicit `ToolEnv` is easier to test and read than a context, so the rule is worth its cost.

## 3. Findings

### 1. The project session has four owners

**What a newcomer trips on.** "When is a project saved, and who closes it?" has no one answer in the code:

- Home opens a project and navigates (`useHomeProjects.ts:149-173`), and closes whatever session exists each time it regains focus (`:119-147`). The editor's route never closes its own project.
- Create opens one too, with its own copy of the fallback for a canvas that couldn't be saved (`CreateScreen.tsx:72-98`; Home's copy is `useHomeProjects.ts:176-184`).
- The editor's route opens a project on a link or reload, first closing any other session (`useProjectSession.ts:92-121`).
- Export redirects to the editor when nothing is open (`ExportScreen.tsx:62-76`).

Each site repeats what the others do. The thumbnail renderer `(doc) => renderThumbnail(doc, (uri) => getPreviewUri(projectId, uri))` is written three times (`useHomeProjects.ts:91-93`, `:124-126`, `useProjectSession.ts:100-102`). The check "someone else may have closed it meanwhile" is written twice (`useHomeProjects.ts:133-135`, `useProjectSession.ts:105-107`), and "an editor whose save failed is still open" twice (`CreateScreen.tsx:75`, `useHomeProjects.ts:154`). Two registries must agree throughout: `openProjects` in `projectLifecycle.ts:141` and the editor store's `document` and `key`, with `previewCache.ts`'s `memoryPreviews` as a third.

`projectLifecycle.ts` itself (792 lines, one closure, 19 functions returned) holds three things: the open project (open, save, autosave, add image, close: lines 141–523), the closed projects (delete, rename, duplicate, copy, list: 525–699), and thumbnails for both (403–433, 701–770). Someone fixing autosave reads past the library to find the rest of it.

**The shape.**

- `session/projectSession.ts`, plain TypeScript with storage and the editor's session passed in, as `createProjectLifecycle` takes storage: `startFromPhoto`, `startBlank`, `open(id)`, and `end()`. It owns the unsaved fallback, closing the session before, the thumbnail renderer, and the "still wanted" check.
- The screens call it and navigate. `useProjectSession` and `useAutosave` move beside it.
- `projects/openProjects.ts` and `projects/projectLibrary.ts`, with the `closing` queue shared between them. `createProjectLifecycle` stays as the function that builds both, so `projectService.ts` and the tests keep their entry.
- The import rule becomes: only `session/` imports both the editor's session and `projects/`.

**Performance.** Neutral: the same reads and writes in the same order. One small gain is available while there: `saveProject` stringifies the document twice per autosave (`projectLifecycle.ts:387`, `:397`), 7.2 ms each for a 1 MB document in V8 (measured in Node); the file's JSON could be built around `savedJson`.

**Risk and size.** L. It touches every way into and out of the editor. The races handled today by scattered checks must survive the move, so write them as tests first. No interactive lesson imports these files.

**Verify.** Node tests for the session with fake storage, as `projects/__tests__` does: close then reopen the same project; a link to another project while one is open; a failed save keeping the session open; leaving before an open finishes. Then on web: reload on `/projects/:id`, Back and Forward, a direct link to export, and the same project in two tabs.

### 2. The canvas's stroke code is organized by mechanism, and named for something else

**What a newcomer trips on.**

- `LiveStrokeOverlay.tsx` is not an overlay. Its main export, `StrokeTarget` (`:101-215`), is what `EditorScene` draws for every layer in every mode, stroke or not (`EditorScene.tsx:126-153`). It's a 115-line chain of `if`s over tool kind and layer type.
- "Live" names three different things in three files: a layer following a gesture (`LiveLayer`, `EditorScene.tsx:229`), a redaction or shape following a resize (`LiveLayerContent.tsx`), and a stroke being painted (`LiveStrokeOverlay.tsx`).
- `useToolStroke.ts` is 407 lines, of which the Eraser's hit tracking is about 250 (`:133-290`, `:305-363`): three memos, three shared values, `onSegment`, the hovered stroke, and the shared erase path. `EditorCanvas.tsx` carries the Eraser's ring as well (`:477-515`, `:603-613`).
- Adding a canvas tool kind means: the `CanvasTool` and `ToolStroke` unions, a `CANVAS_TOOLS` row, and `canAddTo` and `strokeReaches` (`canvasTool.ts`); `strokeIntent`; the `reaches` and `startsLayer` rules in `useToolStroke.ts:364-393`; branches in `StrokeTarget` and `NewLayerStroke`; and `outlinedLayerFor` and `inputRules` (`canvasInputFor.ts`). follow-ups-plan.md's list for "a drag for a box" (`:36`) names five of these, one of which no longer exists.

**The shape.**

- `canvas/SceneLayer.tsx`: one layer in the scene, placed by the live transform, with whatever joins it. It replaces `StrokeTarget` and `LiveLayer`.
- `canvas/strokes/<kind>.tsx`, one per kind (`draw`, `erase`, `redactBrush`, `redactBox`, `shape`, `cut`). Each exports the same few things: whether it reaches a layer, whether it starts one, its view inside a layer, and its view over the scene. `SceneLayer` and the scene look them up by `tool.type`.
- `canvas/strokes/useEraseTracking.ts`: the Eraser's memos, shared values, and `onSegment`, called unconditionally from `useToolStroke` and returning null when not erasing.
- `useToolStroke.ts` keeps the gesture, the landing id, and the intent: about 120 lines.

**Performance.** Neutral if three things are kept: the one `erasePath` derived value every drawing shares (`useToolStroke.ts:356-363`), the `key={stroke.landedId}` remounts that hand a landed stroke to the document in one update, and hooks called in the same order every render. The mappers and shared values stay the same in number.

**Risk and size.** M. Moves and renames, no behavior change. No interactive lesson imports `StrokeTarget`, `LiveStrokeOverlay`, `useToolStroke`, or `canvasTool`. Worklet helpers must stay declared above their callers after the split.

**Verify.** The "every canvas tool kind" list in follow-ups-plan.md §1, on web at 390 and 1440 points. Then the editor audit's eraser numbers on the dev server (8.6 ms per move hovering over ink at 200 strokes), which should not move.

### 3. A photo is decoded three times and encoded four on its way in, and its preview is threaded four ways

**What costs time.** Measured on the prod export: a 6000×4000 JPEG (9.5 MB, with sensor-like noise) pasted on Home reached the canvas in 3.1 s. The trace, from wrapping the browser's own calls:

| At | Step | Where |
| :--- | :--- | :--- |
| 0.01 s | CanvasKit decodes the photo to ask whether it's opaque (245 ms) | `photoImport.ts:107-132` |
| 0.25 s | The browser decodes it again for the re-encode (170 ms) | `photoImport.ts:71` |
| 0.37 s | 24 MP **PNG** encode, never read (860 ms) | expo-image-manipulator's `renderAsync`, `ImageManipulatorContext.web.ts:76-96` |
| 1.23 s | JPEG encode (230 ms), then stored | `photoImport.ts:82-90` |
| 1.47 s | The stored JPEG is decoded a third time for the preview (570 ms) | `previewCache.ts:85-87`, from `projectLifecycle.ts:266-270` |
| 2.01 s | 11 MP **PNG** encode, never read (410 ms) | `renderAsync` again |
| 2.42 s | Preview JPEG encode (100 ms), then stored | `previewCache.ts:90-95` |
| 3.02 s | CanvasKit decodes the preview for the canvas (104 ms) | |

On web, expo-image-manipulator 58's `renderAsync` copies the canvas and encodes it to a PNG blob so a later `saveAsync` can re-encode it; the app calls `renderAsync` once per image and reads only `saveAsync`'s result. On native the manipulator holds a bitmap, so there is no PNG, but `ensurePreview` still decodes the file `reencode` just wrote (estimate: one extra 24 MP decode per photo; `needs device`).

**What a newcomer trips on.** The preview reaches the canvas four ways:

- `EditorHost.previewUri` (`editorHost.ts:51`), which the type's own comment doesn't list (`:21-36`).
- Through `EditorContext` (`Editor.tsx:526`), which `EditorCanvas` reads (`EditorCanvas.tsx:250`) though architecture.md says only a tool's views read that context.
- A `resolvePreview` argument to `renderThumbnail`, built at three call sites (finding 1).
- `setPreviewResolver` and `globalPreviewResolver` (`renderDocument.tsx:117-124`, exported from `index.ts:11`), which nothing calls.

`previewCache.ts` also keys each preview twice, by file and by URL, in three places (`:72-73`, `:96-97`, `:142-143`).

**The shape.**

- `photoImport` returns the photo with its preview: `{ uri, width, height, opaque, preview? }`.
- `photos/photoImport.web.ts` (new) does it in one pass: `createImageBitmap` once, then an `OffscreenCanvas` and `convertToBlob` for the full JPEG or PNG and for the preview. A JPEG is opaque by format; anything else is scanned for alpha from the canvas in bands, as `isOpaque` does today.
- On native, `reencode` resizes the preview from the `ImageRef` it already holds, before releasing it.
- `projects/` stores both. `ensurePreview` stays for projects saved before this.
- The editor takes the resolver as one documented host function and passes it to `EditorCanvas` as a prop. `setPreviewResolver` is deleted.

**Performance.** Better. On web the two PNG encodes (1.27 s), the second decode (0.57 s), and the CanvasKit decode (0.25 s) go: an estimate of about 1 s in place of 3.1 s. The bitmap lives outside CanvasKit's heap, which never shrinks. Native: one fewer decode per photo (`needs device`).

**Risk and size.** M. It changes what `photos/` hands `projects/` and adds a `.web` file. To keep: EXIF orientation applied and no tag written (architecture.md), `MAX_PHOTO_PIXELS` and the size limits, exact transparency detection, and HEIC on Safari. No lesson imports `photoImport`.

**Verify.** The same trace should show one decode and two encodes. `photos/__tests__` for scale and limits; `pnpm build:web`; a rotated phone photo, a PNG screenshot with alpha, and a HEIC on Safari by hand. On a phone, time pick to canvas before and after.

### 4. Every redraw replays every stroke in the document

**What costs time.** Skia redraws the whole scene whenever a shared value it reads changes: each point of a live stroke, each frame of a drag or a pinch. The cost grows with the ink already there. Measured on the prod export, with one short stroke per mark and moves 33 ms apart:

| Marks | Live stroke, script per move | Layer drag, script per move | Landed stroke, script | Frames over 20 ms |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 3.5 ms | 3.1 ms | 19.5 ms | 0 |
| 50 | 4.8 ms | 4.9 ms | 14.3 ms | 0 |
| 100 | 5.6 ms | 5.2 ms | 16.6 ms | 0 |
| 200 | 9.3 ms | 8.8 ms | 19.8 ms | 0 |

The M1 drops no frames, but at 200 marks over half its frame is spent. On the dev server with three strokes per mark (600 strokes), a drag cost 12.6 ms per move. A CPU profile of that drag: 47% inside CanvasKit's WebAssembly, 34% in JavaScript around it (Skia's `play`, embind's conversions, and making a paint and parsing its color for each stroke), 14% in the browser, and 0.2% in the app's own worklets. The two builds disagree on the slope (about 0.03 ms per stroke per redraw in prod, 0.014 in dev), which I can't explain; both grow.

`DrawingLayerView` draws one `<Path>` with its own paint per stroke (`DrawingLayerView.tsx:99-115`). On a phone this is [#95](https://github.com/nverkhachoyan/tuck/issues/95), still open.

**The shape.** Record each drawing's ink once into an `SkPicture`, cached by its strokes array in a `WeakMap` as `pathFor` caches paths (`:60-69`), and draw it with one `<Picture>` inside the same group, saved layer, and clip. Redactions already draw this way (`RedactionLayerView`). Keep per-stroke nodes where something wraps each stroke: the Stroke eraser's dimming (`wrapStroke`) and the live stroke.

It respects what can't move. Strokes record in index order inside the drawing's own saved layer, so an eraser still clears only what was drawn before it. The multiply stays on the group's paint. A picture of paths holds no image. `beginRecording` gets explicit bounds from `inkRect`.

**Performance.** Better on web, by an estimate: one draw command per mark replaces a paint and a path per stroke, which should remove a third to a half of the JavaScript share for marks of several strokes (1.5–2 ms of the 12.6 ms above) and nothing of the rasterizing. Native plays its recording back in C++, so the gain there is smaller or none (`needs device`, #95).

**Risk and size.** S–M, in one file. `LayersLesson.tsx` imports `DrawingLayerView`, so run the docs build.

**Verify.** Prototype it and rerun the drag at 200 marks of three strokes. Build it only if the drag drops by 2 ms or more per move. Then compare an export of a drawing with erasers, a highlight, and a dimmed scope against one from before, pixel for pixel.

### 5. On native, every document change copies every stroke to the UI thread (`needs device`)

**What costs time.** `EditorCanvas` rebuilds `targets` on every document change and every settled zoom, and assigns it to a shared value (`EditorCanvas.tsx:268-275`). Each target for an unlocked drawing, brushed redaction, or shape carries its strokes, points and all (`layerTargets.ts:28`, `:50-57`; `hitTest.ts:28-30`).

I read worklets 0.13 to see what that assignment does. The JavaScript side caches each array's clone by identity (`serializable.native.ts`, `cloneArray`), so unchanged layers aren't cloned again. But the UI runtime's copy is rebuilt every time: `SerializableArray::toJSValue` makes a new array and converts each element (`SerializableArray.cpp:19-26`); a value keeps its converted copy only when cloned with `shouldPersistRemote`, which a shared value's assignment doesn't pass. The Eraser also captures the strokes in its worklets' closures (`useToolStroke.ts:140-199`, captured by `onSegment` at `:218`); whether those are converted again on each change I didn't confirm.

So each landed stroke, and each pinch that settles, rebuilds every point of the document on the UI thread. An estimate: 600 strokes of 24 points is about 29,000 numbers and 600 objects, a few milliseconds; a page of 120-point strokes is five times that, enough to drop a frame as the next stroke begins. Web has one thread and no copy, so none of this shows there.

**The shape.** Split what a gesture needs in two. A small record per layer goes on every change: id, transform, boxes, and flags. A layer's stroke geometry goes once per strokes array, in a form that crosses as bytes: one `Float64Array` of points per layer with each stroke's offset and width, cached by the strokes array in a `WeakMap`. The hit tests already index `points[i]`, so they take an `ArrayLike<number>` on both threads and still agree with the edits. Nothing changes on disk: the editor audit allowed a side table in memory.

**Performance.** Better on native if the estimate holds; neutral on web.

**Risk and size.** M. It changes the signatures of the stroke hit tests in `layers/strokes.ts`, which the canvas and the edits share so they agree on what a touch hits. Their tests pin that. [#105](https://github.com/nverkhachoyan/tuck/issues/105) (unify the walkers and box helpers) touches the same functions, so do that first or together.

**Verify.** On an iPhone Release build with 200 marks: time from assigning `sharedTargets` to a worklet scheduled right after it, and a UI-thread time profile while a stroke lands. Add the number to #95. Build only if it's over 4 ms, the bar the editor audit used.

### 6. Two flyout mechanisms, and tool names in the editor

**What a newcomer trips on.** architecture.md says the editor imports no tool and that "adding a tool adds no case there" (`:73`). But:

- `Editor.tsx:371-457` holds a `cutVariant` state and about 90 lines that name `"cut"` and `"removeBg"`: which starts, which icon and label the button shows, which spins.
- `useEditorTools.ts:176` names `"adjust"`, so that Adjust alone opens on a selected sticker (`targetImageLayer` leaves stickers out, `framing.ts:67`).
- A toolbar flyout is built two ways. Pen, Shape, and Eraser declare `variants`, `activeVariant`, `selectVariant`, and `variantEntry` (`defineTool.ts:164-169`), which `Editor.tsx:458-476` reads for any tool. Cut uses `grouped` in its spec (`toolSpec.ts:60`) plus the special case.

The editor audit saw this and left it: "readability only", to revisit "if a third grouped tool appears". I have no new runtime evidence. It's here because readability is this audit's brief, and because the generic mechanism now exists and Cut is the only flyout not on it.

**The shape.** Let a variant name another tool: `{ id, label, icon, shortcut, tool? }`. Cut's definition lists Cutout and Remove BG, with Remove BG's entry naming the `removeBg` tool; its remembered choice becomes a preference in `cutSettings.ts`, like every other tool's. `Editor`'s one generic branch starts the named tool. For Adjust, the spec says what it takes: `target: "image"` gains a flag for stickers, and the starter reads the flag. `Editor.tsx` loses about 90 lines and every tool id.

**Performance.** Neutral.

**Risk and size.** M. It touches `defineTool.ts`, the Cut and Adjust specs, `editorChrome.ts`'s `layerActionsFor` (which reads `grouped`), and the chrome tests. No lesson imports these.

**Verify.** The chrome and spec tests. By hand: the rail's Cut flyout, each variant's key, the remembered variant after a reload, the busy spinner while Remove BG runs, and Adjust from a selected sticker.

### 7. The store's history math sits under a 320-line mirror of the edits

**What a newcomer trips on.** `editorSlice.ts` is 801 lines. Lines 230–549 are about 35 actions, nearly all `setDocument("editor/x", (document) => x(document, …))`, with 74 lines of imports to match (`:4-77`). The part that needs reading comes after: sessions, undo and redo stops (`:551-670`), and `stepsByMark`, `sameDocument`, `pastIn`, and `pastBefore` (`:696-801`). A new edit is written once in `layers/…Edits.ts` and again here.

**The shape.**

- `store/history.ts`: the snapshot and session types and the pure functions over them. They take and return plain values already, and the store's tests cover them.
- `store/editorSlice.ts`: the state, `setDocument` and `selectionAfter`, the actions with logic of their own (nudge, select, undo, redo, sessions), and a table for the rest, one line each, built by a typed helper that names the action and says what it selects.

**Performance.** Neutral: the same `set` calls.

**Risk and size.** S–M. The interactive lessons quote this file by declaration name (`HistoryLesson.tsx`, `SessionsLesson.tsx`, `HistoryTimeline.tsx`, `lessonStore.ts`, `IdentityLesson.tsx`, `sources.ts`), so move their sources in the same change and run the docs build.

**Verify.** `pnpm test`, which covers the slice, and `pnpm --dir docs/interactive build`.

### 8. A live stroke gets slower as it grows

**What costs time.** `LivePath` rebuilds the whole path from every point each time one is added (`LiveStrokeOverlay.tsx:437`, with `strokePath`, `DrawingLayerView.tsx:38-56`). So do the cut's live path (`:449`), the live redaction (`:472-481`), and the Eraser's line (`useToolStroke.ts:360-363`). Measured on the prod export, one stroke on an empty canvas:

| Points in the stroke | Script per move |
| :--- | :--- |
| up to 400 | 2.9 ms |
| 800 | 5.7 ms |
| 1,200 | 7.4 ms |
| 1,400 | 8.0 ms |

Most strokes are under 200 points. A long scribble or a line of joined handwriting reaches 1,000.

**The shape.** Not yet known. The growth is the rebuild (one `quadTo` per point through embind, or through JSI on native) plus rasterizing a longer path, and only the first can be removed. The smoothing changes only the path's tail when a point is added, so a builder could keep the settled prefix and append two segments. A profile has to say first which half is larger.

**Performance.** Unknown until then. On native each `quadTo` is a JSI call on the UI thread (`needs device`).

**Risk and size.** S if built, in `strokePath`'s live callers. A straightened highlighter and a cancelled stroke must reset the builder. `StrokesStage.tsx` and `layerViews.tsx` import `strokePath`.

**Verify.** Profile the 1,400-point stroke and compare `strokePath`'s time against CanvasKit's. Build only if the rebuild is over half of the growth.

### 9. architecture.md restates the tool contract, and has drifted from it

**What a newcomer trips on.** architecture.md's paragraphs on a tool's spec and definition (`:73`, `:74`) are about 600 words each and restate the doc comments in `toolSpec.ts:10-49` and `defineTool.ts:75-144`. Nothing checks imports, by design, so this document is the rule, and it's hard to find a rule in it. The copies have drifted:

- `defineTool.ts`'s comment lists no `variants`, `activeVariant`, `selectVariant`, `variantEntry`, or `doneVariant`, though the type has them (`:151`, `:164-169`).
- architecture.md says adding a tool adds no case in the editor (finding 6).
- follow-ups-plan.md `:36` sends a new canvas kind to "its case in `useCanvasInput`'s `finishStroke`", which now only forwards to the tool's definition.

**The shape.** architecture.md keeps the map, the import rules, and rendering. The tool contract lives only in the two files' doc comments. In place of the two paragraphs, three checklists: add a tool, add a canvas stroke kind, add a layer type (the last is already there at `:101-104`).

**Performance.** None.

**Risk and size.** S. Docs only.

**Verify.** Follow the "add a tool" list on a throwaway tool and see whether it's enough.

## 4. Considered and rejected

- **Memoizing scene layers to make a landed stroke cheaper.** On the prod export a landing costs 14–20 ms of script from 1 to 200 marks, flat, with no frame over 20 ms. The 38–64 ms I first measured was the dev build. This backs the editor audit's verdict with a production number.
- **Letting only the selected layer follow the live transform.** Every `LiveLayer` mapper depends on all twelve live values, since Reanimated takes a mapper's inputs from its closure (`mappers.ts:154-177`), so 200 run on each frame of a drag. I expected that to be the drag's cost. It's 0.03 ms per move on web. And a drag can pick up its layer on the UI thread before React knows (`useLayerTransformGesture.ts:341-356`), so every layer must be able to follow. On Hermes it may reach a millisecond at 200 layers (estimate); revisit only if #95 points at it.
- **A summary index for Home's list, or thumbnails outside the project file.** `listProjects` reads and validates every project whole (`projectLifecycle.ts:665-699`). Measured in Node: 0.1 ms for a typical 55 KB project, 3.2 ms for a 1 MB one. It isn't worth a change to how projects are stored.
- **Flattening the layers under a dragged one into a texture.** It would cut the rasterizing that finding 4 leaves. But a backdrop filter and a blend read the canvas they're drawn in, a full-canvas texture costs memory, and a large image that something else disposes is the bug in docs/GOTCHAS.md. Try finding 4's picture first.
- **Splitting the big screen files, and one props type for a tool's panel, bar, and tray.** The first is taste (section 2). The second is already "considered and left" in follow-ups-plan.md, and I found nothing new.
- **From the editor audit, not proposed again:** stroke IDs, `SkPath.offset`, the two-group dimming split, the memoization sweep, gating idle tool hooks, bounding live redaction by the document, and the `sameDocument` and `layers.find` changes. Only the `ToolSpec` rework returns, as finding 6, with its reason given there.

## 5. Suggested order

Each finding can land alone except where noted.

1. **Finding 3** (photo import) first: the largest measured gain, in files nothing else here touches.
2. **Finding 9** (docs) and **finding 7** (store split): small, and they make the later moves easier to review.
3. **Finding 6** (flyouts) before **finding 2** (strokes by kind): both reshape what a tool declares, and `Editor.tsx` is easier to follow once it names no tool.
4. **Finding 1** (session) on its own, after finding 3, which changes what `photos/` hands it. Write its race tests before moving anything.
5. **Finding 4** (pictures) and **finding 8** (live path): each starts with a measurement and may end there.
6. **Finding 5** (UI-thread copies) waits for a phone and for #105, and shares that phone session with #95.
