# Release checklist

What's left to ship Tuck to the App Store, Google Play, and tuck.tools.
The code side is set up: the app is `com.nverk.tuck` on both platforms, with
the URL scheme `tuck`, EAS build profiles in `eas.json`, and versions kept by
EAS (`appVersionSource: "remote"`, so each production build gets the next
build number). Everything below happens in an account or a store console.

Store name: **Tuck: Photo Markup**. Home screen name: **Tuck**.

## 1. Pages the stores ask for

These are routes in the app (`src/screens/info/`), so they're on the web
and inside the app, linked from the bottom of the home screen. Each store
listing points to the web copies once they're deployed:

- Privacy policy: https://www.tuck.tools/privacy
- Support URL: https://www.tuck.tools/support (support@tuck.tools)
- Licenses: https://www.tuck.tools/licenses

Keep the privacy policy true when the app changes: a new SDK, analytics, or
anything that sends data off the device needs a new paragraph and date, and
new answers in App Privacy and Data safety. Add a new font, sticker set, or
library to `src/screens/info/credits.ts`. Terms of use are optional:
Apple's standard license agreement applies by default, and Google Play
doesn't require terms.

## 2. Accounts and tools

- [x] Buy tuck.tools and serve the site at www.tuck.tools.
- [x] Redirect tuck.nverk.me to www.tuck.tools in Vercel. Browsers store
      projects for each site separately, and the web's storage was renamed
      for Tuck, so projects saved on tuck.nverk.me won't appear on
      tuck.tools.
- [x] Set up support@tuck.tools.
- [x] Expo account: `pnpm dlx eas-cli@latest login`, then `pnpm dlx eas-cli@latest init`
      in the repo. It writes `extra.eas.projectId` and `owner` into
      `app.json`; commit that.

## 3. Apple

- [x] Join the Apple Developer Program ($99 a year). As an individual, your
      legal name is shown as the seller. An organization shows the company
      name and needs a D-U-N-S number.
- [x] `pnpm dlx eas-cli@latest build -p ios --profile production`. Sign in with
      your Apple account when asked: EAS registers `com.nverk.tuck` and the
      share extension's `com.nverk.tuck.ShareExtension`, turns on the App
      Group `group.com.nverk.tuck` for both, and makes the certificates and
      profiles. If the App Group step fails, create the group under
      Identifiers → App Groups and run the build again.
- [x] `pnpm dlx eas-cli@latest submit -p ios --profile production` creates the
      App Store Connect record (it asks for the name, **Tuck: Photo
      Markup**) and uploads the build to TestFlight. Try it there on a real
      iPhone, including "Edit in Tuck" from the share sheet.
- [x] In App Store Connect:
  - Category: Photo & Video. Price: free.
  - Subtitle (up to 30 characters), description, and keywords.
  - Privacy policy URL and Support URL.
  - App Privacy: **Data Not Collected**.
  - Age rating questionnaire (expect 4+).
  - Digital Services Act trader status, needed to sell in the EU. A trader's
    address, phone, and email are shown on the listing.
  - Screenshots for the 6.9" iPhone and the 13" iPad, and the listing text:
    both are in `docs/store-listing/screenshots/` and `docs/store-listing/listing.md`.
    The wide editor now shows a tool's options in the header, so retake the
    iPad ones from a Release build if they show a tool open.
  - Export compliance is already answered (`usesNonExemptEncryption: false`).
  - Review notes: no sign-in needed; mention the share extension.

## 4. Google Play

- [x] Create a Play Console developer account ($25 once) and verify your
      identity. A **personal** account made after November 2023 must run a
      closed test with at least 12 testers who stay opted in for 14 days in
      a row before it can publish to production. An organization account
      (D-U-N-S number) skips this.
- [x] Create the app: name **Tuck: Photo Markup**, app (not game), free.
- [ ] `pnpm dlx eas-cli@latest build -p android --profile production` makes the
      upload keystore and an `.aab`. Upload the first one by hand in Play
      Console (a closed testing track); Google's API can't make the first
      upload. After that, `eas submit -p android` works with a service
      account key from Google Cloud.
- [ ] App content forms:
  - Privacy policy URL.
  - Ads: none. App access: everything works without signing in.
  - Content rating (the IARC questionnaire).
  - Target audience: 13 and up, so the Families policy doesn't apply.
  - Data safety: photos never leave the device, so they aren't "collected".
    ML Kit's diagnostics are: declare "App info and performance:
    diagnostics" and "Device or other IDs", collected for analytics, not
    shared, encrypted in transit. How to answer is your call; Google's
    disclosure is at
    https://developers.google.com/ml-kit/android-data-disclosure.
  - No photo and video permissions declaration: the app doesn't ask to read
    the library (`READ_MEDIA_IMAGES` is blocked in `app.json`). It picks
    photos with the system picker and saves without reading.
- [ ] Store listing: the text in `docs/store-listing/listing.md`, and the icon,
      feature graphic, and phone screenshots in `docs/store-listing/screenshots/`.

## 5. tuck.tools

- [ ] Once the App Store listing is live, point the site to it: add
      `<meta name="apple-itunes-app" content="app-id=…">` to
      `src/app/+html.tsx`, so Safari on iPhone shows the Smart App Banner,
      and a store badge to the Support page. The same for Google Play once
      its listing is live.
- [ ] Check what only the deployed site can show:
  - The headers and Content Security Policy Vercel sends
    (`curl -sI https://www.tuck.tools/`), which `vercel.json` sets.
  - Chrome's install prompt, and the home screen icon on iPhone.
  - An update arriving through the service worker: home's "A new version
    of Tuck is ready", then Reload.
  - Sharing a photo to the installed app on Android, and opening one with
    it on the desktop ("Open with").

## 6. Open source

- [ ] Choose a license, and add `LICENSE` and the `license` field in
      `package.json`.
- [ ] Scan git history for secrets and private names (machine and device
      names, local paths). The repo went public on October 29, 2026, so
      rotate anything found rather than only rewriting history.
- [x] Check that nothing in `docs/` assumes a private repo.
