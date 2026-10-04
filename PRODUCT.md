# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

iOS, Android, and web count equally. Tuck has one identity across all three, and each platform keeps its own conventions where they differ (navigation, sheets, haptics, the system share sheet, keyboard shortcuts and hover on web). Both color palettes ship, and the app picks one at launch from the system setting.

## Users

Anyone with a phone who needs to finish a photo or screenshot quickly, in the moment before sending it: a caption, a meme, a sticker, or hiding a name, an address, a face, or a license plate. No narrower core audience. Memes, captions, and redaction count equally. People reach for it mid-conversation, so they won't learn it, set it up, or read about it first.

## Product Purpose

Tuck is a fast, free, local-first photo editor for the last touch before sharing: open a photo, make the edit, save or share. It isn't a Canva replacement or a design suite. It works like a utility, and the image matters more than the tools. A session succeeds when the common edit takes seconds and the result goes straight to Photos or the share sheet.

## Positioning

A private, fast finishing tool for photos and screenshots, not a general photo editor. Every edit, including face, text, and subject detection, runs on the device (Apple Vision, ML Kit, and MediaPipe/Tesseract in the browser). There's no account, no upload, no AI credits, no subscription, and no watermark. Detection only proposes redactions, and the user picks which ones to add.

Tagline in use: "The last touch for photos and screenshots." Alternative: "Make it ready to share."

## Operating Context

- Photos come from the library picker, from Create (an empty canvas at a preset size), or from another app's share sheet ("Edit in Tuck" on iOS and Android).
- Each session autosaves as a local project. Home lists projects as thumbnails to reopen, rename, duplicate, or delete. Projects are a secondary path and never get in the way of opening a photo.
- In the editor, the document is a canvas plus layers (photos, text, redactions, drawings, shapes, stickers). Edits are non-destructive and every one can be undone.
- Export saves to Photos or opens the native share sheet, as JPEG, or as PNG when the canvas has transparency. Smaller sizes are available.
- On web, Tuck is a static export hosted on Vercel, with keyboard shortcuts, trackpad zoom, and hover.

## Capabilities and Constraints

- Tools: text edited in place on the canvas (fonts, colors, an eyedropper, alignment, outline, background box); Redact (box or brush, as solid, blur, or pixelate, with Find for faces and text); Crop (aspect presets, turns, flips, straightening, and expanding the canvas); Adjust (brightness, contrast, saturation, warmth); Draw (pen, marker, neon, eraser, and shapes); Cut out (background removal as a reversible mask); stickers (bundled emoji and the user's own); adding photos as layers; a layers panel; undo and redo.
- Each tool remembers its settings between sessions.
- Built with Expo and React Native. Skia draws the canvas and the export alike. Native code only for detection and the share target. Runs in a development build, not Expo Go.
- No backend, accounts, cloud storage, remote processing, or AI APIs. Not planned: generative fill, prompt editing, face recognition, template galleries, feeds, or "AI Studio"-style surfaces.
- Not built yet: highlights, shadows, exposure, vignette, and sharpen; saving a cut-out as a sticker; PDF redaction (researched, deferred).
- Undecided: the final name (see Brand Commitments) and any public release.

## Brand Commitments

- Name: **Tuck**, a working name that may change before release. Internal IDs (`photo-editor` slug, scheme, package, and the web IndexedDB database name) stay as they are.
- Voice: plain, short, and confident, with no hype. The home tagline sets the tone: "The last touch for photos and screenshots. No account, no waiting." Tool names are verbs or plain nouns (Text, Redact, Crop, Adjust, Draw, Cut out).
- Assets: wordmark, app icon (`assets/icon.svg`, `assets/adaptive-icon.svg`, `assets/favicon.svg`), bundled caption fonts, and Noto Emoji stickers (Apache 2.0).
- The current visual identity, the "light table", is recorded in `docs/light-table-plan.md`.

## Evidence on Hand

- The working app on iOS, Android, and web, verified on a real iPhone for the core flow, plus the plans in `docs/` and the staged roadmap in `VISION.md`.
- Absent, and not to be invented: users, reviews, testimonials, download counts, an App Store or Play listing, pricing, press, or performance claims.

## Product Principles

1. **Seconds, not sessions.** Opening a photo leads straight to editing. No onboarding, templates, accounts, or extra dialogs on the common path.
2. **The photo stays private.** Everything runs on the device. A feature that needs the cloud doesn't ship.
3. **Nothing is final until export.** Edits are layers over the untouched original, so any of them can be undone, moved, or changed later.
4. **A utility, not a studio.** Show a tool only when it's useful, keep the image the focus, and leave out anything that turns Tuck into a content platform.
5. **One product on every platform.** iOS, Android, and web get the same capabilities and identity, each with the conventions its users expect.
