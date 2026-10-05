---
name: Tuck
description: The last touch for photos and screenshots. A print on a light table, marked up in ink and highlighter.
colors:
  highlighter: "#FFE433"
  on-highlighter: "#000000"
  highlighter-soft: "rgba(255, 228, 51, 0.28)"
  highlighter-edge: "#E8C800"
  ink: "#000000"
  ink-hover: "#26272B"
  ink-pressed: "#3A3B40"
  on-ink: "#FFFFFF"
  paper: "#FFFFFF"
  paper-hover: "#F2F3F5"
  paper-pressed: "#E7E8EB"
  light-table: "#E2E3E6"
  hairline: "#E1E2E6"
  hairline-strong: "#C8CACF"
  text-secondary: "#5D5F66"
  text-tertiary: "#9A9CA3"
  selection-blue: "#2F6BFF"
  danger: "#D92D20"
  danger-soft: "rgba(217, 45, 32, 0.1)"
  shadow: "rgba(0, 0, 0, 0.16)"
  checker-dark: "#D3D5D9"
  checker-light: "#EDEEF0"
  graphite-paper: "#17181B"
  graphite-surface: "#202125"
  graphite-table: "#2B2C30"
  graphite-hairline: "#2E3035"
  graphite-ink: "#F3F3F1"
  graphite-selection-blue: "#5B8CFF"
  graphite-danger: "#FF5A4F"
typography:
  display:
    fontFamily: "Anton, system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  body-strong:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  label:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label-strong:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  figure:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  print: "3px"
  small: "8px"
  medium: "12px"
  pill: "17px"
  large: "20px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.medium}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.ink-pressed}"
  button-primary-large:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.medium}"
    padding: "0 20px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.medium}"
    padding: "0 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-hover}"
  button-secondary-pressed:
    backgroundColor: "{colors.paper-pressed}"
  button-small:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.medium}"
    padding: "0 18px"
    height: "44px"
  tool-button:
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.small}"
    size: "48px"
  tool-button-chosen:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.on-highlighter}"
  ring-choice:
    rounded: "18px"
    size: "36px"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.large}"
  project-print:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.print}"
  tooltip:
    backgroundColor: "{colors.paper-hover}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.small}"
    padding: "5px 9px"
---

# Design System: Tuck

## Overview

**Creative North Star: "Print, Ink & Highlighter"**

Tuck treats every photo as a print laid on a pale light table, and the app as the stationery around it. The bars, the dock, and every sheet are white paper. Controls, labels, and the main action are black ink. The app's only color of its own is a highlighter-yellow swipe, drawn behind whatever is chosen: a tool, a font, a size, a format. Everything else stays neutral gray, so the photo's own colors read true.

The system is quick and decisive. People use Tuck one-handed, for jobs that take seconds, so the main action is always a solid black bar, the shape of a redaction. Targets are generous, every tool shows at once in two rows, and a press answers immediately. Expression lives in a few precise details: the swipe's slight tilt, the print's two shadows, and the Anton wordmark, which uses the same typeface as the meme captions people make with Tuck.

Night is the same system on a graphite table, not a darkroom. The paper turns charcoal and the ink turns off-white, but the highlighter stays the same yellow with black ink on it, so the mark and every chosen state look identical in both palettes. The palette is picked once at launch from the system setting and kept until the next launch.

**Key Characteristics:**
- The photo is a print: it sits on a gray table with a contact shadow and a soft lift.
- The UI is paper and ink: white bars, black labels, hairline edges.
- The only color of the app's own is highlighter yellow, and it means "chosen".
- Blue is reserved for anything drawn over the photo (selection, snap guides, detection picks), and red for destructive actions.
- Controls use the platform's system font. Anton appears only in the wordmark and home's headings.

## Colors

Neutral paper and ink around a gray table, with one highlighter yellow and two functional hues kept to their jobs.

### Primary
- **Highlighter** (`highlighter`): the swipe behind a chosen thing (`ui/Highlight.tsx`), and the band behind the wordmark and app icon. Whatever sits on it is drawn in `on-highlighter` black, in both palettes. **Highlighter Soft** and **Highlighter Edge** tint a drop target or a confirmation.
- **Ink** (`ink`): the main action's fill, every label, and every icon. Ink Hover and Ink Pressed lighten it slightly for interaction. **On Ink** is the white label on a black bar.

### Secondary
- **Selection Blue** (`selection-blue`): the selected layer's outline and handles, snap guides, and detection candidates, which means anything the app draws over the photo. It's cool so it stands apart from most photos' warm tones. Over the photo its lines get a 3.5px dark halo (`rgba(0, 0, 0, 0.22)`) so they read on light images too. A text selection inside a caption uses `rgba(88, 166, 255, 0.4)`.

### Tertiary
- **Danger Red** (`danger`): Delete and other destructive actions only. **Danger Soft** is its hover tint behind a tool.

### Neutral
- **Paper** (`paper`): every bar, the dock, sheets, cards, and screens. **Paper Hover** and **Paper Pressed** are the interaction tints of a paper button.
- **Light Table** (`light-table`): the surface behind the canvas and behind home's project prints. Neutral gray, so it never tints the photo.
- **Hairline** and **Hairline Strong**: the edges between bars and the table, the edges of sheets and secondary buttons, and the grabber.
- **Text Secondary** and **Text Tertiary**: dates, the tagline, and hints. Never for a control's label, since gray labels look disabled.
- **Checker Dark / Checker Light**: the 8px checkerboard that stands for transparency.
- **Shadow** (`shadow`): every shadow in the system, at 16% black by day and 50% at night.
- **Graphite** (`graphite-*`): the night palette. The paper is `graphite-paper`, floating surfaces are `graphite-surface`, the table is `graphite-table`, and ink is `graphite-ink`. The highlighter and its black ink don't change. Selection blue and danger red lighten for contrast. The full night set is in `theme.ts`.

Interaction tints on borderless controls are overlays rather than colors: black at 5% on hover and 10% when pressed by day, and white at 7% and 13% at night. One pair of values works over any background.

### Named Rules
**The One Marker Rule.** Yellow means "chosen", and nothing else is yellow. No yellow buttons, badges, or decoration. If two things on screen are yellow, each must be a chosen option.

**The Off-Limits Photo Rule.** The app's chrome never tints, frosts, or overlaps the photo with color. Only selection blue draws over it, and only to show what's selected or proposed.

**The Same Mark Rule.** The highlighter and its black ink are identical by day and at night. The wordmark, the icon, and every chosen state must look the same in both palettes.

## Typography

**Display Font:** Anton (bundled, falls back to the system font until it loads)
**Body Font:** the platform's system font (San Francisco on iOS, Roboto on Android, system-ui on web)

**Character:** a poster face against a utility face. Anton is the classic meme caption's typeface, so the wordmark sounds like the thing people make. Every control stays in the platform's own font, which suits each OS and keeps the chrome quiet.

### Hierarchy
- **Display** (Anton 400, 72px wordmark on the empty home, line height 1.2): the wordmark and home's headings only.
- **Title** (600, 17px): large buttons, and screen and mode titles in the 56pt header.
- **Body** (400, 15px) and **Body Strong** (600, 15px): running text in sheets and dialogs, the tagline (22px line height), and the labels of medium buttons.
- **Label** (400, 13px) and **Label Strong** (600, 13px): chips, tabs, rows, small buttons, and project names.
- **Caption** (500, 12px): tool labels (letter spacing 0.1), dates, hints, and tooltips.
- **Figure** (600, 28px, tabular numerals): a value read at a glance while it changes, such as an adjustment dial's.

The fonts available for captions (Anton, Montserrat ExtraBold, Playfair Display Bold, Permanent Marker, Courier Prime Bold) are document content, not UI. They're bundled so exports match on every platform. Font previews in the text panel may use them. The rest of the UI may not.

### Named Rules
**The Poster Only Rule.** Anton appears in the wordmark and home's headings, never on a button, label, or title. Literal font sizes are allowed only for Anton, font previews, and the text editor's hidden 16px input.

**The No Gray Label Rule.** A control's label is ink. Gray is for metadata, never for something you can press.

## Layout

The phone screen has three bands: a 56pt paper header (Back, a title, Export), the light table with the canvas inset 12pt from its edges, and the paper dock along the bottom. The dock's content area is 100pt tall, plus a 44pt footer (✕ · mode name · ✓) while a tool or a selected layer is open. It's at most 520pt wide and centered. With nothing open, the eight main tools fill the dock in two balanced rows of four (three over three on a blank canvas), each in an equal-width column with 6pt between the rows. Inside a tool, a row of tools centers while it fits, shrinks its 12pt gaps on a narrow screen, and scrolls sideways only once the gaps reach zero.

Bars and sheets reach the screen's bottom edge, and each pads its own content by the bottom safe-area inset. Nothing sits under the home indicator.

Wider windows rearrange the same parts. From 900pt the tools move into a 76pt rail down the left side. From 1024pt a 352pt inspector panel on the right (room for five tools in a row) holds the open tool's options. Home's content column is at most 760pt wide. Its project prints tile at least 150pt wide with a 16pt column gap and 20pt row gap, up to five across (two on a phone). From 1024pt the start buttons move from the bottom bar up to head the projects in a row.

Gaps come from the spacing scale (4, 8, 12, 16, 24, 32). A one-off that matches no step may stay literal.

## Elevation & Depth

Depth means content on a table. The canvas and project thumbnails are prints, and things that float over the canvas lift. Bars, the dock, rows, and buttons are flat paper, separated from the table by hairlines rather than shadows.

### Shadow Vocabulary
- **Print contact** (`0 1px 1.5px` in `shadow`): the tight shadow where a print touches the table.
- **Print lift** (`0 8px 14–18px` in `shadow`, the project cards' with a −6px spread): the soft shadow that raises a print. On the canvas, both shadows are drawn in Skia in screen pixels, so they look the same at any zoom. At night a 1px edge is added, since a shadow barely shows on graphite.
- **Floating** (`0 10px 28px` in `shadow`): sheets, the selection bar, tooltips, and any other panel over the canvas.

### Named Rules
**The Print Rule.** Only prints and floating panels cast shadows. A bar, row, or button with a shadow is a bug.

## Shapes

Corners are soft but tight: 8px for controls, chips, and tool tiles, 12px for buttons and cards, and 20px for the top corners of a sheet. The small header button is a full pill (17px on a 34px height). Prints are almost square (3px), like photo paper. Corners use continuous curves on iOS. Round choices such as color swatches are circles: a 36px ring inside a 44px target.

The highlighter swipe is deliberately imperfect, the one irregular shape in the system. It's tilted −2°, with uneven corners (4, 10, 5, and 12px clockwise from top left), and it extends 4px below a tool's label to clear the descenders. Under a tab it becomes a 4px stroke along the label's foot.

Edges are hairlines (the platform's thinnest line) in `hairline` or `hairline-strong`. Secondary buttons have a 1px border.

## Components

### Buttons
Decisive bars. The main action is unmistakable, and everything else stays out of its way.
- **Shape:** gently rounded (12px). The small header size is a pill.
- **Primary:** a solid ink bar with a white label, 44pt tall (56pt for the large size that opens a photo on home). There's one per screen.
- **Secondary:** paper with a 1px hairline border and an ink label. On hover its border darkens to `hairline-strong` and its fill to Paper Hover.
- **Danger:** a solid danger-red bar, only for confirming a destructive action.
- **Press:** scales to 0.98 and darkens one step. On web, hover and press ease over 160ms (`cubic-bezier(0.2, 0, 0, 1)`). On native, a press responds instantly. Disabled is 40% opacity.
- **Icon buttons:** a 22px Ionicons glyph with a 36px round halo that appears on hover or press. A toggle that's on gets the highlighter behind it.
- **Text buttons:** a body-size ink label. Strong and danger variants are semibold.

### Tools
The dock's tools are an icon (24px MaterialCommunityIcons) in a borderless 48px tile, with a caption label below. A hover or press tints the tile with the overlay, and a press scales it to 0.92. The tool in use gets the highlighter swipe behind both the icon and the label. A tool whose tray is open is marked by a bold label alone, so only one thing is ever highlighted. A busy tool shows a spinner in place of its icon.

### Chosen State (signature)
Every chosen option uses `ui/Highlight.tsx`: tools, fonts, alignments, brushes, shapes, crop ratios, redaction effects, export sizes and formats, and header and selection-bar toggles. It swipes in from the left over 160ms (ease-out cubic, opacity and scaleX from 0.5), or appears instantly when Reduce Motion is on. Whatever it highlights is drawn in black ink. A chosen tab gets the 4px stroke under its label, so the label keeps its own color at night. Color swatches are the one exception: a chosen swatch gets a 2px ink ring (`RingChoice`), since a yellow swipe would fight the color being chosen.

### Sheets and Floating Surfaces
Opaque paper with a hairline edge in `hairline-strong` and the floating shadow, so it reads the same over any photo. A bottom sheet has 20px top corners, a 52pt header with a centered 36×5 grabber, a semibold title, and a close button. It slides up over 280ms (decelerating) and down over 200ms (accelerating), and can be swiped away. Behind a sheet the canvas stays in view under a 22% black scrim. Dialogs, overlays, and the photo outside the crop box get a 45% scrim.

### Project Prints
Home lays saved projects on the light table as prints: a 3px-cornered thumbnail with both print shadows, with its name (Label Strong) and last-changed date (Caption, secondary) underneath. Long-pressing a print offers Duplicate, Rename, and Delete. With a mouse, hovering shows them as 30px round paper buttons in the print's corner, and Delete fills red on hover.

### Selection Over the Photo
A selected layer gets a 1.5px selection-blue outline over its 3.5px dark halo, with handles sized for touch on phones and for a fine pointer on web. Snap guides and detection candidates use the same blue, and a detected region's check mark is 8px across.

### Wordmark
"Tuck" in Anton, in black on a full highlighter swipe, identical in both palettes. The app icon and favicon are a black T on the same swipe, on white.

### Tooltips (web)
A small paper bubble (Paper Hover fill, a `hairline-strong` hairline, 8px corners, the floating shadow) with a caption label and its keyboard shortcut in secondary tabular numerals. It fades and rises 2px over 120ms.

## Do's and Don'ts

### Do:
- **Do** take every color from `colors` in `theme.ts`, which is the day or the night palette. Never write a literal that assumes one of them.
- **Do** mark a chosen option with `<Highlight />` as the control's first child, and draw what's over it in `on-highlighter`.
- **Do** keep one ink-bar primary action per screen, and make it the thing the user came to do.
- **Do** draw anything over the photo in selection blue, with the dark halo under its lines.
- **Do** take sizes from `typography`, corners from `radii`, and gaps from `space`.
- **Do** give every tappable control at least a 44pt target, with `hitSlop` where the visible shape is smaller.
- **Do** pad each bar and sheet's bottom content by the safe-area inset, and let its paper run to the screen's edge.
- **Do** check every change in both palettes. The highlighter must look the same in each.

### Don't:
- **Don't** build a darkroom: no mostly black editor, and no gray controls that look disabled. Night is a graphite table, never pure black.
- **Don't** mark a chosen option with an outline, an underline alone, or a filled chip. Chosen means highlighted. Only color swatches get a ring.
- **Don't** add a second accent. No coral, no brand gradients, and no yellow outside a chosen state or the wordmark.
- **Don't** put frosted or translucent glass over the photo. Panels are opaque paper.
- **Don't** give bars, rows, or buttons a shadow. Only prints and floating panels lift.
- **Don't** set controls in Anton or a caption font. The poster face belongs to the wordmark and home's headings.
