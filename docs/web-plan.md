# Web plan

An audit of the web app at www.tuck.tools on 2026-10-16, while the iOS build waits for App Review. It covers the live site (headers, HTML, assets, behavior in Chrome in light and dark), the hosting config (`vercel.json`), the HTML shell (`src/app/+html.tsx`), the web entry (`index.web.ts`), and the theme (`src/theme.ts`).

The foundation is good. Pages are prerendered with real content (the privacy, support, and licenses pages read fine without JavaScript), every asset is served from the site itself with Brotli, HSTS is on, the apex redirects to `www`, the theme script runs before the first paint, keyboard focus has a visible ring in the palette's ink, and link previews have a proper Open Graph card. What's missing is mostly the layer around the app: two live bugs, caching and security headers, the files browsers look for (a manifest, icons, robots, a 404 page), and keeping projects safe in browser storage.

## How to work through it

* One item at a time, in the order below. After each, verify it, stop, and hand over a Conventional Commits message. The user reviews and commits.
* Header and `vercel.json` changes can't be checked on a preview deployment (it's behind Vercel's login). Check them with `npx vercel build` (see AGENTS.md), then with `curl -sI` against production after the deploy.
* Check anything visual in both palettes and with Settings forcing each one, in Chrome and Safari, on a phone width and a desktop width.
* Run `npm run check`, `npm run typecheck`, and `npm run build:web` after each item that changes code.
* Tick items off here as they land, with a line on what was built.

## Priority 1: Bugs on the live site

### 1.1 Dark mode mixes the two palettes (done)

Built as below, but with hydration turned off for both palettes. The day palette failed hydration too: the server has no icon font, so `@expo/vector-icons` renders each icon as empty text, the browser renders its glyph, and every page with an icon threw React error #418 (also on the live site) before React fell back to rendering the page afresh. Hydration never succeeded, so turning it off changes nothing but the error. Checked on a local `npm run build:web` served with `serve` (the `web-export` launch configuration): home and `/privacy` with the system light and dark, and with Settings forcing each palette against the system's, all in one palette and with no console errors.

With the system in dark mode, the first page loaded paints a mix of day and night colors. On home, "Open a photo" has a near-white fill (night `primary`) under white text (day `onPrimary`), so its label can't be read, and the screen behind it stays white. On `/privacy` and the other info pages, the Back chevron is near-white on white. Pages reached by navigating inside the app afterwards are fine.

Why: the static export renders every page on the server, where there's no `prefers-color-scheme`, so the HTML carries the day palette's class names. In the browser, `colors` resolves to the night palette and React hydrates the server's HTML. React doesn't patch attributes that differ during hydration, so elements keep the server's day classes while anything that re-renders or mounts later gets night ones. Expo picks hydration with `globalThis.__EXPO_ROUTER_HYDRATE__ = true`, which the export writes into each page.

Fix: in `index.web.ts`, before importing `expo-router/entry`, set `globalThis.__EXPO_ROUTER_HYDRATE__ = false` whenever the palette isn't the day one (it can import `colorScheme` from `theme.ts`, which doesn't import Skia). Expo then renders with `createRoot`, replacing the server's HTML. Hydration buys little here anyway, since nothing works until CanvasKit loads. Simplest of all is to turn it off always; keeping it for the day palette avoids a flash of an empty root in the common case.

The deeper fix is a palette of CSS custom properties on web (`colors.background` as `var(--background)`, both palettes defined in `+html.tsx`), which would also let the web follow the system's setting live and switch themes without a reload. It's a larger change: Skia needs real colors, so the canvas would read a resolved copy. Worth it only if live switching matters.

### 1.2 The page hangs at "Loading…" if CanvasKit can't load (done)

Built as described. `index.web.ts` catches a failure to load CanvasKit or the router and fills `#root` from a `<template>` in `+html.tsx`, with Try Again (a reload) and the support address; `<noscript>` shows the same layout. Both read the palette from CSS variables the page style now defines (`--background`, `--ink`), which the focus ring uses too. Support has a "Which browsers work?" section. Checked by serving a build without `canvaskit.wasm` in both palettes, then restoring it and pressing Try Again.

`index.web.ts` calls `LoadSkiaWeb(...).then(...)` with no `catch`. When the WebAssembly can't be fetched or compiled (a dropped connection, a content blocker, a browser without WebGL or WebAssembly, a corporate proxy), the router never loads and the prerendered page stays at a disabled "Loading…" button with no explanation. Without JavaScript the same happens, with no `<noscript>`.

Fix: catch the failure and replace `#root`'s contents with plain DOM (React Native can't run yet): a sentence on what failed, a Reload button, and the support address. Add a `<noscript>` with the same message to `+html.tsx`. Say on the Support page which browsers work (recent Chrome, Edge, Firefox, and Safari).

### 1.3 Tertiary text fails contrast (done)

Built as described: home's hint, Create's ratio labels, and `Segmented`'s detail line use `textSecondary`, and `theme.ts` keeps `textTertiary` for disabled controls and decoration.

`textTertiary` is 2.7:1 on the day background and 3.1:1 on the night one; WCAG AA asks 4.5:1 for text this size. It's used for running text in three places: home's "Or paste a screenshot, or drop an image anywhere." (`HomeScreen.tsx`), a line on Create (`CreateScreen.tsx`), and `Segmented`'s detail line. Disabled icons (`IconButton`) can stay tertiary, since disabled controls are exempt.

Fix: use `textSecondary` (6.4:1 and 6.5:1) for those three, and keep `textTertiary` for disabled states and decoration only. Note that in `theme.ts`.

## Priority 2: Production basics

### 2.1 Cache headers (done)

Built as described, checked in `npx vercel build`'s `.vercel/output/config.json`. Every file under `/assets/` has a content hash, including React Navigation's `@2x` images.

Everything is served with `cache-control: public, max-age=0, must-revalidate`, so each visit asks the server again about every file. The JavaScript in `/_expo/static/` and the fonts in `/assets/` have content hashes in their names and never change, so they can be cached for a year. The WebAssembly and models (`canvaskit.wasm`, `mediapipe/`, `tesseract/`) don't have hashes, so they need a shorter lifetime.

Fix, in `vercel.json` `headers`:

* `/_expo/static/(.*)` and `/assets/(.*)`: `public, max-age=31536000, immutable`.
* `/canvaskit.wasm`, `/mediapipe/(.*)`, `/tesseract/(.*)`: `public, max-age=86400, stale-while-revalidate=604800`. A library upgrade then reaches visitors within a day. Putting the package version in the path from `copy-web-assets.mjs` would let these be immutable too.
* HTML keeps Vercel's default, so a deploy shows up at once.

### 2.2 Security headers (done)

Built with the CSP enforcing from the start, after a session through the app with it enforced on a local build (`serve` with the same headers): opening a photo, finding faces and text, Cut out, text, a sticker, crop, adjust, export, the home thumbnail, and reopening the project. Nothing the app needs was blocked. One thing was: MediaPipe sends usage logs (the task, timings, and an API key, no images) to `https://odml.pa.googleapis.com/v1/log` whenever a detector is made, and has no option to stop it. The live site has been sending them, which the privacy policy doesn't allow for; `connect-src 'self'` now blocks them, at the cost of a "Refused to connect" console error once per detector. `build:web` runs `scripts/check-csp.mjs`, which fails the build if a page has an inline script whose hash isn't in `script-src`.

Only HSTS is sent. There's no Content Security Policy, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or framing protection. A CSP matters more than usual here: `connect-src 'self'` is a promise the browser enforces that the page can't send photos anywhere, which backs up the privacy policy.

Fix, in `vercel.json` `headers` for every path:

* `X-Content-Type-Options: nosniff`
* `Referrer-Policy: strict-origin-when-cross-origin`
* `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, leaving clipboard alone (Paste needs `clipboard-read`).
* `Strict-Transport-Security: max-age=63072000; includeSubDomains`, and `preload` once every subdomain is known to be on HTTPS.
* A CSP, sent as `Content-Security-Policy-Report-Only` first and switched to enforcing once a session through every tool (open, paste, drop, detect faces and text, Cut out, export, share, a sticker) reports nothing. A starting point: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-…' 'sha256-…'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`. The two hashes are for the inline theme script in `+html.tsx` and Expo's `__EXPO_ROUTER_HYDRATE__` script; `style-src` needs `'unsafe-inline'` because React Native Web writes its styles at runtime. Tesseract's worker and MediaPipe's loader may need more (`blob:` workers, `'unsafe-eval'` for Emscripten glue); the report-only phase finds out.

### 2.3 Keep projects in the browser from being evicted (done)

The audit was wrong about the request: `writeProjectFile` in `projectStorage.web.ts` already calls `navigator.storage.persist()` on the first save, and `persisted()` read false only because nothing had been saved in that browser. What was missing was telling people: Support's "Where are my projects?" now says browsers can clear a site's data on their own, and to save or share an edit worth keeping. The privacy page needed nothing.

`navigator.storage.persisted()` is false, so projects in IndexedDB are "best effort": the browser can clear them under storage pressure, and Safari deletes all of a site's storage after seven days without a visit unless it's installed to the home screen. Someone who edits a screenshot, comes back two weeks later in Safari, and finds their projects gone has no way to know why.

Fix: call `navigator.storage.persist()` after the first project is saved (Chrome and Firefox grant it to sites people use, Safari grants it to installed ones). Say on the privacy page and in Support that browser storage can be cleared, and that saving or sharing the edit is the way to keep it. Installing the app (2.4) is what makes Safari keep it.

### 2.4 A web app manifest and icons (done)

Built as described. `public/manifest.webmanifest` uses the favicon's rounded tile for its `any` icons and a new `assets/maskable-icon.svg` (the mark at 80%, inside the safe zone) for the maskable one; `apple-touch-icon.png` is `icon.png` at 180 pixels and `favicon.svg` is `assets/favicon.svg`. The PNGs were rendered with `sips`, which reads SVG. Not checked: Chrome's install prompt and the iOS home screen icon, which need a deploy.

There's no manifest, no `apple-touch-icon`, and only a 1.9 KB `favicon.ico`. Adding Tuck to the home screen on iOS shows a screenshot of the page as its icon, and Chrome doesn't offer to install it.

Fix:

* `public/manifest.webmanifest` with `name` "Tuck: Photo Markup", `short_name` "Tuck", `start_url` "/", `scope` "/", `display` "standalone", `background_color` and `theme_color` from the day palette, and icons at 192 and 512 pixels plus a `maskable` 512 one (made from `assets/icon.svg`, with the mark inside the safe zone).
* In `+html.tsx`: `<link rel="manifest">`, `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` beside the `.ico`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180 pixels, opaque), and `<meta name="apple-mobile-web-app-title" content="Tuck">`.
* Drop `<meta http-equiv="X-UA-Compatible">`, which only Internet Explorer read.

### 2.5 A real 404 page (done)

Built as described: `NotFoundScreen` in `features/about/` is an info page with Open Tuck, and `build:web` copies `+not-found.html` to `404.html`, which Vercel's error route (`/404`) serves with a 404 status. Checked on the local build in dark, including Open Tuck going home. `/projects/<id>` is rewritten before Vercel looks for a 404, so a missing project still gets the editor's own message.

An unknown address gets Vercel's plain-text "The page could not be found / NOT_FOUND". Add `src/app/+not-found.tsx` (the wordmark, a sentence, and a link home, in the app's palette), and make sure the export leaves a `404.html` in `dist/` for Vercel to serve; copy `+not-found.html` to it in `build:web` if Expo doesn't. Check that `/projects/<id>` for a project that doesn't exist still opens the editor's own message rather than the 404.

### 2.6 Retire tuck.nverk.me

`https://tuck.nverk.me/` still serves the app (it's open in the release checklist). Browsers keep storage per site, so anyone who used it has projects there that tuck.tools can't see. Before redirecting, decide whether those projects matter: if they might, deploy a build there that shows a notice ("Tuck has moved to tuck.tools; open your projects here and save them first") for a few weeks, then redirect. If not, redirect now.

## Priority 3: Discoverability

### 3.1 Give the home page content in its HTML (done)

Built as described: `HomeScreen` shows the hero when it's prerendered (on web, with no `window`), without the tagline's fade-in, which Reanimated starts from `visibility: hidden`. The page's HTML now has the wordmark as its `h1` and the tagline. In the browser nothing changed: someone with projects sees the hero while the app loads, then the list, as they saw an empty page before.

The prerendered home page says only "Loading… Paste Blank canvas Settings Support Privacy Licenses": no wordmark, no tagline, no heading, because the hero waits until the project list is known to be empty. Search engines and anyone on a slow connection see nothing about what Tuck is.

Fix: render the hero in the server pass (the export has no projects, so the server can always show it) and keep the current rule in the browser. Hydration is off (1.1), so the browser replacing the hero with a project list is an ordinary render.

### 3.2 Robots, sitemap, and canonical URLs (done)

Built as described. Each page's title, description, Open Graph and Twitter title and description, canonical URL, and `og:url` come from `PageHead` (`ui/PageHead.tsx`): the layout renders the site's, and a page's own replaces it (Expo Router's `Head` keeps the deepest). Home, Support, Privacy, and Licenses give their path; the 404 page is `noindex`. `+html.tsx` keeps only what every page shares (the image, type, and site name). Expo Router's `/_sitemap` debug page, which the export includes, redirects home.

`/robots.txt` and `/sitemap.xml` are 404s, and no page names its canonical URL.

Fix: `public/robots.txt` allowing everything except `/projects/`, pointing to the sitemap; `public/sitemap.xml` listing `/`, `/support`, `/privacy`, and `/licenses`; a `<link rel="canonical">` and `og:url` per page (from `InfoPage`'s `Head`, and the layout's for home). Give each info page its own `<meta name="description">`.

### 3.3 Point to the stores once they're live

When the App Store listing is up: add `<meta name="apple-itunes-app" content="app-id=…">` so Safari on iPhone shows the Smart App Banner, and store badges on the Support page. Same for Google Play later.

## Priority 4: Standards and polish

### 4.1 Links are not anchors (done)

Built with Expo Router's `Link`: `InlineLink` renders one (external addresses get `target="_blank"` and `rel="noopener"` on web; on native, `Link` opens them with `Linking`), and `AboutLinks` wraps its `Pressable` in `Link asChild`, with its hover and press look on a view inside. Checked on web: anchors with `href` in the prerendered HTML, a plain click navigating without a reload, and the footer's padding and hover. Not checked on a phone.

The footer links on home (`AboutLinks`) and `InlineLink` on the info pages are `Pressable`s and `Text`s with `accessibilityRole="link"` that navigate in `onPress`. On web they render as `<div role="link">` with no `href`: they can't be opened in a new tab, middle-clicked, copied, or hovered for their address, and crawlers don't follow them. Use Expo Router's `Link` (with `asChild` around the `Pressable`), or React Native Web's `href` prop on `Text`; both render an `<a href>`. External links get `hrefAttrs={{ target: "_blank", rel: "noopener" }}`.

### 4.2 Landmarks (done)

Built as described: home, Create, and the editor are `main` from their root, info pages from their scroll view (below the header), and home's footer links are a `navigation` labeled "About Tuck". React Native Web renders them as `<main>` and `<nav>`. Screens left behind in the stack are `display: none` and `aria-hidden`, so only the visible screen's landmarks are exposed.

No page has a `main` landmark, and home's footer links aren't a `nav`. React Native Web maps `role="main"` and `role="navigation"` on a `View` to them. Add `main` to each screen's content and `navigation` to the footer links, so screen reader users can jump past the header.

### 4.3 Load CanvasKit sooner (done)

Built the preload. On a local build, `canvaskit.wasm` now starts with the scripts (11 ms after navigation, from the `link`) instead of after they've run, and the app's own fetch reuses it: one request, no "preloaded but not used" warning. Not measured on a throttled phone, and async routes weren't tried.

A first visit downloads 0.47 MB and 0.76 MB of JavaScript and 3.25 MB of CanvasKit (Brotli sizes) before anything works, and `canvaskit.wasm` is only requested once the first bundle has run. Add `<link rel="preload" href="/canvaskit.wasm" as="fetch" type="application/wasm" crossorigin>` to `+html.tsx` so it downloads alongside the JavaScript. Then measure with the web-perf skill (LCP and time until "Open a photo" is enabled, on a throttled phone profile) before trying anything bigger, like Expo Router's async routes.

### 4.4 Offline and install

Tuck does everything on the device, so it can work offline. A service worker that precaches the shell, the bundles, CanvasKit, and the fonts, and caches the detection models the first time they're used, would make the installed app open without a connection. The manifest can also add `file_handlers` (open images with Tuck from the desktop) and `share_target` (Android Chrome's share sheet, the web's version of `modules/share-target`). It's the biggest item here, and a stale service worker is hard to undo, so build it last, with a version in the cache name and a "New version: reload" prompt.

### 4.5 A way to report web errors (done)

Built as described: the root `ErrorBoundary` has Copy Details (`expo-clipboard`), which copies the version, the browser and path on web (the OS and its version on native), and the stack, plus a line naming the support address. Checked on web with a temporary crash: the details copied and the label changed to Copied. Not checked on a phone.

There's no error reporting, which the privacy policy promises, so failures in someone's browser are invisible. Keep it that way, and add "Copy details" to the root `ErrorBoundary`: the error, the route, the browser, and the build, for the user to paste into an email to support. Nothing leaves the device unless they send it.

## Checked and fine

* Brotli for JavaScript and WebAssembly, HTTPS with HSTS, the apex redirecting to `www` with a 308.
* `lang="en"`, a viewport that allows zoom, `viewport-fit=cover` with safe-area padding, `color-scheme` and per-scheme `theme-color`, and the theme script applying a forced palette before the first paint.
* Per-page titles on the info pages, and an Open Graph and Twitter card with a 1200 × 630 image and alt text.
* A visible focus ring in the palette's ink, hover states eased with `webTransition`, and reduced motion respected by `Highlight` and `Toast`.
* Day palette contrast for primary and secondary text (21:1 and 6.4:1), and the danger color in both palettes (above 4.5:1).
* Detection's libraries load only when used (`import("tesseract.js")`, MediaPipe's script), and every asset is served from tuck.tools rather than a CDN.
