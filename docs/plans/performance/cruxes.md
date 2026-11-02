# Gate: Cruxes of the Tuck Performance Strategy Debate

Following the Step 1 Openings and Step 2 Cross-Rebuttals, all three debaters have established clear points of consensus while identifying three sharp, contested, evidence-backed architectural cruxes that remain unresolved.

---

## Points of Convergence & Unanimous Concessions
1. **The 24MP Texture VRAM Hazard is Tuck's #1 Crash Risk**: All agents concede that decoding 24MP images into uncompressed ~98 MB GPU textures (`src/photos/photoScale.ts#L7`, `src/editor/render/decodedImages.ts#L9-L13`) for display on a 1080p/Retina viewport provides zero perceptible visual benefit while directly precipitating fatal OS Jetsam kills on iOS and browser tab crashes on web.
2. **Synthetic Benchmarks Have Critical Platform Blind Spots**: Agent B explicitly conceded to Agents A and C that Node.js V8 microbenchmarks cannot simulate Hermes AOT bytecode execution, and headless Playwright in Chromium cannot simulate iOS Jetsam limits, Android Low Memory Killer (LMK), Metal/Vulkan GPU scheduling, or physical 120Hz touch digitizer response.
3. **Zero-Cost Developer Performance Spans are Essential**: All three agents agree that `src/platform/perf.ts` wrapping `performance.mark` and `performance.measure` provides clean, standardized diagnostic tracing across DevTools, Hermes, and native profilers with zero release-bundle overhead and full CSP compliance (`connect-src 'self'`).
4. **Export Fidelity Invariants Must Remain Inviolate**: All agents agree that no performance optimization or downsampling technique may degrade the bit-for-bit quality of exported high-resolution renders (`src/editor/render/renderDocument.tsx`).

---

## Contested Cruxes

### Crux 1: Structural Preview Decoupling vs. Parameter Tuning & Hotfixes
- **Position A**: Structural decoupling (Phase 2: downsampling the interactive canvas to ~2048px while reserving full-resolution decode exclusively for offscreen export) is an urgent architectural necessity. On documents with multiple photo layers, no simple parameter tweak can prevent VRAM exhaustion under the current `afterSkiaDraws` two-frame deferral model.
- **Position C**: Structural decoupling introduces complex dual-cache lifecycles (`imageCache.ts`), risk of mipmap blur/visual degradation during deep pinch-zoom, and transient memory spikes when both preview and full-res textures coexist during export. Acute OOMs can be resolved with zero architectural risk via targeted parameter tuning: reducing `MAX_PHOTO_PIXELS` from 25MP to 16MP and tightening deallocation in `afterSkiaDraws`.
- **Position B**: Structural preview decoupling without automated memory regression suites risks subtle WebGL context exhaustion (`drawOffscreen.web.ts`) and texture disposal race conditions.
- **Hinges on**: Can simple parameter tuning (`MAX_PHOTO_PIXELS` reduction and disposal timing) reliably prevent Jetsam terminations on 4GB/6GB mobile devices with multi-layer documents without unacceptably degrading export quality, or is structural decoupling between interactive preview and offscreen export mandatory despite added cache lifecycle complexity?

### Crux 2: Deterministic Worklet Math Microbenchmarks vs. Diagnostic Engine Divergence
- **Position B**: Pure CPU math in UI worklets (`src/editor/document/geometry.ts`, `src/editor/canvas/hitTest.ts`, `src/editor/layers/strokes.ts`) runs within an 8.3ms frame budget (120Hz). Algorithmic regressions ($O(N) \to O(N^2)$) affect Hermes just as they affect V8. Zero-dependency Node.js microbenchmarks (`node --test`) catch algorithmic regressions in milliseconds in CI before code reaches native devices.
- **Positions A & C**: Pure geometric matrix math takes nanoseconds and is never the source of gesture drops in Tuck. Gesture hitches are overwhelmingly dominated by GPU rasterization of unmemoized multi-pass redaction shaders (`RedactionLayerView.tsx`). Furthermore, Node.js runs V8 JIT, which has completely different optimization and loop-unrolling characteristics than Hermes 0.88 AOT bytecode. Synthetic Node benchmarks optimize for the wrong engine and create false confidence.
- **Hinges on**: Do UI worklet algorithms in Tuck carry a realistic risk of CPU performance regressions that justify maintaining Node microbenchmarks in CI, or are frame drops so overwhelmingly dominated by Skia GPU shader rasterization that CPU microbenchmarks divert focus to phantom bottlenecks?

### Crux 3: Headless Web End-to-End Testing (Playwright) vs. In-App Dev HUD & Native Profilers
- **Position B**: Headless browser automation (Playwright) is the only tool that can deterministically assert WebGL context retention, monitor JS heap growth slopes across multi-step project edit/export lifecycles (`src/editor/render/drawOffscreen.web.ts`), and prevent WebGL context exhaustion in CI.
- **Positions A & C**: Headless Playwright introduces multi-gigabyte browser dependencies, slow CI pipelines, and high maintenance drag, while being completely blind to native GPU VRAM (allocated in C++ via Metal/Vulkan) and mobile Jetsam thresholds. A lightweight in-app Dev HUD and native profilers (Xcode Instruments, Android Studio Profiler) provide true diagnostic fidelity with zero CI maintenance overhead.
- **Hinges on**: Does automated WebGL context and heap regression testing in CI provide sufficient value for the web platform to justify the maintenance and CI execution burden of a headless browser framework, or should Tuck rely exclusively on dev-only HUD telemetry and platform profilers?
