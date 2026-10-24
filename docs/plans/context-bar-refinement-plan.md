# Context bar refinement

A plan for the wide editor's context bar (1024 points and up: web, and iPad), written October 2026, after `context-bar-plan.md` shipped. It refines that bar. It isn't a new look, and the phone dock, its trays, and the inspector's sections stay as they are.

## What the shipped bar does

Measured in the browser at 1440 and 1024 points wide, in both palettes. At 1024 the bar's scrolling row has 581 points, or about 512 while Reset shows.

| Context | At 1024 |
|---|---|
| Draw | Needs 788 points. Marker, Neon, and the color chip are out of view, with nothing to say they're there. |
| Redact | Needs 635. "Pixelate" is cut to "Pixelat" under the fade, and the color chip is out of view. |
| Cut out | In Pick, "Redact" is cut in half. In Keep with a mask (Reset showing), it needs 882 of 512: the larger sizes, soft and hard edges, Invert, and Redact are out of view. |
| Find, Text, a selected layer | Fit, Text with 1 point to spare and a selected photo with none. |

At both widths:

* **Two highlighters.** Draw marks the tool and the pen tip, Redact the tool and the effect, and Cut out's Keep the tool and the edge. Side by side, with nothing visible between them, they read as two competing selections.
* **The rule doesn't show.** `BarRule` is a hairline (half a pixel on a 2× screen) in `colors.border`: about 1.3:1 against the bar by day and 1.35:1 at night.
* **Draw's color reads as a size.** Its chip is a red circle right after five red size dots.
* **Text's chips are hard to tell apart.** The outline's glyph (`format-textbox`) reads as "text box", and the box's is another rectangle. At 16 points beside a 22-point swatch, the glyphs are decoration. At night, a black swatch and a slashed, off one look alike.
* **No shared rhythm.** Segments sit 2 points apart, align chips are 56 wide with 12 between, color chips have 8, and size rings none. Glyphs are 16, 18, 20, and 22 points.
* **Cut out's edges are unlabeled on iPad.** Soft and Hard are icons only, and tooltips don't exist there.
* **A selected layer's actions are fine.** They don't repeat the floating selection bar (Free resize, Arrange, Duplicate, Delete), Sticker exists only there, and the bar is the only place iPad labels them.
* **Night is right.** The same yellow, black ink on it, readable ink elsewhere, and nothing looks disabled that isn't.

## Decisions

* **In the bar, the highlighter marks the mode, and nothing else.** Every other option is a chip: a glyph, its current value in words, and a caret, opening a modal popover whose choices are highlighted as they are today. The chip keeps the value in view, and the popover holds the alternatives. One highlighter in the bar answers "what's chosen", and the chips answer "what sets color, size, effect". The tray rows on phones stay as they are.
* **Size is a chip at every width.** Five 44-point rings take 220 points, the most of anything in the bar. The chip shows the current size as a dot drawn in ink, so the only color in the bar is the color chip. Changing size takes two presses, as the phone's Style tray does; on web, `[` and `]` still step it, and the chip's tooltip says so.
* **Color chips stay swatches**, without a caret: a swatch opening colors needs no explaining. Text's three get a word each, since together a swatch doesn't say which color it is.
* **Groups, not rules placed by hand.** Items in a group sit 2 points apart. Between groups, a 1-point rule in `colors.borderStrong`, 24 points tall, with 10 points on each side (about 1.6:1 by day and 1.9:1 at night). It's a divider, not a control, so it doesn't need 3:1.
* **Overflow still scrolls, but never cuts a label.** The fade covers from the first item that doesn't fit whole, so the edge falls between items. The bar should fit at 1024 in nearly every state. The fallback is for Cut out with Reset showing, and for iPad text set larger than the default (React Native's `Text` follows Dynamic Type).
* **Align stays icons only.** Left, center, and right glyphs mean the same thing everywhere. It's the one exception to labeling everything for iPad.
* **A selected layer's bar is left alone**, apart from the shared glyph size.
* **One glyph size.** 18 points for every glyph in the bar, swatches 20, the caret in ink. Every target stays 44 points.

What the bar holds afterward (`┃` is a rule between groups):

| Context | Bar |
|---|---|
| Draw, a brush | `[Brush · Shape · Eraser] ┃ [Pen ▾] [●] [Size ▾]` |
| Draw, Shape | `[Brush · Shape · Eraser] ┃ [Rectangle ▾] [●] [Size ▾]` |
| Draw, Eraser | `[Brush · Shape · Eraser] ┃ [Size ▾]` |
| Redact | `[Box · Brush · Eraser] [Find] ┃ [Blur ▾] [● for Solid] [Size ▾ for the brush and eraser]` |
| Find | `[Solid ▾] [● for Solid]` |
| Cut out | `[Pick · Keep · Erase] ┃ [Size ▾ for the brushes] ┃ [Subjects] [Invert] [Redact]` |
| Text | `[left · center · right] ┃ [Classic ▾] ┃ [Color ●] [Outline ⊘] [Box ●]` |
| A selected layer, Adjust | Unchanged |

The popovers:

* **Pen tip:** Pen, Marker, Neon, as icon-and-name segments.
* **Shape kind:** Rectangle, Ellipse, Line, Arrow, named, in place of today's icon-only rings.
* **Effect** (`shell/redactStyle.tsx`, shared by Redact and Find): Solid, Blur, Pixelate, then that effect's strength.
* **Size:** the five dots. Cut out adds Soft and Hard, named.
* **Font and color:** as now.

Expected widths at 1024, against 581 points:

| Context | Width |
|---|---|
| Draw (a brush) | about 495 |
| Draw (Shape) | about 515 |
| Redact (brush, Blur) | about 535 |
| Text | about 510 |
| Cut out (Pick) | about 555 |
| Cut out (Keep, Reset showing) | about 630 of 512, so it scrolls, cut between items |

iPad's usual landscape widths (1133 to 1376 points) fit every state.

## Open question

Size at every width is the simpler rule. The alternative keeps the five dots inline when they fit (from about 1200 points) and uses the chip only below that: one press on wide windows, at the cost of a second arrangement per tool and a bar that changes shape as the window does. Settle it before step 3.

## Steps

Each step passes `npm run check` and `npm run typecheck` (and `npm test` where it touches pure modules), and leaves both layouts working, with a commit message handed over at the end. Check each on web at 1440 and 1024 points wide, by day and at night. A browser pane that's hidden draws about two frames a second, so check timing and screenshots in headless Chrome over CDP (see AGENTS.md).

### 1. Groups and a rule that shows

* `BarGroup` in `shell/ContextBar.tsx`: a row of items 2 points apart. The bar puts the rule between consecutive groups itself, so `BarRule` goes.
* Each tool's bar wraps its parts in groups. Nothing else moves yet.
* Glyphs in `OptionSegments`, `BarButton`, and the chips go to 18 points.

Check that the rule reads in both palettes, and that nothing a group holds lost its 44-point target.

Commit: `feat: group the context bar's options with a visible rule`

### 2. A fade that cuts between items

* `BarGroup` wraps each child in a view that reports its layout, and the bar collects the items' edges in the row's coordinates. Children are the tool's controls (each chip is one child, its popover inside it), so measuring needs nothing from the controls themselves.
* `ScrollFade`, while the row overflows, covers from the left edge of the first item that doesn't fit whole to the row's end in `colors.background`, with the gradient ending at that edge. It recomputes on layout and when scrolling stops, not on every scroll event, so the cover doesn't jump while dragging.

Check Redact and Cut out at 1024, where today's labels are cut, and scroll to the end and back.

Commit: `fix: end the context bar's fade between options`

### 3. Chips, and Draw

* `BarChip` in `shell/ContextBar.tsx`: a 44-point control with a glyph, a label, and a caret that opens its children in a `Popover`, passing `restoreFocus` through. `accessibilityState.expanded` follows the popover.
* `SizeChip` in `shell/ToolOptions.tsx`: a `BarChip` whose glyph is the current `SizeDot` in ink and whose popover is `SizeChoices`. Its label for screen readers is "Size 3 of 5", and its tooltip names `[` and `]`. It takes extra content for the popover (Cut out's edges).
* `DrawBar`: the pen tip becomes a chip (the tip's icon and name) while a brush is in use, and `ShapeKindChip` becomes a `BarChip` with the kind's name, its popover listing the kinds by name. Then the color, then size.
* A second press on the active sub-tool stays a no-op, and options still apply at once.

Check at 1024 that Draw fits in all three sub-tools, that each popover opens, applies a choice, and closes on Escape without finishing Draw, and that the eyedropper still closes the color popover and shows its hint.

Commit: `feat: show Draw's tip, shape, and size as chips`

### 4. Redact and Find

* `RedactLook` in `shell/redactStyle.tsx`: an effect chip (the effect's icon and name) whose popover has Solid, Blur, and Pixelate, then the effect's strength. The color chip follows it for Solid.
* `RedactBar`: size becomes a `SizeChip` for the brush and eraser. Find stays a button in the sub-tools' group.
* Find's bar shows the same `RedactLook`, and Find still doesn't rewrite the redact tool's settings.

Check at 1024 in Box, Brush, and Eraser, each effect, and Find.

Commit: `feat: show Redact's effect and size as chips`

### 5. Cut out

* `CutOutBar`: the brushes' size becomes a `SizeChip` whose popover adds Soft and Hard as named segments. Subjects, Invert, and Redact form their own group after it, keeping their busy states.

Check at 1024 in Pick, Keep, and Erase, with and without a mask (Reset shows with one), and that a scrolled bar still ends between items.

Commit: `feat: show Cut out's brush as a chip`

### 6. Text

* `ColorChip` in `shell/ColorPicker.tsx` takes a `title` (a word beside the swatch) in place of `icon`, which only `TextBar` uses. Text's chips read Color, Outline, and Box. Their screen-reader labels stay "Text color", "Outline", and "Box".
* The bar's align becomes three 44-point icon segments 2 points apart, marked with the highlighter. The phone's tabs keep `AlignPicker` as it is.
* `FontChip` becomes a `BarChip`, its label set in the font, as now.

Check with a hardware keyboard on web: type in a text layer, open the outline's colors, pick one, press Escape, and keep typing. The caret must still be in the text, and Text must still be open. Do the same with the font popover, and with the colors at night, with the outline and box off.

Commit: `feat: name text's color chips in the context bar`

### 7. Docs

* DESIGN.md's Chosen State: in the wide editor's bar, the highlighter marks the mode, and options are chips that show their value and open a popover.
* AGENTS.md: the bar's line under Learnings (groups, chips, the fade), and any learnings from steps 1–6.
* Doc comments on `ContextBar`, `OptionSegments`, the bars, and `ColorChip`.
* `npm run build --prefix docs/interactive`, in case a lesson quotes something that moved.

Commit: `docs: describe the context bar's chips and groups`

## Not covered by the browser

* **iPad.** Touch on the bar and its popovers, Dynamic Type at larger sizes, and how 1133 and 1180-point windows look. Check on the iPad Pro 13-inch and iPad mini simulators if the development build still launches; otherwise say so when handing over.
* **The phone.** Its dock and trays should be untouched. Compare screenshots of each tray before and after step 1 and step 6, which touch shared parts (`SizeChoices`, `ColorChip`, `AlignPicker`).

## Risks

* **Two presses for size.** The cost of fitting everything. If it's missed in use, the open question's alternative is the way back, and it's contained to `SizeChip`'s callers.
* **Measuring items on native.** An `onLayout` per item adds views to the bar and layout callbacks while it changes. The bar holds at most about 15 items and changes only when a tool or sub-tool does, so this should be cheap. If it isn't, measure groups only and cut between groups.
* **Nested popovers.** A chip's popover must never hold another chip. The effect popover holds the strength, not the color, for this reason.
* **Focus while typing.** Every new chip in Text's bar goes through `BarChip`, which passes `restoreFocus`, and the bar's `keepFocus` already covers presses. Check it in step 6, not at the end.
