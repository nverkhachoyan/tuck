# Position C Rebuttal: Real-Device Evidence vs. Premature Rewrites & Synthetic Harnesses

## Rebuttal to Rival A (Runtime & Memory Architecture First)

### 1. Critiques of Specific Claims
- **Claim A1 (Premature Architectural Complexity vs. Simple Hotfix)**: Agent A proposes a heavy structural rewrite—decoupling live preview downsampling (~2048px) from export resolution (`src/photos/photoScale.ts` L7). Maintaining dual texture caches in `src/editor/render/decodedImages.ts` increases lifecycle complexity, risks visual parity mismatches (conceded in A's Known Weaknesses), and causes transient memory spikes when both resolutions coexist during export. Acute OOMs can be resolved with zero architectural risk via a targeted hotfix: reducing `MAX_PHOTO_PIXELS` from 25MP to 16MP or tightening `afterSkiaDraws` deallocation (`src/editor/render/decodedImages.ts` L22–24).
- **Claim A2 (Unprofiled Filter Caching Worsens VRAM Pressure)**: Agent A demands upfront `SkPicture` memoization and raster caching for `pixelateFilter` (`src/editor/layers/redaction/RedactionLayerView.tsx` L118–132). Offscreen raster caches consume additional GPU texture memory, directly worsening Tuck's #1 risk (OOMs). On web, multiple offscreen surfaces exhaust browser WebGL context limits (`src/editor/render/drawOffscreen.web.ts` L10–24). Caching before profiling on real mobile GPUs with Metal System Trace is premature optimization.
- **Claim A3 (Autosave and Serialization Do Not Block Worklets)**: `src/projects/projectLifecycle.ts` (L164) already debounces autosave by 500ms (`AUTOSAVE_DELAY_MS = 500`), running only after gestures cease. Furthermore, live drawing runs on the UI worklet thread (`react-native-worklets` in `package.json` L47), which is decoupled from the JS thread executing `JSON.stringify`. Re-architecting export rendering with cooperative yielding adds state complexity without evidence of interaction blocking.

### 2. Rival A's Strongest Point
Agent A correctly identifies that uncompressed 24MP camera images (~98 MB VRAM per layer, `src/photos/photoScale.ts` L7) are Tuck's single most lethal real-world crash risk, and rightly recognizes (in Claim A4) that synthetic Node.js and Playwright benchmarks are blind to mobile hardware realities.

### 3. Concessions
I concede that holding 24MP uncompressed textures in the active viewport provides negligible visual benefit on mobile screens and constitutes Tuck's primary crash hazard on memory-constrained devices.

### 4. Conditions Under Which Rival A Should Win
Position A should win if real-device profiling demonstrates that simple parameter tuning (e.g. lowering `MAX_PHOTO_PIXELS`) cannot prevent Jetsam terminations on 4GB/6GB iPhones, making structural preview decoupling unavoidable.

---

## Rebuttal to Rival B (Infrastructure & Benchmark Baselines First)

### 1. Critiques of Specific Claims
- **Claim B1 (Playwright Memory Tests Are Blind to GPU VRAM)**: Agent B asserts headless Playwright assertions detect memory leaks. Headless Chromium measures V8 JS heap (`performance.memory.usedJSHeapSize`), completely ignoring native GPU VRAM textures allocated by Skia in C++ via Metal/Vulkan (`package.json` L44). Furthermore, desktop CI environments cannot reproduce iOS Jetsam kills or Android Low Memory Killer (LMK) thresholds. B1's proposed test suite cannot detect the memory crashes it promises to prevent.
- **Claim B2 & B4 (V8 Node Microbenchmarks Measure the Wrong Engine)**: Agent B claims Tier 1 microbenchmarks in `node --test` protect worklet responsiveness for `geometry.ts` (L45–167) and `hitTest.ts` (L39–55). Node runs V8 with JIT loop unrolling and desktop CPU memory caching. Tuck's production runtime (`package.json` L40) is Hermes 0.88, an AOT bytecode interpreter without JIT. Measuring 50,000 iterations in Node optimizes for V8 quirks, not Hermes execution. Moreover, pure matrix math runs in nanoseconds; frame drops in Tuck stem from Skia GPU rasterization (`RedactionLayerView.tsx` L38–43), not CPU matrix inversions.
- **Claim B3 & B5 (Bespoke Harnesses Cause CI Bloat Without Averting Regressions)**: Agent B introduces Playwright browser downloads and flaky headless suites, destroying Tuck's lightweight millisecond test setup (`package.json` L14). Export fidelity and mathematical correctness are already verified by deterministic unit tests (`src/**/*.test.ts`). Adding synthetic benchmarks adds high maintenance drag with zero user-facing protection.

### 2. Rival B's Strongest Point
Agent B's strongest contribution is the proposal for lightweight, zero-overhead developer performance markers in `src/platform/perf.ts` (`tuck:image-decode`, `tuck:render-document`), which cleanly integrate with native profilers and Chrome DevTools.

### 3. Concessions
I concede that unmeasured refactoring carries regression risks, and that standardized `performance.mark` spans provide high diagnostic utility when kept dev-only and zero-cost.

### 4. Conditions Under Which Rival B Should Win
Position B should win if Tuck transitions to a large distributed team where automated CI regression gates are mandatory to prevent contributor code rot, and where desktop web is prioritized over mobile native parity.
