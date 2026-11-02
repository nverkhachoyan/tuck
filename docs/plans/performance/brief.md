# Structured Debate Brief: Tuck Performance Engineering Strategy

## 1. Decision to be Decided
What should be the sequencing, scope, and technical priority for executing the Performance Audit, Benchmarking & Telemetry Plan (`docs/plans/performance/plan.md`) in Tuck?

Specifically, which architectural philosophy and roadmap sequencing should govern Tuck's performance engineering:

- **Position A (Runtime & Memory Architecture First):**
  Prioritize immediate structural mitigations for the known catastrophic bottlenecks: Decouple editing preview resolution from export resolution (Phase 2 downsampling), memoize multi-pass Skia redaction filter trees / `SkPicture` (Phase 4), and yield the UI thread during offscreen exports and serialization (Phase 5). Rely on lightweight in-app Dev HUD and targeted manual profiling. Reject building heavy synthetic benchmark suites (Node.js microbenchmarks and Playwright headless suites) upfront as premature over-engineering that diverts scarce focus from urgent VRAM OOMs and gesture hitches.

- **Position B (Infrastructure & Benchmark Baselines First):**
  Prioritize deterministic measurement tooling and automated test suites before making architectural canvas or memory changes: Implement `src/platform/perf.ts` User Timing spans, Node.js deterministic microbenchmarks (`src/**/*.bench.ts` for geometry math, hit testing, stroke simplification, and document edits), and automated Playwright headless web performance benchmarks (high-res photo load times, gesture stress tests, memory leak assertions). Enforce hard CI baselines to guarantee that future optimizations produce measurable gains and introduce zero visual or math regressions.

- **Position C (Minimalist Native Profiling & Targeted Hotfixes Only):**
  Reject bespoke automated benchmarking suites (both Node microbenchmarks and headless Playwright) as unrepresentative of mobile React Native runtimes (Hermes vs V8, Metal/Vulkan vs WebGL). Maintain status quo testing while adding only standardized developer performance markers and an in-app diagnostic HUD. Rely directly on industry-standard platform profilers (Xcode Instruments, Android Studio Profiler, Chrome DevTools) to identify hotspots on real devices, fixing issues on-demand with zero ongoing test suite maintenance overhead.

---

## 2. Weighted Evaluation Criteria
All debate arguments, trade-offs, and final synthesis must be evaluated against these five criteria (summing to 100%):

1. **OOM & Crash Prevention (30%)**: Mitigating immediate out-of-memory crashes, texture allocation failures, and severe memory pressure on memory-constrained mobile devices and web browser tabs.
2. **Interaction Fidelity & Frame Rate (25%)**: Guaranteeing hitch-free 60/120 FPS drawing gestures, responsive pan/pinch/zoom, and zero frame drops on native touch displays.
3. **Engineering Cost & Maintenance Overhead (20%)**: Minimizing codebase complexity, CI execution time, brittle benchmark maintenance, and bit rot across platform updates.
4. **Diagnostic Realism & Platform Parity (15%)**: Ensuring performance diagnostics accurately reflect real-world hardware behavior across iOS (Metal/Hermes), Android (Vulkan/Hermes), and Web (WebGL/WASM).
5. **Architectural Safety & Regression Protection (10%)**: Preventing regressions in export quality, layer math, and document integrity when optimizations are introduced.

---

## 3. Hard Constraints
Any proposal or argument must strictly adhere to Tuck's non-negotiable architectural invariants:

1. **Zero Cloud Telemetry (Local & Dev-Only)**: In accordance with Tuck Principle 2 ("The photo stays private. Everything runs on the device"), Tuck must never emit telemetry, analytics, crash logs, or user metrics to remote servers. All instrumentation must be 100% local, developer-facing (`__DEV__`), and tree-shaken from production builds.
2. **CSP Compliance**: The Content Security Policy in `vercel.json` (`connect-src 'self'`) and offline service worker must not be violated by third-party tracing agents, profilers, or SDKs.
3. **Zero Production Runtime / Bundle Overhead**: Instrumentation must introduce near-zero overhead when disabled and zero bundle size penalty in release builds.
4. **Visual & Export Parity**: Decoupling preview resolutions or caching must never degrade the bit-for-bit fidelity of exported high-resolution images.

---

## 4. Shared Context & Repository Facts
All debaters must ground their claims in the actual codebase facts and numbers:

- **Photo Scaling & Pixel Limits**: `src/photos/photoScale.ts` (L7) defines `MAX_PHOTO_PIXELS = 25_000_000` (~25 MP). A 24MP iPhone image is decoded into full uncompressed GPU texture memory (~98 MB VRAM per layer).
- **Decoded Image Cache**: `src/editor/render/decodedImages.ts` and `src/editor/render/imageCache.ts` use an `afterSkiaDraws` mechanism (two animation frames) before calling `image.dispose()` to prevent Skia replaying disposed textures during pending frames.
- **Offscreen WebGL Limits**: `src/editor/render/drawOffscreen.web.ts` maintains a single shared `SkSurface` with a 10s idle timer because creating independent WebGL surfaces exhausts browser context limits (typically 8–16 contexts).
- **Redaction Shaders**: `src/editor/layers/redaction/RedactionLayerView.tsx` implements multi-pass pixelation and Gaussian blurs (`BLUR_REACH = 3`, `PIXEL_BLUR = 1/3`, `PIXEL_SAMPLES`), causing heavy shader evaluation during interactive gestures.
- **Test Infrastructure**: `package.json` runs tests using native Node.js: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "src/**/*.test.ts" ...`. There is currently no `pnpm bench` script, no Playwright setup, and no `src/platform/perf.ts` span infrastructure.
- **Platforms & Runtimes**: React Native 0.88 with Hermes engine on iOS/Android; React Native Skia 2.15.2 (Metal on iOS, Vulkan/GLES on Android, WebGL/WASM on web); Expo SDK ~58.
