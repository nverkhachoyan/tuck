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
