# Export sheet

A plan for the export sheet, written October 2026 after a critique of the whole app (snapshot in `.impeccable/critique/`). It's the second of five plans from that critique, after `redaction-trust-plan.md`. Export is where the edit leaves the device, and today the sheet covers the result it's about to send.

## What happens today

Checked on web at 390 and 1440 points wide, by day and at night.

* **You can't see what you're exporting.** The sheet (`ExportScreen.tsx`) covers the lower half of the photo on a phone. On a redacted group photo, the bottom rows of faces sit under it, so a missed face can't be checked here either.
* **The rendered image is already there.** `useRenderedDocument` renders the document at the chosen size before any button works. Nothing shows it.
* **Unchosen options look disabled.** `ui/Segmented.tsx` draws an unchosen option's title in `textSecondary`, so "Small" and "PNG" (and Settings' "Light" and "Dark") read as greyed out. DESIGN.md's No Gray Label rule says a control's label is ink. The October 4 critique noted this and left it, since export was outside the editor.
* **"Small" can be barely smaller.** `exportSizes` offers each preset (2048, 1080) smaller than full size, however close. A 1280-wide photo gets "Small 1080 × 781" beside "Full size 1280 × 926".
* **The Export button's name starts with an icon.** `ui/Button.tsx` sets no `accessibilityLabel`, so on web the button's name is its text content, which begins with the Ionicons glyph (a private-use character). This holds for every `Button` with an icon, not just Export. `IconButton` already sets one.
* **The editor stays readable behind the sheet.** Export is a `transparentModal` over the mounted editor, and on web nothing hides the editor from assistive technology or the Tab key while the sheet is up. The detector saw the dock's labels as live text under the sheet's buttons.

## Decisions

* **A preview at the top of the sheet.** The rendered image, fitted into a strip about 180 points tall on a phone (220 on a wide window), centered on the light table color with the print's contact shadow, so it reads as the thing being sent. While it renders, the strip shows the spinner and "Preparing the image…" (which move up from the status row), and a failed render shows its Try Again there. When the format is JPEG and the document has transparency, the preview sits on black, since that's what the file will have. A tap on the preview does nothing; it's for looking.
* **The sheet can get taller to fit it.** It's capped at 90% of the window today, and stays so. On a short phone the preview strip gives way first (down to 120 points), before the options do.
* **Download (Save) stays the main button.** Making Share primary came up in the critique, and it isn't part of this round.
* **No done state for Share.** The critique suggested one like Save's and Copy's, but the share sheet doesn't say whether anything was sent: `expo-sharing` resolves when the sheet closes either way, and the web's `navigator.share` only rejects on a cancel some browsers report and others don't. A "Shared" that might be wrong is worse than none.
* **Ink labels in `Segmented`.** Unchosen titles in `textPrimary`, details stay `textSecondary` (metadata, not a label).
* **A smaller size has to be meaningfully smaller.** A preset is offered only at three quarters of full size or less, so "Small" always means something.
* **Buttons are named by their label.** `Button` sets `accessibilityLabel={label}`, as `IconButton` does. A caller that passes its own label keeps it.
* **The sheet is modal for assistive technology.** On web, the editor's root gets `inert` (which also takes it out of the Tab order) while it isn't focused; on iOS, the sheet's container sets `accessibilityViewIsModal`; Android's TalkBack follows the modal screen already, but check it.

## Steps

Each step passes `npm run check` and `npm run typecheck` (and `npm test` where it touches pure modules), and ends with a commit message handed over. Check on web at 390 and 1440 points wide, by day and at night, and on the iOS simulator.

### 1. Ink labels, and Buttons named by their label

* `ui/Segmented.tsx`: `title` in `colors.textPrimary`.
* `ui/Button.tsx`: `accessibilityLabel={label}` on the pressable.
* Home's About links (`aboutLinkLabel` in `HomeScreen.tsx`) are controls too: ink, with their hover tint kept. Home's tagline and hint stay secondary, as text rather than controls.

Check Export, Settings, and home in both palettes. On web, read the accessibility tree (`read_page`) to confirm Export reads "Export" and Share reads "Share".

Commit: `fix: draw unchosen options and home's links in ink`

### 2. Only meaningfully smaller sizes

* `exportSizes.ts`: a preset's scale must be at most `0.75 ×` full. Keep the rule's reason in the comment by `PRESETS`.
* `__tests__/exportSizes.test.ts`: a 1280-wide document gets only full size; a 1500-wide one gets full and 1080; a 4000-wide one gets full, 2048, and 1080.

Check the sheet with a small photo (one size, so the Size row hides) and a camera photo (three).

Commit: `fix: offer a smaller export only when it's much smaller`

### 3. A preview of the export

* `ExportPreview` in `ExportScreen.tsx` (it's single-use, so it stays in the screen's file): a Skia `Canvas` with `colorSpace="srgb"` (AGENTS.md: a canvas that previews the document must, or iOS draws it in P3), drawing `state.image` fitted and centered. The image is owned by `useRenderedDocument`, which disposes of it on the next render, so the preview must not keep it past a render: draw it straight from `state`, and check that changing size quickly doesn't throw "Cannot pass deleted object" on web.
* The render's status moves into the strip. The status row under the options goes.
* The strip's height: 180 points on a phone, 220 from 1024 wide, and on a window too short for the sheet's content at 90%, shrinking to 120 before anything else does.
* Transparent document with JPEG chosen: the strip's fill is black.

Check: a photo, a redacted photo (the preview must show every box, effects included: blur and pixelate render through `drawAsImage`, the same path as the file), a transparent canvas in JPEG and PNG, a very wide and a very tall document, changing size and format quickly, and a render failure (throw from `renderDocument` locally, then revert). On the iOS simulator, compare a neutral gray in the preview with the editor's, which should match now that both are sRGB.

As built, the preview isn't a Skia canvas. Each render also makes a small copy of itself (at most 1400 × 700 pixels) as a PNG data URL, and the strip shows that with React Native's `Image`, so nothing that's drawn holds the render's `SkImage`. Drawing the render itself in a canvas threw "Cannot pass deleted object" on web after quick size changes, however long its disposal waited for Skia's frames, and a canvas costs a WebGL context. Renders run one at a time, the newest waiting for the one running, and the last preview stays up, under "Preparing the image…", while the next renders. On web, every `drawAsImage` made a WebGL context of its own that lasted until garbage collection, and a few quick size changes lost the oldest (the editor's canvas, or a reopened sheet's): `render/drawOffscreen` draws into one shared surface on web instead, and Skia's `drawAsImage` elsewhere. The strip's height is worked out from the window (the sheet's cap less the header, the options, and the bottom inset), because shrinking the sheet's content to fit fought its entering slide on web. On iOS, a flat gray in the preview matched the editor's (251 against 251).

Commit: `feat: preview the image in the export sheet`

### 4. Modal for screen readers

* `EditorScreen`: on web, set `inert` on its root view while `useIsFocused()` is false. React Native's types don't have it, so it goes through a web-only branch with a cast, as AGENTS.md describes for other web-only props.
* `ExportScreen`'s container: `accessibilityViewIsModal`.
* The editor's shortcuts already stop while it's unfocused; nothing to change there.

Check on web that Tab from the sheet's last button comes back to its first (or the browser's chrome), never the editor, and that the accessibility tree under the sheet holds only the sheet. With VoiceOver on the iOS simulator, swipe through the sheet and check it never reaches the editor. On Android, the same with TalkBack if an emulator is available.

Commit: `fix: hide the editor from screen readers behind the export sheet`

### 5. Docs

* DESIGN.md's Sheets: the export sheet's preview strip.
* AGENTS.md, if step 3 or 4 taught anything that isn't there (the preview's image lifetime, `inert` on web).

Commit: `docs: describe the export preview`

## Risks

* **Memory on a phone.** The preview draws the full-size rendered image scaled down; it's already in memory for export, so the preview adds no copy. If a large photo's render is slow, the strip shows the spinner for longer, which is honest.
* **A smaller preview hides a small miss.** At 180 points tall, a tiny uncovered face can still slip by. The preview is a check, not a guarantee. A pinch-to-zoom preview could follow if people ask for it.
* **`inert` support.** Every browser Tuck targets supports it, but React Native Web may not pass the attribute through; if it doesn't, set it on the DOM node from a ref.
