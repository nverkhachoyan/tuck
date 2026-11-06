# 9. Pictures and names in the layer rows

Each mark's row in the Layers panel shows a small picture of its ink and a
name from its kind and color. Size M, as the direction says: most of it is
rendering the pictures offscreen without a canvas per row.

Settle first: nothing. The direction marks this section "proposed"; it's
planned as written.

## What the person sees

- A mark's row shows its ink, fitted in the row's thumbnail square, on the square's usual background, in place of the generic "draw" icon.
- The row's name says the kind and the color: "Red pen", "Yellow highlight", "Blue marker", "Green neon". A color that isn't a swatch leaves the kind alone ("Pen", "Highlight", "Marker", "Neon"). A drawing saved before marks that mixes tips or colors stays "Drawing".
- Rows hide, lock, delete, and reorder as before; VoiceOver and the web read the same name ("Hide Red pen").
- The picture updates after a stroke, an erase, or a restyle lands, not during a drag.
- The selection's footer and the toast keep "Drawing" ("Drawing erased · Undo", per the direction's wording).

## The edits

### The name

`shell/ColorSwatches.tsx`: export the swatch list as `SWATCHES` (it's
private now), or a `swatchName(color): string | null` beside
`isCustomColor`.

`layers/panel/LayerRow.tsx`: `layerLabel(layer)` gains a drawing case,
`markName(layer)`: from `markStyle` (step 5), the tip's kind word
(`pen` → "pen", `marker` → "highlight", `ink` → "marker", `neon` → "neon"),
capitalized alone or after the swatch's name; "Drawing" when the pen strokes
disagree on tip or color. `layerKindName` is unchanged, so the footer and
the notice keep "Drawing". The kind words sit in the panel, beside
`REDACTION_LABELS`: Pen's `TIPS` table names the tips as Pen's buttons do
("Highlighter", "Marker"), and the panel can't import a tool.

### The picture

`render/markThumbnail.tsx` (new): `renderMarkThumbnail(layer, pixels): Promise<string>`.
Draws the drawing alone, fitted to `drawingBox` with a small margin, with
`DrawingLayerView`, through `drawOffscreen` into a `pixels`-square image,
encoded as a PNG data URL (as `renderThumbnail` does; the export sheet
learned to show a data URL, not an `SkImage`, which quick changes freed).
A highlighter, which multiplies, draws over white so it shows; ink draws on
transparent. Cached by the strokes array and pixel size in a `WeakMap`, and
renders run one at a time.

On web every Skia canvas is a WebGL context and browsers cap how many a page
gets, so there's no canvas per row; `drawOffscreen.web.ts` reuses its one
surface.

`layers/panel/LayerRow.tsx`: `LayerThumbnail`'s `drawing` case shows
`MarkThumbnail`, which asks for the picture in an effect (row size times
`PixelRatio.get()`) and shows the "draw" icon until it's ready, or if it
fails.

docs/architecture.md's boundaries list the panel's imports as
`editorContext.ts`, the store, `canvas/`, and `shell/`. This adds `render/`
(as `canvas/` already imports it). Change that line in the same change.

## Tests

- `layers/panel/__tests__/` (new `layerLabel` cases, exporting `markName` from `LayerRow.tsx` or moving it to `layerListEntries.ts`, which is plain): "Red pen", "Yellow highlight", "Blue marker", "Green neon"; a custom color gives "Pen"; mixed tips or colors give "Drawing"; a drawing with only eraser strokes left can't occur after step 1, but gives "Drawing".
- `projects/__tests__/projectFile.test.ts`: nothing new; the picture is never saved.
- The render isn't unit tested (Skia); checked by hand.

## Docs and lessons

- docs/architecture.md: the panel bullet (pictures from `render/markThumbnail.tsx`); the boundary line above.
- DESIGN.md: the layer row's thumbnail for a mark, and the names.
- `docs/interactive`: no lesson shows the panel. Run its build anyway, since `render/` gains a file its rendering lessons import beside.

## Checks

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm --dir docs/interactive build`, and `pnpm build:web` (a new file that reaches `drawOffscreen.web.ts`).

## By hand

Web at 390 and 1440, and the iOS simulator:

- Draw a red circle, a yellow highlight, a blue Marker stroke, and a green neon squiggle: four rows named so, each with its picture.
- Pick a custom color: the row says "Pen".
- Erase half the circle: its picture updates after the swipe.
- Restyle the circle blue: "Blue pen", blue picture.
- Thirty marks: the panel scrolls smoothly, and pictures fill in without the canvas stuttering.
- On web, after opening the panel with thirty marks, the console shows no WebGL context warnings.
- Hide, lock, reorder, and delete a mark from its row, with VoiceOver's labels read in the accessibility tree.

Only a phone: memory with a page of marks and the panel open (the Dev HUD's footprint, docs/development.md), and VoiceOver reading the names.
