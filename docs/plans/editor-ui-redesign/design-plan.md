# Editor UI/UX Redesign — Design Plan

Written October 30, 2026, from the [UI/UX Audit & Brainstorm](../../brainstorm/ui-ux-audit-and-brainstorm.md), interactive visual mockups, and rigorous design system audit. This document establishes the complete visual, spatial, ergonomic, and interaction specifications for refining Tuck's surfaces, tooling ergonomics, and commit semantics across phone, tablet, and desktop viewports.

Technical implementation details (store slices, component decomposition, worklets, tests) are intentionally excluded and will be handled in a separate implementation plan.

---

## 1. Principles & Creative North Star

Every design decision in this plan directly serves Tuck's core foundations:
- **"Print, Ink & Highlighter" ([DESIGN.md](../../DESIGN.md)):** The photo is a print resting on a pale light table. Chrome is crisp white paper, controls are black ink, and the only color of the app's own is highlighter yellow (`#FFE433`) meaning *"chosen"*.
- **"Seconds, not sessions" ([PRODUCT.md](../../PRODUCT.md)):** Tuck is a fast, decisive utility for finishing photos and screenshots before sharing. Edits take seconds with one hand. Tools must never hide core workflows behind unnecessary tabs, disorienting surface splits, or multi-tap journeys.
- **"Nothing is final until export" ([PRODUCT.md](../../PRODUCT.md)):** The user must always have total confidence in what will be saved, what can be undone, and what a commit action (`Keep only` / `✓`) will do.
- **Strict Compliance with Design Rules:**
  - *The One Marker Rule:* Yellow is reserved strictly for chosen states via `<Highlight />`. Never use yellow on buttons, glyphs, badges, or decoration.
  - *The Off-Limits Photo Rule:* The chrome never tints, frosts, or overlaps the photo with translucent glass. Panels are opaque paper with a hairline edge and a floating shadow.
  - *The No Gray Label Rule:* Interactive control labels are ink (`colors.ink` / `graphite-ink`). Gray is reserved for metadata and disabled items only.

---

## 2. Executive Summary of Changes

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SUMMARY OF DESIGN CHANGES                               │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ Area                          │ Core Design Resolution                                 │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. Surface Architecture &     │ Static top header at all times on wide screens;        │
│    Breakpoints                │ Unified Floating Bottom Tool Card across all tools;    │
│                               │ Medium (900–1023pt) keeps stage-centered Phone Dock.   │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 2. Cut Tool & Commit          │ Explicit "Keep only" white-on-ink commit button;       │
│    Semantics (Issue #15)      │ Stable 6-button dock; opaque paper floating pill for   │
│                               │ Tap modifiers; re-editing support for existing cuts.   │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3. Direct Layer Styling       │ 1-tap direct restyling for selected Shapes & Redaction;│
│                               │ 3-step discrete strength scale; clean Deselect button. │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 4. Draw Tool on Phone         │ First-class Pen & Highlighter in dock; active-tool     │
│                               │ chevrons (▾); composite Style button with tip size dot.│
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 5. Text Tool on Phone         │ 1-tap cycling Align (≡); inline dock color swap with   │
│                               │ Eyedropper, Hue & Tone bars, preserving canvas height. │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 6. Crop Tool (Wide)           │ Flattened Crop card (no tab switching); 2-row layout   │
│                               │ housing straighten dial when photo exists; full stage. │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 7. Desktop Polish & QoL       │ Visible [?] shortcuts button; localized Tool Reset;   │
│                               │ Pinned Layers toggle during live tools (frozen draft). │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Surface & Breakpoint Architecture

Tuck adapts across three distinct responsive breakpoints defined in `editorFrame.ts`:
- **Phone / Narrow (`< 900pt`)**: Bottom `Dock` (`100pt` content + `44pt` footer), contextual `Tray` above the dock, and sheets (`Stickers`, `Export`).
- **Medium (`900pt – 1023pt`)**: Keeps the bottom `Dock` (`100pt + 44pt`) and contextual `Tray`, but moves `Layers` from a modal sheet to a floating right-hand sidebar (`340pt`).
- **Wide (`≥ 1024pt`)**: Moves the primary tool palette into a left `EditorRail` (`70pt` fine pointer / `84pt` coarse pointer), keeps the top `EditorHeader` static, and houses all active tool controls in a **Unified Floating Bottom Tool Card**.

### 3.1 Medium Breakpoint Specification (`900pt – 1023pt`)
To maintain consistency and avoid cramped wide-rail layouts on smaller tablets:
- The top header displays the project title and standard actions (`Undo`, `Redo`, `Export`).
- The right-hand Layers sidebar (`340pt`) floats beside the canvas.
- The active tool renders inside the **Phone Bottom Dock** (`100pt` content + `44pt` footer) and contextual `Tray` above it.
- **Stage centering:** The dock (`maxWidth: 520pt`) is horizontally centered within the **remaining canvas stage** (the viewport width minus the `340pt` sidebar), ensuring it never collides with or overlaps the sidebar.
- Commit actions (`✕ Cancel`, `Keep only`, `✓ Done`) remain in the `44pt` Dock footer.

---

### 3.2 Wide Viewport Specification (`≥ 1024pt`): The Unified Floating Bottom Tool Card

#### Problem Solved
Currently, wide screens split tool controls between the top `ContextBar` and bottom canvas cards (`ToolCard` / `CropControls`). In `Adjust`, the `ContextBar` is completely empty except for `✕`/`✓`, forcing 600px of vertical eye travel between the dial and commit buttons. In `Find`, redaction styles sit at the top while results sit at the bottom. Furthermore, clicking `✓` in the header replaces the bar with the project title, causing subsequent tool clicks in the left rail to be lost ([Issue #19](https://github.com/nverkhachoyan/tuck/issues/19)).

#### Static Header
On wide viewports (`≥ 1024pt`), **the top `EditorHeader` remains completely static at all times**:
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Back]   Project Title · Saved on this device             [Layers] [↶] [↷] [?] [Export]│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
- The header **never** swaps its contents for tool options or `✕`/`✓`.
- Global actions (`Layers`, `Undo`, `Redo`, `? Shortcuts`, `Export`) remain permanently anchored.
- This permanently eliminates Issue #19, as the rail and header never re-layout upon tool exit.

#### Unified Floating Bottom Card
All active tool controls, mode segments, chips, dials, steppers, and session commit actions (`Reset`, `✕ Cancel`, `Keep only`, `✓ Done`) live inside a single **Unified Floating Bottom Tool Card** centered beneath the photo on the light table:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Photo Print on Light Table                       │
│                                                                         │
│        ┌───────────────────────────────────────────────────────┐        │
│        │  [Tool Controls / Chips / Dial]   ·   [Reset] [✕] [✓] │        │
│        └───────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Visual Specification & Dimensions
- **Material:** Opaque paper (`#FFFFFF` by day, `graphite-surface` `#202125` at night). Never translucent or frosted.
- **Border:** 1pt `hairline-strong` (`#C8CACF` by day, `#2E3035` at night).
- **Corners:** `radii.large` (`20px`).
- **Elevation:** `shadow-floating` (`0 10px 28px rgba(0,0,0,0.16)`).
- **Horizontal Positioning:** Horizontally centered in the canvas stage between the Left Rail and the Right Inspector (`maxWidth: 560pt`).
- **Vertical Positioning & Safe Area:** Floating above the stage bottom:
  ```
  bottom: max(16pt, insets.bottom + 8pt)
  ```
  This ensures that on iPad (with a `34pt` home indicator), the card sits safely at `42pt` above the screen edge, completely preventing home indicator gesture collisions.
- **Pointer & Touch Density:**
  - **Desktop Fine Pointer (mouse / trackpad):** Single-row card height is `48pt` (control height `36pt`, vertical padding `6pt`).
  - **iPad Coarse Pointer (touch):** Single-row card height is `56pt` (control height `44pt`, vertical padding `6pt`), preserving generous touch targets.
- **Pointer Events & Gesture Isolation:**
  - The card sets `pointerEvents: "auto"`. Taps, drags, and clicks inside the card never propagate to the canvas beneath.
  - Sideways drag on the photo canvas (`useDialDrag` in `Adjust`) continues to turn the dial when dragging outside the card's bounding box.
  - When zooming or panning, the canvas photo can pass cleanly behind the floating card.
- **Stage Inset:**
  - The stage insets its initial fit by the active card's exact measured height (`cardHeight + 16pt`) rather than a constant `172pt`, restoring vertical space to the photo preview.
- **Popover Placement:**
  - Any chip or button in the bottom card opening a popover (`SizeChip`, `ColorChip`, `AspectMenu`, `BrushEdges`) opens with `placement="above"`, anchored to the top of the card pointing toward the canvas.

---

### 3.3 Bottom Card Layout Across All Tools on Wide Screens

| Tool / Mode | Card Layout | Height (Fine / Coarse) | Contents |
| :--- | :--- | :--- | :--- |
| **Draw** | Single Row | `48pt` / `56pt` | Tool segments (`Pen`, `Highlighter`, `Shape`, `Eraser`) \| Options Chip (`Tip` or `Shape kind`) \| `ColorChip` \| `SizeChip` \| Divider \| `[✕ Cancel]` `[Done ✓]` |
| **Redact** | Single Row | `48pt` / `56pt` | Sub-tools (`Box`, `Brush`, `Eraser`) \| `EffectChip` (`Solid/Blur/Pixelate`) \| `ColorChip` or `StrengthChip` \| `SizeChip` \| Divider \| `[✕ Cancel]` `[Done ✓]` |
| **Adjust** | Two Rows | `88pt` / `96pt` | **Row 1:** 4 Adjustment chips (`Brightness`, `Contrast`, `Saturation`, `Warmth`) \| Divider \| `[Reset]` `[✕ Cancel]` `[Done ✓]`.<br>**Row 2:** Centered `StraightenDial` with tick marks and numeric readout. |
| **Find** | Two Rows | `132pt` / `144pt` | **Row 1:** Scopes (`Faces`, `Text`, `Both`) \| Redaction Style chip (`Solid/Blur/Pixelate` + color).<br>**Row 2:** Status readout, `[All]` `[None]` `[Review]` steppers \| Divider \| `[✕ Cancel]` `[✓ Redact N]`. |
| **Crop** | Dynamic (1 or 2 Rows) | `48pt` (no photo) / `88pt` (with photo) | **Row 1:** `[Aspect: Free ▾]` \| `[Rotate 90°]` `[Flip ⇆]` `[☑ Turn layers]` \| `[■ Fill ▾]` \| Divider \| `[Reset]` `[✕ Cancel]` `[✓ Done]`.<br>**Row 2 (when photo exists):** Centered `StraightenDial` for fine rotation. |
| **Cut** | Two Rows | `84pt` / `94pt` | **Row 1:** Selection tools (`[Subjects]` `[Tap]` `[Add]` `[Subtract]` `[Invert]`).<br>**Row 2:** Contextual actions (`[Actions ▾]` menu, spacer, `[Reset]`, `[✕ Cancel]`, `[Keep only ✓]`). |
| **Text** (Typing) | Single Row | `48pt` / `56pt` | Font chip \| 1-tap `[≡ Align]` button \| `ColorChip` \| `OutlineChip` \| `BoxChip` \| Divider \| `[✕ Cancel]` `[Done ✓]`. (Card enforces `keepFocus` to preserve hidden input focus). |
| **Stickers** | No Card | N/A | Stickers opens as a popover beside the Left Rail's sticker button. No bottom card is displayed. |
| **Blank Canvas** | Tool Specific | Same as above | For tools operating on a blank canvas (Draw, Text, Stickers), the card functions identically. In Crop, the dial row is omitted since no photo is present to level. |

---

## 4. Cut Tool: Commit Semantics & Control Ergonomics

### 4.1 Fixing the `✓` Commit Paradox
In `Draw`, `Redact`, `Crop`, `Text`, and `Adjust`, `✓` commits the edit and `✕` reverts. In `Cut`, `done` previously invoked `cancelSession`, causing `✓` to silently discard the user's selection.

#### Primary Commit Action Specification
The commit action in Cut's footer (phone) and bottom card (wide) adapts based on whether an active selection exists:
1. **When no selection exists (`selected === undefined`):**
   - The right side shows no commit action; the left displays `✕ Cancel` only.
2. **When an active selection exists (`selected !== undefined`):**
   - The primary action is a prominent, solid-ink button (`button-primary`: black background `#000000`, white text, 12px corners):
     ```
     [ Keep only  ✓ ]
     ```
   - **Compliance with *The One Marker Rule*:** The checkmark glyph and the label are both drawn in **pure white ink (`#FFFFFF`)**. Highlighter yellow is not used.
   - Tapping **`Keep only`** immediately clips the image to the selected subject/object as a reversible cut mask (`keepOnly`), commits the session as one clean undo step, and presents the toast: `"Subject cut out · Undo · Refine"`.
   - Directly adjacent to `Keep only`, a secondary paper button labeled **`More ▾`** (or `Actions ▾`) opens the popover/tray with alternate outcomes:
     - `New layer`: copies the selection to a new image layer above the photo, leaving the base photo intact.
     - `Remove`: subtracts the selection from the photo, leaving transparency.
     - `Redact`: places a mask-shaped redaction over the selection.
     - `Save sticker`: saves the cutout to the user's personal sticker collection.
3. **`✕ Cancel`** remains on the left, reverting the working selection without modifying the photo.

#### Re-Editing Existing Cutouts vs. Uncut Photos
When a user opens Cut on an image that *already* has a cut mask (e.g. refined after `Remove BG` or edited from a prior session):
- **Initial Selection:** The existing cut mask automatically loads as the active selection (`selected !== undefined`).
- **Primary Button Label:** Displays **`Keep only ✓`** (or `Update cut ✓`), seamlessly updating the existing cut mask.
- **Reverting to Original Photo:** If the user wishes to restore the cut-away background, the `Reset` button reverts the selection to the original uncut photo, and `Actions ▾` includes `Restore full photo`.
- **Toast Feedback:** On commit, the toast announces: `"Cutout updated · Undo · Refine"`.

---

### 4.2 De-Cluttering Cut's Controls (Issue #15)
To eliminate horizontal scrolling and control sprawl:

#### 1. Stable 6-Item Main Tool Row
On phones and in the wide card's top row, the primary selection tools are fixed to 6 items:
```
[ Subjects ]   [ Tap ]   [ Add ]   [ Subtract ]   [ Invert ]   [ Actions ▾ ]
```
- Fits any phone screen down to 375pt without scrolling or truncation.
- Never shifts or re-layouts when an object is selected.

#### 2. Floating Contextual Modifier Pill for `Tap`
When `tool === "tap"`, sub-tool modifiers mount in a floating pill positioned `8pt` directly above the dock (phone) or bottom card (wide):
```
┌─────────────────────────────────────────────────────────┐
│   [ + Adds | − Subtracts ]    │    [ − Smaller | + Larger ]   │
└─────────────────────────────────────────────────────────┘
```
- **Material Specification (*The Off-Limits Photo Rule*):** Built from **opaque white paper** (`#FFFFFF` day, `graphite-surface` `#202125` night) with a 1pt `hairline-strong` border, `radii.pill` (17px), and `shadow-floating`. Never translucent or frosted.
- Sizing steps (`Smaller` / `Larger`) appear in this pill only after a tap has selected an object.
- Tap mode (`Adds` vs `Subtracts`) is toggled here without disrupting the dock row.

---

## 5. Direct Layer Selection & Restyling

### 5.1 Shape and Redaction Direct Styling
Currently, tapping an existing `TextLayer` immediately surfaces `TextStylePanel` / `TextBar`, allowing 1-tap changes to font, color, outline, and background box. However, selecting a `ShapeLayer` or `RedactionLayer` displays an empty dock with only a lonely `[Draw]` or `[Redact]` button.

#### For a Selected Shape (`rectangle`, `ellipse`, `line`, `arrow`):
The Dock (phone) or Bottom Card (wide) immediately displays the **Shape Style Panel**:
- **Row 1 (Shape Types & Stroke Width):**
  - Shape selector segments: `[ Rectangle ]` `[ Ellipse ]` `[ Line ]` `[ Arrow ]` (the active kind is highlighted with the signature highlighter swipe).
  - Divider rule.
  - Stroke width choices: 3 size dots (`thin: 2.5pt`, `medium: 5pt`, `thick: 8pt`).
- **Row 2 (1-Tap Color Swatches):**
  - Instant document swatches: `Paper (White)`, `Ink (Black)`, `Red`, `Yellow`, `Green`, `Blue`, plus `Custom Rainbow`.
  - The active color is encircled by the 2pt ink `RingChoice`.
- **Result:** Tapping an arrow on the canvas and changing its color to yellow takes **1 tap**, with live feedback on the light table.

#### For a Selected Redaction (`box` or `strokes`):
The Dock (phone) or Bottom Card (wide) immediately displays the **Redaction Style Panel**:
- **Effect Segments:** `[ Solid ]` `[ Blur ]` `[ Pixelate ]` (chosen state highlighted).
- **When `Solid`:** Instant color swatches (`Black`, `White`, `Red`, etc.) with `RingChoice`.
- **When `Blur` or `Pixelate`:** The 3 discrete strength icons from Tuck's design system (`StrengthDot` for blur: `low`, `medium`, `high`; `PixelSquare` for pixelate: `small`, `medium`, `large`).
- **Result:** Switching a redaction box from blur to black ink takes **1 tap**.

### 5.2 Clean Deselect Semantics
When any layer is selected in idle mode:
- The footer (phone) / bottom card (wide) replaces the misleading `✓` with a text button labeled **`Deselect`** (or `✕`).
- **Compliance with *The No Gray Label Rule*:** The label is rendered in body-size ink (`colors.ink` by day, `graphite-ink` at night), darkening one step on press.
- Tapping anywhere off the layer on the canvas or pressing `Escape` continues to deselect naturally.

### 5.3 Filtered Actions for Stickers
- Image layers with `sticker: true` filter out camera photo tools (`Find`, `Cut`, `Remove BG`).
- Their canvas `SelectionBar` offers: `[Duplicate]`, `[Delete]`, `[Arrange ▸]`.
- Their Dock / Bottom Card offers: `[Adjust]` (for tuning sticker contrast/brightness) and `Deselect`.

---

## 6. Draw Tool Phone Ergonomics: First-Class Ink & Highlighter

Tuck's signature identity is *"marked up in ink and highlighter."* In the current phone dock, switching between Pen and Highlighter is buried behind the `Style` tray.

### Specification
1. **First-Class Pen & Highlighter Buttons:**
   The phone dock in `Draw` displays 5 primary buttons:
   ```
   [ Pen ▾ ]   [ Highlighter ▾ ]   [ Shape ▾ ]   [ Eraser ]   [ Style ]
   ```
   - **`Pen`**: Selects the last-used opaque pen (`pen`, `marker`, or `neon`).
   - **`Highlighter`**: Instantly activates the yellow highlighter with multiply blending.
   - Switching between writing text notes in black ink and highlighting text in yellow is now a **single tap**.
2. **Sub-Tool Chevrons (`▾`):**
   - The active sub-tool button (`Pen`, `Highlighter`, `Shape`) renders a subtle `▾` chevron beside its label.
   - This explicitly signals that tapping the selected tool toggles its configuration tray.
3. **Combined Color + Tip Size on `Style` Button:**
   - The `Style` tile replaces its plain 22×22 color square with a composite badge: the brush's current color fill with a centered dot sized to the active tip width (`thin`, `medium`, `thick`).
   - The user sees both their color and their stroke weight at a glance without opening the tray.

---

## 7. Text Tool Phone Keyboard Stack & 1-Tap Align

### Problem Solved
On phones, when typing text with the virtual keyboard active:
- `TextStylePanel` has 5 tabs (`Font`, `Color`, `Outline`, `Box`, `Align`).
- Tapping custom color opens `TextColorPicker` *above* the dock (+160pt tall), obscuring the text on the canvas above the 260pt keyboard.
- `Align` occupies an entire tab just to pick Left, Center, or Right.

### Specification
1. **1-Tap Cycling Align Button:**
   - The `Align` tab is removed from the tab strip.
   - An alignment icon button is placed at the right end of the font row / tab header.
   - Tapping it cycles through **Left (`≡`) → Center (`≡`) → Right (`≡`)**, updating the layer's alignment immediately in **1 tap** (down from 2 taps).
2. **Inline Dock Custom Color Swap:**
   - When the user taps the rainbow custom color swatch, rather than popping a large tray *above* the dock that hides the photo, **the 100pt dock content itself temporarily transitions to the color picker**:
     ```
     ┌─────────────────────────────────────────────────────────────┐
     │  [← Back to Tabs]     [⌖ Eyedropper]      #E11D48 (Hex)    │
     │  [════════════ Hue Gradient Slider (0–360°) ════════════]  │
     │  [════════ Tone Slider (White → Pure Hue → Black) ═══════]  │
     └─────────────────────────────────────────────────────────────┘
     ```
   - **Eyedropper:** Positioned cleanly in the center of the header row, allowing direct color sampling from the photo.
   - **Color Geometry:** Utilizes a full Hue slider (0–360°) paired with a tone shade slider (white tint through pure hue to black shade), providing complete HSV gamut access in a compact 100pt height.
   - **Hex Readout:** Static caption text (`#E11D48`), preventing keyboard focus competition.
   - **Canvas Visibility:** The dock height never expands upward; the photo canvas above the keyboard retains full vertical visibility.
   - Tapping `← Back to Tabs` smoothly returns to the standard font and swatch row.

---

## 8. Crop Tool Wide Flattening & Dynamic Stage Height

### Problem Solved
On wide screens:
- `CropBar` forces the user to switch between 3 tabs (`Crop`, `Rotate`, `Fill`) to access a total of just 4 buttons.
- `CropControls` reserves a `100pt` empty gray well along the bottom of the canvas even when no straighten dial is displayed.

### Specification
1. **Flattened Unified Bottom Card for Crop:**
   On wide screens, the top header remains static. The Crop tool uses the Unified Bottom Card with all options accessible without tab switching:
   - **Row 1:**
     - **Aspect Presets:** `[Aspect: Free ▾]` chip plus quick-pills (`1:1`, `4:5`, `16:9`).
     - Divider.
     - **Transformations:** `[Rotate 90°]`, `[Flip ⇆]`, `[☑ Turn layers with photo]`.
     - Divider.
     - **Canvas Fill:** `[■ Fill: White ▾]`.
     - Divider.
     - **Session Actions:** `[Reset]`, `[✕ Cancel]`, `[✓ Done]`.
   - **Row 2 (when `anchor.layer` exists):**
     - Centered `StraightenDial` for degree-by-degree leveling.
2. **Dynamic Stage Height:**
   - When no photo layer is present (blank canvas crop), Row 2 is omitted and the card is a single `48pt` row.
   - The stage insets only by the exact card height, eliminating the permanent `100pt` empty gray well.
   - The crop framing box's lower drag handle is clamped so it never gets obscured behind the bottom card.

---

## 9. Desktop Polish & Discoverability

### 9.1 Pinned Layers Inspector During Live Tools
- In `EditorHeader`, the `[Layers]` button remains active and accessible on wide screens under `960pt` tall during **live tools** (`Draw`, `Redact`, `Adjust`, `Find`). Laptop users can inspect, reorder, or delete marks while actively working.
- **Draft Session Protection (`takesKeys`):** During **draft tools** (`Crop` and active `Text` typing), the `[Layers]` button **remains disabled**, strictly preserving layer tree and undo-history integrity while a draft framing is active.

### 9.2 Visible Keyboard Shortcuts Button (`?`)
- Add a subtle `?` icon button in the `EditorRail` footer (and in `EditorHeader` next to Undo/Redo) with tooltip: `"Keyboard shortcuts · ?"`.
- Mouse and trackpad users can discover and open the shortcuts overlay without needing to know that pressing `?` on the keyboard opens it.

### 9.3 Localized Tool `Reset` Button
- In `Adjust`, `Crop`, and `Cut`, the `Reset` action is moved out of global `HeaderActions` (where it was previously grouped with document Undo/Export) into the active tool's bottom card / footer, sitting adjacent to `✕ Cancel` and `✓ Done`.
- Tool resets are grouped strictly with the tool controls they affect.

### 9.4 Keyboard Shortcuts & Focus Retention
- **`keepFocus` Enforcement:** The Unified Bottom Card implements `keepFocus` (`e.preventDefault()` on mousedown on web) across all its chips, swatches, and buttons, ensuring that clicks in font or color controls never blur the canvas hidden text input.
- **Key Mappings:**
  - `Escape`: Reverts session via `✕ Cancel`.
  - `Enter`: Commits session via `✓ Done` / `Keep only` (in `Text`, `⌘+Enter` or `Ctrl+Enter` commits; plain `Enter` inserts newline).
  - `[` and `]`: Steps brush size down/up; the bottom card's tip size chip immediately reflects the updated dot size.

---

## 10. Design Consistency & Verification Checklist

- [ ] **The One Marker Rule:** Yellow (`#FFE433`) appears exclusively via `<Highlight />` behind chosen options. No yellow buttons, badges, or checkmarks.
- [ ] **The Off-Limits Photo Rule:** All cards, floating pills, docks, and sheets are opaque paper (`#FFFFFF` / `graphite-surface`). No frosted or translucent glass over the photo.
- [ ] **The No Gray Label Rule:** All interactive labels are drawn in black ink (`#000000` / `graphite-ink`).
- [ ] **Dual Palette Parity:** Every surface, chip, border, and readout is defined and verified for both Day (Light Table) and Night (Graphite) palettes.
- [ ] **Safe-Area Geometry:** All bottom floating cards adhere to `bottom: max(16pt, insets.bottom + 8pt)`, avoiding iPad home indicator collisions.
- [ ] **Touch & Pointer Density:** Controls scale appropriately between fine pointer (`36pt` controls / `48pt` card) and coarse touch (`44pt` controls / `56pt` card).
- [ ] **Motion & Transitions:** Popovers ease over `160ms` (`cubic-bezier(0.2, 0, 0, 1)`); all animations respect `prefers-reduced-motion`.
