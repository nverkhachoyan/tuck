# Position B Rebuttal: Cross-Examination of Positions A and C

## Rebuttal to Rival A (Position A: Runtime & Memory Architecture First)

### 1. Critiques of Specific Claims
- **Critique of Claim A1 (Unmeasured Downsampling Risks Context Crashes)**: Agent A admits in "Known Weaknesses #3" that preview downsampling escalates cache lifecycle complexity across `imageCache.ts` and `EditorScene.tsx`. In `src/editor/render/decodedImages.ts` (L21–25), texture disposal relies on `afterSkiaDraws` (a 2-frame RAF delay) to prevent Skia replaying deleted textures. Furthermore, `src/editor/render/drawOffscreen.web.ts` (L10–24) maintains a single pooled `SkSurface` due to strict browser WebGL context limits (8–16 max). Modifying texture downsampling without automated Playwright leak regression suites (Tier 2 Scenario 5) will introduce race conditions where offscreen surfaces and interactive viewports exhaust WebGL contexts or draw disposed textures during rapid project switching.
- **Critique of Claim A2 (Premature Picture Memoization Degrades Zoom Quality)**: Agent A advocates caching rasterized `SkPicture` buffers for redactions. But in `src/editor/layers/redaction/RedactionLayerView.tsx` (L63–101), `pixelateFilter` dynamically calculates linear gradients and displacement maps via `samplePixels` based on canvas scale (`layerBlur` L73–77). Memoizing static `SkPicture` buffers without Tier 1 microbenchmarks and visual regression tests risks sub-pixel blur degradation during live pinch-to-zoom, while inflating memory by holding redundant raster caches.
- **Critique of Claim A4 (Node Benchmarks Protect Pure Math Worklets)**: Agent A dismisses Node microbenchmarks as blind to Hermes. However, `src/editor/document/geometry.ts` (L45–167: `toLayerSpace`, `transformMatrix`, `invertMatrix`) and `src/editor/canvas/hitTest.ts` (L39–55: `findLayerAt`) are pure algorithmic math executed inside UI worklets. Algorithmic regressions ($O(N)$ to $O(N^2)$ stroke scaling in `strokes.ts` L125–155) degrade performance on Hermes just as they do on V8. Tier 1 benchmarks catch these bugs in milliseconds in CI before they reach native devices.

### 2. Rival A's Strongest Point
Claim A1 correctly identifies that decoding full 24MP images (~98 MB uncompressed VRAM per layer, `src/photos/photoScale.ts#L7`) for a 1080p mobile viewport provides zero user-perceptible benefit while directly triggering OS jetsam kills.

### 3. Concessions
We concede that Tier 1 Node.js microbenchmarks cannot simulate GPU texture memory allocations or prevent native mobile jetsam crashes. Downsampling preview textures is an architectural necessity that synthetic CPU tests cannot replace.

### 4. Conditions Under Which Rival A Should Win
Position A is correct if real-world crash logs indicate that >10% of user sessions immediately terminate from jetsam OOMs upon opening 24MP photos, making emergency memory relief more urgent than automated regression safety.

---

## Rebuttal to Rival C (Position C: Minimalist Native Profiling & Targeted Hotfixes Only)

### 1. Critiques of Specific Claims
- **Critique of Claims C1 & C3 (Worklet Algorithms Require Automated CI Gates)**: Agent C claims Node and Playwright benchmarks are useless because they do not run Hermes or Metal. Yet `src/editor/document/geometry.ts` (L45–167), `src/editor/canvas/hitTest.ts` (L39–55), and `src/editor/layers/strokes.ts` (L125–155) are marked `"worklet"` to execute on the UI thread during gestures. These are pure CPU math algorithms. Forcing developers to connect Xcode Instruments or Android Perfetto to detect an unintended algorithmic slowdown in `segmentDistanceSquared` or `invertMatrix` introduces unacceptable friction. Automated Node.js microbenchmarks catch algorithmic regressions instantaneously on every PR.
- **Critique of Claim C2 (Playwright Catches WebGL Leaks Deterministically)**: Agent C argues desktop CI cannot simulate memory constraints. While headless Chromium cannot replicate iOS Jetsam thresholds, it *does* deterministically assert WebGL texture context counts and track heap growth slopes via `(performance as any).memory?.usedJSHeapSize` across repeated open/edit/export cycles (`src/editor/render/drawOffscreen.web.ts` L10–48). Relying solely on manual native profiling leaves web users vulnerable to silent browser tab crashes.
- **Critique of Claims C4 & C5 (Manual Profiling Accrues Severe Regression Debt)**: Agent C argues benchmark suites add maintenance drag. However, Tuck already uses native `node --test` (`package.json#L15`); Tier 1 microbenchmarks require zero new dependencies and run in milliseconds. Rejecting automated CI benchmarks shifts the testing burden entirely onto manual developer discipline. Without automated gates, performance silently rots between releases, requiring expensive profiling forensics instead of continuous verification.

### 2. Rival C's Strongest Point
Claims C1 and C3 are irrefutable: headless desktop Playwright over CDP cannot faithfully simulate physical touch digitizer sampling, iOS `CADisplayLink`, Android `Choreographer` vsync cadence, or GPU command submission on Metal/Vulkan hardware.

### 3. Concessions
We concede that headless browser benchmarks cannot replicate mobile thermal throttling, native gesture dispatch latency, or OS-level Jetsam termination thresholds, and that native platform profilers remain indispensable for final frame-budget validation.

### 4. Conditions Under Which Rival C Should Win
Position C is the right choice if Tuck is maintained by a solo developer with dedicated iOS/Android test benches who prioritizes zero-dependency CI speed, where the operational cost of managing Playwright browser binaries in CI exceeds the risk of regressions slipping into production.
