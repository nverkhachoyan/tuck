# Store listing

The text for the App Store and Google Play, in the voice of `PRODUCT.md`:
plain, short, and with no hype. Every claim here is something the app does
today; check this file when a feature changes. Screenshots are in
`docs/store-listing/screenshots/` (see the end of this file).

## App Store

**Name** (30): Tuck: Photo Markup

**Subtitle** (30): Blur, redact, caption, crop

**Promotional text** (170, can change without a new version):

> Hide a name, caption a meme, or circle what matters, then save or share.
> Every edit happens on your device: no account, no uploads, no watermark.

**Keywords** (100, comma-separated, no spaces; words already in the name and
subtitle are indexed anyway, so they're left out):

```
pixelate,censor,hide,meme,screenshot,annotate,sticker,draw,arrow,face,text,mosaic,emoji,private
```

**Description** (4,000):

```
Tuck is for the last touch before you send a photo or screenshot. Open it, make the edit, and save or share. It takes seconds.

HIDE WHAT YOU'D RATHER NOT SHARE
Cover a name, an address, a face, or a license plate with a solid box, a blur, or pixelation. Tap Find, and Tuck points out the faces and text in the picture. You choose which ones to hide.

CAPTIONS AND MEMES
Type right on the photo, in fonts made for captions, with an outline or a box behind the words so they read on anything.

MARK UP SCREENSHOTS
Draw with a pen, a marker, or a neon brush, or add arrows, lines, boxes, and circles to point out what matters.

AND THE REST
• Crop to a square, a story, or any size, and rotate, flip, or straighten
• Adjust brightness, contrast, saturation, and warmth
• Cut out the subject of a photo
• Add emoji stickers, or keep your own
• Start from a blank canvas sized for a post or a story
• Undo anything, and come back to a project later

PRIVATE BY DESIGN
Every edit, including finding faces and text, happens on your iPhone or iPad. Your photos are never uploaded. There's no account, no ads, no subscription, and no watermark.

OPEN FROM ANYWHERE
Choose Tuck in the share sheet of Photos, or any app, to open a picture straight in the editor. When you're done, save it to Photos or share it on.

Tuck also runs in your browser at tuck.tools.
```

**URLs**

- Support URL: https://www.tuck.tools/support
- Marketing URL: https://www.tuck.tools
- Privacy Policy URL: https://www.tuck.tools/privacy

**Other fields**

- Primary category: Photo & Video. Secondary: Utilities.
- Price: Free. No in-app purchases.
- Copyright: `2026 Nver Khachoyan` (or the company, if the team is one).
- Age rating: answer "None" throughout; expect 4+.
- App Privacy: Data Not Collected.

**Notes for App Review**

```
Tuck needs no account or sign-in, and every feature works offline.

To try it: tap Open a photo, or Blank canvas for an empty one. In the editor, Redact > Find looks for faces and text to hide, using Apple's Vision framework on the device.

Tuck also adds itself to the share sheet: share an image from Photos and choose Tuck to open it in the editor.
```

## Google Play

**App name** (30): Tuck: Photo Markup

**Short description** (80):

```
Blur, caption, and mark up photos and screenshots. Private, on your device.
```

**Full description** (4,000):

```
Tuck is for the last touch before you send a photo or screenshot. Open it, make the edit, and save or share. It takes seconds.

HIDE WHAT YOU'D RATHER NOT SHARE
Cover a name, an address, a face, or a license plate with a solid box, a blur, or pixelation. Tap Find, and Tuck points out the faces and text in the picture. You choose which ones to hide.

CAPTIONS AND MEMES
Type right on the photo, in fonts made for captions, with an outline or a box behind the words so they read on anything.

MARK UP SCREENSHOTS
Draw with a pen, a marker, or a neon brush, or add arrows, lines, boxes, and circles to point out what matters.

AND THE REST
• Crop to a square, a story, or any size, and rotate, flip, or straighten
• Adjust brightness, contrast, saturation, and warmth
• Cut out the subject of a photo
• Add emoji stickers, or keep your own
• Start from a blank canvas sized for a post or a story
• Undo anything, and come back to a project later

PRIVATE BY DESIGN
Every edit happens on your phone, and your photos are never uploaded. There's no account, no ads, no subscription, and no watermark. Tuck never asks to see your photo library: you pick photos with Android's photo picker.

OPEN FROM ANYWHERE
Choose Tuck in any app's share menu to open a picture straight in the editor. When you're done, save it to your gallery or share it on.

Tuck also runs in your browser at tuck.tools.
```

**Store settings**

- Category: Photography. Tags: photo editor, privacy, memes.
- Contact email: support@tuck.tools. Website: https://www.tuck.tools.
- Privacy policy: https://www.tuck.tools/privacy

## Screenshots

`docs/store-listing/screenshots/` holds them at the sizes each store takes, as JPEGs
(both stores accept them). Each pairs a headline with the app in that state,
captured from Release builds on the simulators and the emulator:

1. Hide what you'd rather not share (Redact on a chat screenshot)
2. Tap Find, then pick what to hide (Find's text results, five picked)
3. Captions that read on anything (a caption selected, with its fonts)
4. Point out what matters (a circle, an arrow, and a note, in Draw)
5. Crop to the part that counts (the crop tool at Square)
6. Nothing leaves your device (home, with projects; not on iPad, whose wide
   home is mostly empty with four projects)

| Path | Size | For |
|---|---|---|
| `iphone-6.9/` | 1320 × 2868 | App Store, iPhone (Apple scales them for smaller iPhones) |
| `ipad-13/` | 2064 × 2752 | App Store, iPad (scaled for smaller iPads) |
| `play-phone/` | 1080 × 1920 | Google Play, phone (status bar trimmed off) |
| `play-feature-graphic.jpg` | 1024 × 500 | Google Play, feature graphic |
| `play-icon.png` | 512 × 512 | Google Play, app icon |

The scenes use pictures made for them (an invented chat, an invented
settings screen, and an illustration), so no one's photo or personal details
appear.

### Making them again

`docs/store-listing/source/` holds what makes them; its `out/` folder is ignored.

1. `docs/store-listing/source/compose.sh content` renders the pictures, and
   `node docs/store-listing/source/seed.mjs` writes the five projects to
   `docs/store-listing/source/out/projects/`.
2. Install a Release build (`npx expo run:ios --configuration Release`, or
   `npx expo run:android --variant release`): a development build covers the
   app with its Tools button. Copy the projects into the app's
   `Documents/projects/` (iOS: `xcrun simctl get_app_container <udid>
   com.nverk.tuck data`). A release Android build can't be written into, so
   install the debug build, copy them into `files/projects/` with
   `adb shell run-as com.nverk.tuck`, and install the release build over it
   with `adb install -r`: they're signed alike, so the data stays.
3. Give the devices a clean status bar (`xcrun simctl status_bar <udid>
   override --time 9:41 --batteryState discharging --batteryLevel 100`), open
   each scene, and save captures as `docs/store-listing/source/out/raw/<iphone|ipad|android>-<n>-<scene>.png`
   (names in `compose.sh`). Find runs on the "Chat" project, which has nothing
   hidden yet; delete it before capturing home.
4. Compose each set:

   ```bash
   docs/store-listing/source/compose.sh docs/store-listing/screenshots/iphone-6.9 1320 2868 0.11 150 128 iphone
   ```

   ```bash
   docs/store-listing/source/compose.sh docs/store-listing/screenshots/ipad-13 2064 2752 0.03 120 96 ipad 0.86
   ```

   ```bash
   docs/store-listing/source/compose.sh docs/store-listing/screenshots/play-phone 1080 1920 0.06 110 104 android 0.84 63
   ```

   The last number trims Android's 63-pixel status bar. The feature graphic
   is `feature.html`, rendered at 1024 × 500 with headless Chrome. The web
   app's link preview, `public/og.jpg`, is `og.html` rendered the same way
   at 1200 × 630.
