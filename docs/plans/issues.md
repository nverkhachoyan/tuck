# Issues

Problems seen while checking other work, recorded October 27, 2026, to look into later. Each was also seen on `main` before the change being checked, so none comes from it.

## 1. A rail click right after a header ✓ or ✕ is lost

Seen in the browser pane on a wide window, while smoke-testing step 8a of [composition-plan.md](composition-plan.md) (`ba24ea7`), and again on `56cfe06` with that step's changes stashed.

* **Steps:** open a tool (Find, or Cut out), press ✕ or ✓ in the header, then at once click a tool in the rail (Find).
* **Seen:** the editor goes back to idle and the rail's tool doesn't open. A second click on it opens it.
* **Expected:** the first click opens the tool.
* **Unknown:** the pane was hidden, so its page ran about two frames a second (see docs/development.md), and the lost click may be that alone. Try it in headless Chrome at 60 frames a second, and by hand in a browser, before looking at the code. If it holds there, look at what the header's ✓ and ✕ leave behind as the context bar gives way to the title (a hover or pointer state, or a press that the rail's `Pressable` sees as its own).

## 2. A photo dropped just after a reload lands off the canvas

Seen in the browser pane on a wide window, in the same smoke run.

* **Steps:** reload the editor on a project, and drop a photo onto the canvas within a few seconds, before the canvas has drawn.
* **Seen:** the photo joins the layers and is selected, but sits outside the document: the canvas doesn't show it, and Find on it says "Nothing in the visible crop". The same drop a few seconds later lands in the middle of the view.
* **Expected:** the photo lands in the visible area, or the middle of the document while there's no view yet.
* **Unknown:** the drop was a synthetic `DragEvent`, sent from a script, so check with a real drag too. The likely cause is `useAddImage`'s `onImage` in `Editor.tsx`, which places the image in `canvasRef.current?.visibleArea()`: before the canvas has its size or its view, that area may be empty or at the wrong place, rather than undefined (which would place it in the middle). Look at what `visibleArea()` returns before the first layout.
