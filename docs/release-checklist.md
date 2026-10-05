# Release checklist

What's left to ship Tuck to the App Store, Google Play, and tuck.tools.
The code side is set up: the app is `com.nverk.tuck` on both platforms, with
the URL scheme `tuck`, EAS build profiles in `eas.json`, and versions kept by
EAS (`appVersionSource: "remote"`, so each production build gets the next
build number). Everything below happens in an account or a store console.

Store name: **Tuck: Photo Markup**. Home screen name: **Tuck**.

## 1. Pages the stores ask for

Both stores ask for these URLs before you can submit, so put them up first.

- **Privacy policy** (required by both stores). Say what's true: photos are
  edited on the device and never uploaded, there's no account, analytics, or
  ads, and the web version keeps projects in the browser. On Android, Google's
  ML Kit (face and text detection, cut out) sends Google diagnostic data:
  the device model and OS, the app's package and version, performance
  numbers, and an ID for the installation that isn't meant to identify a
  person. Vercel, which hosts the web version, keeps standard server logs.
- **Support page** (Apple requires a Support URL). Its job is to give a way
  to reach you, such as an email address at tuck.tools.
- **Licenses** (not checked by either store, but owed). The caption fonts are
  under the SIL Open Font License, and Permanent Marker, the Noto Emoji
  stickers, MediaPipe, and Tesseract are under Apache 2.0. Both licenses ask
  that their notice ship with the app, so link the page from inside the app
  too.
- Terms of use are optional: Apple's standard license agreement applies by
  default, and Google Play doesn't require terms.

## 2. Accounts and tools

- [ ] Buy tuck.tools, add it to the Vercel project, and redirect
      tuck.nverk.me to it. Browsers store projects for each site separately,
      and the web's storage was renamed for Tuck, so projects saved on
      tuck.nverk.me won't appear on tuck.tools.
- [ ] Set up an email address at tuck.tools for support (registrar
      forwarding or Cloudflare Email Routing works).
- [ ] Expo account: `npx eas-cli@latest login`, then `npx eas-cli@latest init`
      in the repo. It writes `extra.eas.projectId` and `owner` into
      `app.json`; commit that.

## 3. Apple

- [ ] Join the Apple Developer Program ($99 a year). As an individual, your
      legal name is shown as the seller. An organization shows the company
      name and needs a D-U-N-S number.
- [ ] `npx eas-cli@latest build -p ios --profile production`. Sign in with
      your Apple account when asked: EAS registers `com.nverk.tuck` and the
      share extension's `com.nverk.tuck.ShareExtension`, turns on the App
      Group `group.com.nverk.tuck` for both, and makes the certificates and
      profiles. If the App Group step fails, create the group under
      Identifiers → App Groups and run the build again.
- [ ] `npx eas-cli@latest submit -p ios --profile production` creates the
      App Store Connect record (it asks for the name, **Tuck: Photo
      Markup**) and uploads the build to TestFlight. Try it there on a real
      iPhone, including "Edit in Tuck" from the share sheet.
- [ ] In App Store Connect:
  - Category: Photo & Video. Price: free.
  - Subtitle (up to 30 characters), description, and keywords.
  - Privacy policy URL and Support URL.
  - App Privacy: **Data Not Collected**.
  - Age rating questionnaire (expect 4+).
  - Digital Services Act trader status, needed to sell in the EU. A trader's
    address, phone, and email are shown on the listing.
  - Screenshots for the 6.9" iPhone (1320 × 2868). The app is iPhone only,
    so no iPad screenshots are needed.
  - Export compliance is already answered (`usesNonExemptEncryption: false`).
  - Review notes: no sign-in needed; mention the share extension.

## 4. Google Play

- [ ] Create a Play Console developer account ($25 once) and verify your
      identity. A **personal** account made after November 2023 must run a
      closed test with at least 12 testers who stay opted in for 14 days in
      a row before it can publish to production. An organization account
      (D-U-N-S number) skips this.
- [ ] Create the app: name **Tuck: Photo Markup**, app (not game), free.
- [ ] `npx eas-cli@latest build -p android --profile production` makes the
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
- [ ] Store listing: short description (80 characters), full description,
      a 512 × 512 icon, a 1024 × 500 feature graphic, and at least two phone
      screenshots.
