# How other editors handle drawing, erasing, and layers

Researched November 2026. Where a claim comes from memory of the product
rather than a page read for this brainstorm, it says so. Canva's and
Goodnotes' help pages refused automated fetches (HTTP 403), so their
entries rest on search summaries and are marked as less certain.

## Three families

Editors split into three models, and the eraser follows from the model:

| Model | Who | What a stroke becomes | What the eraser reaches |
| --- | --- | --- | --- |
| **Pixel layers** | Photoshop, Procreate, Krita (paint layers), ibisPaint | Pixels in the active layer | Only the active layer |
| **One ink surface** | Apple Markup / PencilKit, Instagram and Snapchat drawing, Goodnotes, OneNote | A stroke in one shared drawing over the image (or page) | Every stroke on that surface |
| **Every mark is an object** | tldraw, Excalidraw, FigJam, Snagit, Figma Draw, Canva (mixed) | A shape, element, or vector object of its own | Whatever it touches, usually whole |

Tuck sits between the first and the third: each Draw session is a layer
(like a pixel layer, the eraser reaches only the selected one) but that
layer is vector strokes the eraser could reason about, and shapes are
already separate objects the eraser removes whole.

## Pixel layers: the eraser follows the active layer

- **Photoshop.** The Eraser paints transparency into the active layer only. Adobe community answers state the plain Eraser never had an option to erase several layers at once; "Sample All Layers" exists on the Magic Eraser, Clone Stamp, and Healing tools, and even then they *change* only the active layer ([Adobe community](https://community.adobe.com/questions-712/erase-on-all-layers-1068057), [Peachpit](https://www.peachpit.com/articles/article.aspx?p=1661121)). Photoshop makes up for it with ways to pick the layer by touching the canvas: the Move tool's Auto-Select, and ⌘/Ctrl-click on a pixel (from product knowledge). Groups are pass-through by default, so they organize without changing how things composite.
- **Procreate.** The eraser erases on the current layer ([Procreate guide](https://www.scribd.com/document/654978476/Procreate-Guide)). Drawing never creates layers on its own; the artist adds one. A touch-and-hold "Layer Select" gesture picks the layer under the finger (from product knowledge).
- **Krita.** Paint layers erase like Photoshop's. Vector layers have *no* eraser at all; you select shapes and delete them, or convert the layer to pixels ([Krita Artists](https://krita-artists.org/t/vector-eraser/11346)).
- **PaintShop Pro.** "Use all layers" samples the merged image, but only pixels in the current layer are erased ([Corel](https://product.corel.com/help/PaintShop-Pro/540221072/Main/EN/Doc/Corel-PaintShop-Pro-Erasing-image-areas.html)).

What works there: it's predictable, and pros expect it. Why it doesn't fit
Tuck: it depends on the user knowing which layer is active, and on
pick-by-touch shortcuts that are hard to find on a phone. Tuck's users
"won't learn it, set it up, or read about it first" (PRODUCT.md).

## One ink surface: the eraser reaches all ink

- **Apple Markup / PencilKit.** All freehand ink is one `PKDrawing` over the photo; shapes, text, and signatures are separate annotation objects (from product knowledge). The eraser has two modes: **vector** ("when a vector eraser touches any portion of a drawn line, it removes the entire line") and **bitmap** (removes only the parts it touches), plus a fixed-width bitmap eraser since iOS 16.4 ([Apple: PKEraserType](https://developer.apple.com/documentation/pencilkit/pkerasertype), [vector](https://developer.apple.com/tutorials/data/documentation/pencilkit/pkerasertype/pkerasertypevector.md), [bitmap](https://developer.apple.com/documentation/pencilkit/pkerasertype/pkerasertypebitmap.md)). Markup labels them Pixel Eraser and Object Eraser. The eraser only erases marks made with Markup, never the photo ([Macworld](https://www.macworld.com/article/233339/ios-13-ipados-13-markup-on-your-screen-captures-and-photos.html), [Apple Community](https://discussions.apple.com/thread/250804380)), and people still go looking for it to erase the photo ([Apple Community](https://discussions.apple.com/thread/255831236)).
- **Goodnotes.** Three eraser styles: **Precision** (only what's under the circle), **Standard** (removes a short segment of a continuous stroke), and **Stroke** (the whole stroke), plus an **Erase Filter** that turns erasing of pen, pencil, highlighter, and tape on or off by type. Older versions had "Erase Highlighter Only" ([Goodnotes help, via search summary](https://support.goodnotes.com/hc/en-us/articles/7353718249231-Erasing-content)). Users keep asking for type filters ([feedback](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/44050440-selective-eraser)), which suggests "erase the highlight, keep the ink" is a common need.
- **Instagram and Snapchat stories** (from product knowledge): all drawing is one surface on top of the photo, and the eraser erases any of it. Stickers and text are separate objects you move.

What works there: there's no "which layer?" question, and for markup over a
photo that's what people expect. The cost: you can't move one scribble
apart from another, and drawings can't sit under a sticker or caption.

## Every mark is an object: the eraser removes what it touches

- **tldraw.** Each freehand stroke is its own shape. The eraser deletes **whole shapes**, every one its path crosses. It tests the segment between pointer moves, not the point, so a fast swipe can't skip a shape. Shapes it will remove fade while you drag, and nothing is deleted until the finger lifts, all in one step; Escape takes it back. Hitting a shape in a group marks the outermost group, so erasing follows selection's boundaries, and erasing from inside a frame or group leaves the container ([tldraw: Erasing](https://tldraw.dev/blog/erasing)).
- **Excalidraw.** The Eraser was added to remove many elements quickly, "especially those tiny freedraw lines" ([Excalidraw blog](https://plus.excalidraw.com/blog/year-three)). It removes elements whole, which is why an Obsidian user found it also deleted the image their drawing was over ([Obsidian forum](https://forum.obsidian.md/t/enhance-eraser-function-to-remove-only-drawing-above-an-inserted-images/87301)).
- **FigJam.** Erases whole objects, testing a point rather than a segment, per tldraw's comparison ([tldraw](https://tldraw.dev/blog/erasing)). Users ask for a pixel eraser ([Figma forum](https://forum.figma.com/suggest-a-feature-11/why-not-a-figjam-pixel-eraser-like-everyone-else-7319)).
- **Figma Draw** (2025). Pencil and Brush make vector paths. Figma staff say an eraser for vector editing has launched (Shift+E in Draw or vector edit mode) and that it cuts the vector paths ([Figma forum](https://forum.figma.com/suggest-a-feature-11/launched-desirable-feature-for-figma-draw-eraser-46391), [help](https://help.figma.com/hc/it/articles/31440438150935)). It's a vector edit: erasing changes the paths' geometry rather than painting transparency.
- **Snagit**, the closest product to Tuck's screenshot markup. Every pen mark is a vector object you can move, edit, or delete with the Move tool. The Eraser only erases the *flattened* image, not objects ([TechSmith: Pen](https://www.techsmith.com/learn/tutorials/snagit/pen/), [Eraser](https://www.techsmith.com/learn/tutorials/snagit/eraser/)). Recent versions edit every pen mark at once.
- **Illustrator** (from product knowledge). Its Eraser cuts vector paths. With objects selected it erases only those; with nothing selected it erases any unlocked object it touches, on any layer. **The selection narrows the eraser; without one, it reaches everything.**
- **Canva.** Draw has pen, marker, glow pen, highlighter, and eraser. Its help says to "brush over the areas you want to erase", so it erases partially. A third-party guide says a drawing is its own element on the page, created when you leave Draw ([Canva help, via search summary](https://www.canva.com/help/draw-in-canva/), [Tella](https://www.tella.com/blog/how-to-draw-on-canva)). Sources disagree on whether the eraser reaches drawings from earlier sessions, so this entry is uncertain. The model (one element per Draw session) is Tuck's.

## Lessons for Tuck

1. **For markup over a photo, the eraser should reach all the user's ink.** Every product built for marking up a photo or screenshot (Markup, Instagram, Goodnotes, tldraw, Excalidraw) erases any ink you drew without asking which layer. Only pro pixel editors scope the eraser to a layer, and they come with layer-picking gestures Tuck's users won't find.
2. **"Erase marks, not the photo" is the expected limit.** No markup tool erases the underlying image; Markup's users ask, and are told it only erases marks. Tuck's Cut covers removing parts of a photo.
3. **There are two erasers, and people want both.** Whole-stroke erasing (PencilKit's vector, Goodnotes' Stroke, tldraw) undoes a scribble in one swipe; partial erasing (bitmap, Precision, Standard) tidies an edge. Apple, Goodnotes, and Figma each ship both or more.
4. **Vector editors erase by changing geometry**, not by painting transparency (Figma Draw, Illustrator, Goodnotes Standard). Geometry keeps bounds, hit-testing, and file size honest.
5. **Selection can narrow the eraser** (Illustrator), and groups can bound it (tldraw), but neither should be required.
6. **Preview what will go.** tldraw fades the shapes before removing them, and commits once on release.
7. **Groups don't solve erasing anywhere.** In Photoshop and Procreate groups organize; the eraser still follows the active layer. In tldraw a group is a unit to erase whole. No product uses groups to let an eraser cross layers.
