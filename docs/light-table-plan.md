# Light table plan

A third design pass, from a review on 2026-10-04 at https://claude.ai/artifact/9WTBq6je6oxPMGRhqESQrv. The user didn't feel like using the app. The review's diagnosis: Tuck looked like a darkroom (a mostly empty black editor, gray controls that read as disabled, one coral button) while its jobs are quick marker work, the first caption looked weak, home was a splash screen, and nothing chosen looked chosen.

The direction: the photo is a print on a light table, the bars are paper, ink is black, and the app's one color is highlighter yellow, swiped behind whatever is chosen. The primary button is a solid black bar, the shape of a redaction. The wordmark is set in Anton, the typeface Tuck uses for meme captions.

It follows `design-rethink-plan.md`, whose structure stays: one bottom bar, trays, tool sessions, Export as a sheet, the desktop rail and inspector. It overturns that plan's rule 3: a chosen option is highlighted, not outlined.

## Decisions

Taken by the user on 2026-10-04.

* **Light by default, following the phone.** The palette is picked once at launch from the system's setting (`colorScheme` in `theme.ts`), and the app's native interface style is pinned to it, so the keyboard, alerts, and status bar match until the next launch. Night is the same system on a graphite table.
* **Anton** for the wordmark and home's headings, replacing Instrument Serif.
* **Two rows of four tools** on a phone, so none sits off-screen.

## Steps

Work one step at a time, verify at 390 × 844 and desktop width on web in both palettes, and on the iOS simulator for anything native. Stop after each step with a Conventional Commits message for the user to commit.

### 1. Palette and type (done)

Built as described. `colors` gained `primary`/`onPrimary` (the main button), `highlight`/`onHighlight` and `highlightSoft`/`highlightBorder` (drop targets and confirmations), `onSelection`, and `shadow`; every `accent` token is gone. Snap guides and detection's picks are drawn in `selection`. Home's coral glow is gone; the wordmark and headings use Anton, loaded with the caption fonts. `@expo-google-fonts/instrument-serif` is uninstalled. The dial's indicator is a 3pt ink bar over lighter ticks. Native needs a rebuild (`npx expo prebuild --clean`) for `userInterfaceStyle`.

* `theme.ts` gets a day and a night palette and picks one at launch. The coral accent retires: `primary` (ink) is the main button's fill, `highlight` (yellow) marks a chosen thing, and `selection` (blue) stays for selected layers and anything drawn over the photo, such as snap guides and detection candidates.
* `app.json` follows the system (`userInterfaceStyle: automatic`, which needs a native rebuild); the status bar, the web document's background, and the web theme color follow the palette.
* Anton replaces Instrument Serif for the wordmark and home's headings.
* Fix the colors written outside the theme that assume a dark screen (fades, shadows, tile tints).

### 2. Chosen means highlighted (done)

Built as described in `ui/Highlight.tsx`, behind tools (the rail's too), header and selection-bar toggles, Draw's brushes and shapes (`RingChoice`'s `highlight` variant, whose children can take the ink color), Redact's effects, adjustments, crop ratios and actions, fonts and alignments, and Export's size and format, whose unchosen options lost their boxes. Tabs (the text style panel's and the Add sheet's) get `<Highlight under />`, a short stroke under the label, so the label keeps its color in night. It swipes in from the left over 160ms with a shared value: Reanimated's entering animations pin a view's position on web while a parent animates in, which put Export's highlights a row too low.


* One `Highlight` in `ui/` draws the highlighter swipe behind a chosen tool, font, ratio, size, format, or effect. It replaces `chosenOutline` and `chosenUnderline`; a chosen tab is ink and semibold with a short swipe under its label. Color swatches keep their ring.

### 3. The canvas (done)

The photo's inset in the view went from 16 to 12pt, which still leaves the corner handles room. The canvas casts a print's two shadows (a tight contact shadow and a soft lift), drawn as two shapes since image filters on one shape chain. The hairline edge stays only at night, where a shadow barely shows on the graphite table.


* Smaller margins around the photo, and a soft shadow under it in place of the hairline edge.

### 4. Tools (done)

The main tools are a `ToolGrid` (`ToolButton.tsx`), two balanced rows of `compact` tools that take the dock's whole height, since there's no footer while nothing's open: eight with a photo, three over three on a blank canvas. Find is a tool in Redact's row and returns to Redact when it ends, either way; the rail marks Redact while it's open. Sticker opens the sheet, now titled Stickers without its Photo row, and Photo picks a photo. Tool labels are ink rather than gray, since the highlight marks the chosen tool. Redact's effect and color stayed behind Style: its row holds five tools now, leaving no room.


* Two rows of four on a phone: Text, Draw, Redact, Sticker, Crop, Adjust, Cut out, Photo. Find becomes one of Redact's tools; Add splits into Sticker (the sheet's stickers) and Photo (add a photo). The desktop rail keeps one column.
* Redact's effect and color sit in view rather than behind its Style tile, if they fit.

### 5. The default caption (done)

The outline's stroke is a fifth of the font size (`OUTLINE_WIDTH` in `layers/textLayerLayout.ts`), so a tenth shows past the fill. A quarter, twice the old width, merged Anton's close-set letters into one shape. Serif's is 0.14: Playfair's hairlines and serifs clotted at a fifth. Existing projects' outlines grow too.


* A heavier outline, about twice today's (`outlinePaint` in `layers/textLayerLayout.ts`), so the first caption reads on any photo. Existing projects get it too.

### 6. Home (done)

Home is paper bars around the table, as the editor is. The header has the wordmark (Anton with the highlighter through its lower half; at night the swipe covers it and the word is black) and Edit, which home now owns. Projects are prints on the table with their name and date always shown, two across on a phone (`MIN_CARD_WIDTH` 150, at most five), so the hover caption and "Recent" are gone. The bottom bar is the black Open a photo over Paste and Blank canvas; from 1024pt they head the projects in a row. Empty, home is the wordmark and tagline over the same bar. `LogoMark` is gone. The app icon, adaptive icon, and favicon are a black T over a highlighter swipe on white (`assets/*.svg`, rendered to PNG in headless Chrome); the adaptive icon's background is white. The icon needs a native rebuild to show.


* Two columns of projects as prints with a name and when they were last changed.
* One black bar opens a photo; Paste and Blank canvas sit under it. The wordmark has the highlighter swipe. The app icon follows the new mark.
