# Position C Opening: Minimalist Native Profiling & Targeted Hotfixes Only

## Executive Summary
Position C argues that Tuck should firmly reject bespoke automated benchmarking infrastructure—specifically Node.js microbenchmarks and headless Playwright suites. These synthetic harnesses are fundamentally unrepresentative of mobile hardware, introduce crippling CI bloat and ongoing maintenance overhead, and produce misleading metrics. Instead, Tuck must maintain its lean testing setup, implement zero-overhead developer markers (`src/platform/perf.ts`) and an in-app Dev HUD, and rely directly on industry-standard native platform profilers (Xcode Instruments, Android Studio Profiler, Chrome DevTools) to identify real bottlenecks on physical devices and execute targeted hotfixes on-demand.

---

## Numbered Claims

### Claim C1: Diagnostic Realism & Platform Parity (15%)
**Synthetic Node.js and Playwright benchmarks suffer from fatal runtime and graphics divergence.**
Node.js executes on desktop V8 with JIT compilation. Tuck's native production runtime (`package.json#L40`) is Hermes (`react-native: 0.88.0`), an AOT bytecode interpreter without JIT, featuring entirely different garbage collection characteristics, memory layout, and execution throughput. Benchmarking geometry operations (`src/editor/document/geometry.ts`) or document mutations in Node measures V8 optimizations that do not translate to Hermes. Similarly, headless Playwright runs desktop Chromium with WebGL rasterization. It completely fails to reflect React Native Skia 2.15.2's native GPU backends: Metal on iOS and Vulkan on Android. Optimizing against WebGL or V8 risks tuning for the wrong platform.

### Claim C2: OOM & Crash Prevention (30%)
**Desktop CI environments cannot simulate mobile unified memory constraints or OS-level OOM killers.**
In Tuck, `MAX_PHOTO_PIXELS = 25_000_000` (`src/photos/photoScale.ts#L7`). Decoding a single 24MP image allocates ~98 MB of uncompressed GPU texture memory (`src/editor/render/decodedImages.ts#L9-L11`), and `afterSkiaDraws` intentionally defers texture deallocation across two animation frames (`src/editor/render/decodedImages.ts#L22-L24`). In headless Playwright running on a 32GB CI runner, 100 MB texture allocations produce zero memory pressure. On an iOS device with a strict per-process memory limit (~1.4–2 GB under Jetsam), opening multiple photos causes abrupt, uncatchable termination. Playwright cannot reproduce Jetsam kills or Android Low Memory Killer (LMK) events. Only native profilers (Xcode Allocations/Leaks and Android Memory Profiler) connected to physical devices reveal genuine memory thresholds.

### Claim C3: Interaction Fidelity & Frame Rate (25%)
**Headless browser automation cannot capture touch digitizer mechanics, display link synchronization, or worklet thread contention.**
Tuck's gesture pipeline relies on `react-native-gesture-handler` (`package.json#L41`), `react-native-reanimated` (`package.json#L42`), and `react-native-worklets` (`package.json#L47`), streaming touch coordinates directly to the UI thread. Headless Playwright simulates desktop mouse events via Chrome DevTools Protocol (CDP) into a single-threaded WebGL canvas. It bypasses native 120Hz touch scanning, iOS `CADisplayLink`, Android `Choreographer`, and native worklet thread scheduling. Playwright cannot accurately measure gesture hitching caused by multi-pass redaction filters (`BLUR_REACH = 3`, `PIXEL_BLUR = 1/3` in `src/editor/layers/redaction/RedactionLayerView.tsx#L38-L43`). True hitch rates and frame drops can only be diagnosed using Xcode Instruments (Metal System Trace) and Android Perfetto on physical devices.

### Claim C4: Engineering Cost & Maintenance Overhead (20%)
**Bespoke CI benchmark harnesses create continuous maintenance drag and CI flakiness for zero user benefit.**
Tuck's test suite currently runs in milliseconds using native `node --test` (`package.json#L14`). Introducing Playwright adds multi-gigabyte browser binaries, slow headless runs, and brittle timing thresholds sensitive to CI hardware variance. Engineering hours spent maintaining synthetic benchmark baselines provide zero user-facing value. In contrast, adding standard `performance.mark` instrumentation (`src/platform/perf.ts`) and an in-app `__DEV__` HUD gives developers instantaneous, real-time feedback with zero production bundle overhead and strict adherence to Tuck's offline, zero-telemetry CSP (`vercel.json`).

### Claim C5: Architectural Safety & Regression Protection (10%)
**Targeted on-demand hotfixes avoid speculative architectural refactoring that risks export and visual fidelity.**
Heavy architectural rewrites (such as speculative downsampling or asynchronous export yielding in `src/editor/render/drawOffscreen.web.ts#L23-L45`) introduce risks of visual artifacts and document corruption. Existing unit tests (`src/**/*.test.ts`) already safeguard mathematical correctness and document integrity. Profiler-guided hotfixes address verified bottlenecks with surgical precision, preserving bit-for-bit export parity.

---

## Known Weaknesses
Position C trades automated CI regression gating for diagnostic fidelity. Without automated performance tests in CI, performance regressions can only be detected during manual developer profiling sessions or pre-release testing. Furthermore, physical device profiling requires access to representative iOS and Android test hardware, placing greater reliance on developer discipline rather than automated merge blocks.
