# Gotchas

Bugs in Tuck's own code that looked right and broke under timing or state nobody planned for, each with how it was found. How the platforms behave goes in AGENTS.md's learnings. Write one up here when the cause took more than reading the code to find, so the next search starts from it.

## A delayed free can belong to an earlier release

Fixed October 29, 2026, in `editor/render/imageCache.ts`.

* **Seen:** on web, Cut with Tap and Adds. A first tap selected an object; a second tap elsewhere threw "Cannot pass deleted object as a pointer of type Image const*" from CanvasKit, with a stack of only CanvasKit and Metro frames. It happened every time on a freshly loaded page and rarely on one that had been open a while.
* **Cause:** `decodedImages` frees an image two animation frames after its last user lets go (`afterSkiaDraws`), since a Skia canvas keeps drawing its previous recording for about a frame. Each release started its own wait, and the wait only checked that no one held the image when it ended. On the second tap Cut read the old mask to merge the new pick into it (`withMask`), and its release started a wait while the canvas still drew the mask. About 25 ms later the canvas moved to the new mask and let go. The first wait ended about 5 ms after that, found no users, and freed the mask before the canvas had redrawn.
* **Fix:** each entry counts its releases, and a wait frees the image only if no release came after the one that started it. The wait that frees always starts from the last user's release (the test "waits from the last release, not an earlier one that ends after it").
* **The rule:** a callback that runs later must check that it's still the latest, not only that the state looks right when it runs. A count of users can't say which release a wait belongs to.

How it was found, which works for any freed Skia image on web:

1. Reproduce in headless Chrome over CDP (see docs/development.md): the browser pane, hidden, runs about two frames a second, which changes every frame-timed race. Make the photo with an `OffscreenCanvas` and paste it on `window`, and load the page fresh before each run.
2. Find who freed the image and who drew it. Wrap `CanvasKit.Image.prototype.delete` to keep a stack and a time on the object, and `width` (any method the failing draw calls) to record, when `isDeleted()`, both stacks and both times. The draw came from the canvas's replay (`Player`'s `play`, from `drainUIQueue` and the Reanimated mapper) 0.4 ms after the cache's `dispose`, in the same frame.
3. Log the cache's `acquire` and `release` with the URI, the user count, a stack, and `performance.now()` on `globalThis`, temporarily. The timeline showed two releases and a free 5 ms after the second.

## "No handler for tag 1" after a tool's card opens on a wide window

Seen October 30, 2026, in the wide editor's tool card (`PanelViews.tsx`, `useEditorLayout.ts`). Not root-caused, and the constant reserve below does not remove it.

* **Seen:** on web, in the Browser pane while it was hidden, opening Find or Adjust with the card left the canvas blank and raised "No handler for tag 1" from Gesture Handler's `setGestureHandlerConfig` (three frames, none of them React's), as soon as a screenshot made the pane draw again. A card that measured itself (`onLayout`, then `TrayHeight`, as the phone's tray does) failed nearly every time; one that reserves a constant height in the commit that opens the tool failed in about half the runs. Never seen with the pane drawing at full rate when Find opened, on the phone layout, or six open-and-close cycles in one session. The baseline without the card was clean in two runs.
* **Where to look:** the stack is the microtask `updateHandlers` queues in the legacy `GestureDetector`, which sets config for each attached gesture's tag. `EditorCanvas` rebuilds its composed gesture whenever the frame or a tool's canvas input changes, and opening a tool changes both. The canvas has since moved to Gesture Handler 3's hooks (`useGesture`), and Metro loads the package's `src` (its `react-native` field), not `lib/module`. The legacy detector's `updateHandlers` microtask is no longer on this path.
* **Kept:** the constant reserve (`CARD_INSET`), since it makes one frame change in the opening commit, as the inspector's width did, and the photo doesn't resize as Find's status text changes.
* **To dig further:** log `createGestureHandler`, `dropGestureHandler`, and `setGestureHandlerConfig` with `performance.now()` and a stack in `lib/module` (a temporary edit), open Find with the pane hidden, then draw it, and compare tag 1's order of calls. Re-check with the pane drawing, since a hidden one batches frames.

## An offscreen surface's dispose left its WebGL context alive

Fixed November 3, 2026, in `editor/render/drawOffscreen.web.ts` ([#60](https://github.com/nverkhachoyan/tuck/issues/60)).

* **Seen:** in Chrome, GPU memory back at the projects grew with each project opened, edited with five 24MP photos, and exported (1.0 GB, then 1.7 GB), and didn't fall while the tab stayed open.
* **Cause:** `drawOffscreen` made its shared surface with `Skia.Surface.MakeOffscreen`, which on web makes a WebGL context and a Skia GPU context for each surface. The surface's `dispose` deletes only the surface. The context stays registered with CanvasKit, so it's never collected, and keeps its drawing buffer (183 MB for a 6000×4000 export) and every texture drawn into it, including the export's photos. A new surface came after each 10-second idle and each growth, so each export and thumbnail left one behind, until Chrome dropped the oldest past 16.
* **Fix:** `drawOffscreen.web.ts` makes its own surface on an `OffscreenCanvas` and frees it as Skia's web canvas does when it unmounts: abandon and delete the GPU context, lose the WebGL context, and unregister it from CanvasKit.
* **The rule:** on web, a Skia object that wraps a WebGL context needs that context freed too. Check what a library's `dispose` actually frees before keeping one around.

How it was found:

1. The kernel's numbers (the GPU process's VRAM and GTT in `/proc/<pid>/fdinfo`) are no good for this. The driver keeps memory it has freed and gives it back late, so they stayed high after a reload and even on `about:blank`.
2. Chrome's memory-infra dump is reliable: over CDP on the browser target, `Tracing.start` with `disabled-by-default-memory-infra` and no triggers, then `Tracing.requestMemoryDump` with `levelOfDetail: "detailed"`, then `Tracing.end`. The renderer's `webgl/offscreen_context_*` entries list each live context and its drawing buffer, and the GPU process's `gpu/shared_images` shows what they share with it.
3. Load photos without the file picker with `DOM.setFileInputFiles` on the app's `input[type=file]` (it exists once "Open a photo" or "Add photo" has been clicked). Then click through with `element.click()`.
4. What stays after the fix and isn't a leak: CanvasKit's WASM heap (`CanvasKit.HEAPU8.buffer.byteLength`), which WebAssembly can grow but never shrink, held the export's peak until the tab reloads (lowered in [#74](https://github.com/nverkhachoyan/tuck/issues/74)), and Chrome's transfer memory for uploads (`gpu/transfer_memory`) stays as a pool. Neither grows after the first pass.
