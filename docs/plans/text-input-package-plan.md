# Text input package

Written October 28, 2026. This plan moves the editor's in-place text editing (the hidden input, the caret and selection drawn with Skia, and the gesture that places them) into a workspace package, `packages/skia-text-input`, and then asks whether Text should become a tool.

**Status:** all five steps built on October 28, 2026. Not published (section 6).

What building it found:
* Expo's default Metro config resolved the workspace link with no `metro.config.js`, and so did the docs' Vite and `tsc`.
* The package lists `react-native-skia` as a peer (`>=2.15`) and a dev dependency at the app's exact version, and pnpm links both to the same folder, so there's one Skia. Check that again whenever either version changes.
* `createCaretLayout` is tested in Node against a fake monospaced paragraph, since the package imports only Skia's types. A selection across an empty line covers its filler, a narrow box that shows the line is selected.
* The app imports helpers and layout from `@tuck/skia-text-input/core`, and the components from the root entry, which only the editor imports. `render/` and the interactive docs load no React Native from the package.
* React, React Native, Reanimated, and Worklets are peers and dev dependencies too, at the app's versions, and each links to the app's copy. Reanimated is an optional peer, since `/core` doesn't need it.
* `HiddenTextInput` isn't fully controlled: it takes `initialSelection`, placed on its first focus, and a ref's `select` moves the caret later, as `TextEditor` did. Setting a `TextInput`'s selection from a prop on every change fights the platform's own.
* Checked on web (headless Chrome) and the iPhone 17 Pro simulator: typing, the caret on an empty line and blinking, Select All's highlight with the empty line's filler, a font change keeping the keyboard (a real click on web), typing over a selection, Escape on web, and ✓.
* `useCanvasTextGesture` takes `text` and `toIndex(x, y, clamp)`; Tuck's `useTextEditGesture` keeps the viewport, the layer's hit box with its padding, and the tap slop (a `tapSlop` option). The package keeps its own copy of the double tap timing (`doubleTap.ts`, not exported), so the editor's `createDoubleTap` stays for zooming, and its own fine pointer check for hover. Gesture Handler and Worklets joined the peers, optional like Reanimated.
* Checked step 4 on web (headless Chrome: a tap places the caret, a double tap selects the word, a drag selects, clamped past the text, and a tap off it finishes) and on the iPhone simulator (tap, drag, tap away). Headless Chrome's synthetic mouse doesn't change the canvas cursor, on this step or step 3's build, so hover went unchecked; and there the first drag after a tap selects nothing, on step 3's build too, while iOS's did.
* Step 5: `pnpm --dir packages/skia-text-input build` emits `lib/` (gitignored) with `tsconfig.build.json`, and `prepack` builds it, so a pack is never stale. pnpm swaps `publishConfig.exports` in when it packs, and the tarball holds `lib/`, `src/` (for the source maps), and the README. The `.d.ts` files keep `.ts` and `.tsx` in their imports, which TypeScript accepts in declaration files.
* The pack, tried in a fresh `create-expo-app` (SDK 58, npm, which picked Skia 3.8 for the `>=2.15` peer): it type-checks through both entries, bundles for iOS and the web, the app's Babel transforms the package's worklets, and on the iPhone simulator a tap places the caret, a drag selects, and typing replaces the selection.
* The trial found a bug Tuck hid: iOS never reports a selection set from code to `onSelectionChange`, and Tuck's `select` stored the selection itself. `HiddenTextInput` now reports what `select` and `initialSelection` place, and Tuck's `select` relies on that (checked again in Tuck on iOS and the web).
* It also showed Reanimated warning, on native, about `Caret`'s dependency lists, which native ignores; `Caret` dropped them. About seven of Tuck's own `useDerivedValue` calls still pass one.
* Seen, not caused by step 3: on iOS, a selection shows the system's selection handles at the hidden input, behind the header's top left; and once on web, the first switch to Modern drew the outline off its letters, which four more fresh runs on this step and the last didn't repeat.

## 1. Why

* **Learning the stack.** The package has to stand on React Native, Skia, Reanimated, and Gesture Handler alone, with no store, theme, or editor mode to lean on.
* **Readability.** About 600 of the text editor's 900 lines are general: caret geometry, word selection, the hidden input, the blinking caret, the press gesture. Tuck's code keeps what's Tuck's (fonts, outline, per-line boxes, the style panel, starting and finishing an edit) and reads shorter.
* **A second use is coming.** Labelled arrows, for marking up screenshots, would edit a label in place on the canvas too. They're the first test of whether the package's API is general, and of whether Text belongs in `editor/tools/` (section 5).

The package stays `"private": true`. It's published only once someone asks for it or a use outside Tuck appears (section 6).

## 2. What moves, what stays

| Now | Goes to |
| --- | --- |
| `model/textEditing.ts`: `TextSelection`, `caretText`, `wordRange`, `clampSelection` | the package (step 1) |
| `model/textEditing.ts`: `TEXT_PLACEHOLDER`, `withPlaceholder` | `model/layers/text.ts` (step 1): Tuck's wording, about text layers |
| `render/textLayerLayout.ts`: `caretLayout`, `textCaretRect`, `textSelectionRects`, `textIndexAt` | the package as `createCaretLayout` (step 2); Tuck keeps its `WeakMap` cache and `buildParagraph` |
| `editor/text/TextEditor.tsx` | the package as `HiddenTextInput` (step 3); Tuck keeps where it sits (behind the header) |
| `editor/text/EditedTextView.tsx`: `Caret`, the selection path | the package as `Caret` and `SelectionHighlight` (step 3); Tuck keeps the placeholder fade and `TextLayerView` |
| `editor/text/useTextEditGesture.ts` | the package as `useCanvasTextGesture` (step 4), given a screen-to-paragraph mapping; Tuck keeps the viewport, hit padding, and tap slop |
| `useTextEditing.ts`, `TextStylePanel.tsx`, `textSettings.ts`, `useKeepTextFocus.ts`, `editorMode.ts`'s text mode | stay in the editor |

## 3. The package

* **Name:** `@tuck/skia-text-input` in `packages/skia-text-input/`. Publishing under the `@tuck` scope needs an npm organization named `tuck` (not checked: npm's lookup needs a login); renaming costs nothing while it's private.
* **Entry points:** `.` for the React Native parts, and `./core` (from step 2) for the pure helpers and Skia layout, so a caller drawing its own caret needs neither Reanimated nor Gesture Handler.
* **Exports** point at `src/*.ts`, so the app, Node's tests, Metro, and the docs' Vite and `tsc` use the source with no build step. Publishing (section 6) adds `publishConfig.exports` pointing at a built `lib/`, which pnpm swaps in when it packs.
* **Peers:** `react`, `react-native`, and `react-native-skia`, plus `react-native-reanimated` and `react-native-gesture-handler` marked optional, added as each step first needs them. The app keeps one copy of each (docs/architecture.md).
* **Imports:** relative, with explicit `.ts` extensions, as `model/` does, and nothing from `src/`. The app depends on it as `workspace:*`.
* **Tests** live in `src/__tests__/`, run by the package's `test` script and the root's.
* **Colors and sizes** are props with plain defaults: the package has no palette. Tuck passes `colors.selection` and its halo.

## 4. Steps

Each step leaves the app working, and runs `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build:web`, and `pnpm --dir docs/interactive build`. Steps 3 and 4 also check typing, selecting, and the caret on web and the iPhone simulator.

1. **Pure helpers.** Create the package with `TextSelection`, `caretText`, `wordRange`, `clampSelection`, and their tests; move the placeholder to `model/layers/text.ts`; point the app at the package; drop `textEditing.ts` from the docs' sources (no lesson quotes it); add `packages/**` to the root `test` script; update docs/architecture.md and AGENTS.md. This proves the workspace link through Metro, Node's tests, Vite, and CI.
2. **Caret layout.** `createCaretLayout(text, width, buildParagraph)` returns `caretRect(index)`, `selectionRects(selection)`, and `indexAt(point)`, in the paragraph's space from its top left. It takes a function that builds a paragraph rather than a paragraph, since it lays out the `caretText` copy. `textLayerLayout.ts` builds it with its own `buildParagraph`, caches it by layer, and moves results to the layer's centered space.
3. **Input and caret.** `HiddenTextInput` (controlled: `value`, `selection`, `onChangeText`, `onSelectionChange`, `onFocusChange`, `onDone`, a `style` for where it sits, and a ref with `focus` and `select`). `Caret` (rect, color, halo, the size of a screen pixel as a shared value) and `SelectionHighlight` (rects, color). The web focus and selection workarounds in AGENTS.md move with them, as comments where they're handled.
4. **Gesture.** `useCanvasTextGesture({ text, toIndex, onSelect, onDone, onCursor })`, where `toIndex(x, y, clamp)` maps a view point to an index or null. Tap, drag, double tap, tap away, the second-finger cancel, and hover keep today's behavior; double tap timing comes from the editor's `createDoubleTap` as a parameter or a copy in the package.
5. **Ready to pack.** A README with the technique and the API, a `tsconfig.build.json` emitting `lib/` (`rewriteRelativeImportExtensions`), `publishConfig`, and a `pnpm pack` tried in a fresh Expo app. No publish.

## 5. Then: Text as a tool?

Text is the editor's own, not a tool, because it needs what no tool has: its own editor mode, styling a selected layer with nothing open, drawing its draft in place of the document's layer, and starting from a double tap on the canvas. Widening `defineTool` for one tool makes every tool's API harder to read, so the rule has been to wait for a second tool that needs the same.

Labelled arrows would be that tool. After step 4:

* Look at what's left in `editor/text/`, and sketch the two slots both would need: drawing a layer's draft in its place while it's edited, and starting from a double tap on a layer the tool owns.
* Build labelled arrows on the package. If they fit those slots, move Text to `tools/text/` with them; if they don't, the slots were wrong, and Text stays.
* An arrow's label sits along the arrow rather than in a text layer's box, so it's also the check that `createCaretLayout` and `toIndex` don't assume a text layer.

Making the editor itself a package is a separate decision, made when something outside the repo needs it.

## 6. Publishing, later

Publish when someone asks for it or Tuck isn't its only user, and the API has held still for a while.

* Remove `"private": true` (pnpm refuses to publish a private package) and add a `license`.
* Create the `tuck` organization on npm first (free for public packages), or rename the package if it's taken.
* `pnpm --dir packages/skia-text-input publish --access public` (a scoped package publishes as private without it) works from this private repository; pnpm turns `workspace:*` into the version.
* A private repository means no public source, issues, or npm provenance, and its `repository` link would 404. Ship `src/` in the tarball, and mirror the folder to a public repository with `git subtree split --prefix packages/skia-text-input` if it should be open.
* Choose a license for the package (the repository has none yet; see release-checklist §6).

Not built until someone needs them: right-to-left text, input method composition shown on the canvas, grapheme-aware word selection (`Intl.Segmenter`), up and down arrows by wrapped line, drag handles and the edit menu on touch, and a screen reader reading the drawn text.
