# Position C Closing Statement: Final Revised Position

### Crux 1: Preview Decoupling vs. Parameter Tuning & Hotfixes
I concede that for multi-photo documents, lowering `MAX_PHOTO_PIXELS` (from 25MP to 16MP) is a stopgap, not a complete ceiling against Jetsam kills. However, rushing into complex dual-cache architectures risks memory spikes during export. **Resolution**: Apply the 16MP limit and tightened `afterSkiaDraws` disposal as an immediate zero-risk hotfix. Only graduate to structural preview decoupling if Xcode Allocations on 4GB devices proves multi-layer memory exhaustion persists.

### Crux 2: Worklet Math Microbenchmarks vs. Diagnostic Engine Divergence
Node.js V8 microbenchmarks remain fundamentally flawed. Nanosecond matrix arithmetic in `geometry.ts` does not cause frame hitches; GPU shader evaluation in `RedactionLayerView.tsx` does. Benchmarking V8 JIT in CI diverts focus to phantom bottlenecks while remaining blind to Hermes 0.88 AOT bytecode and Metal/Vulkan command buffers. **Resolution**: Reject Node microbenchmarks entirely. Enforce frame budgets via physical device profiling (Metal System Trace and Perfetto).

### Crux 3: Headless Playwright vs. Dev HUD & Native Profilers
Playwright in CI introduces massive browser bloat to measure desktop V8 JS heap, remaining blind to native C++ Skia GPU VRAM and mobile Jetsam thresholds. WebGL surface limits (`drawOffscreen.web.ts`) are already protected by a pooled surface. **Resolution**: Reject Playwright. Rely on the lightweight `__DEV__` HUD, zero-cost `src/platform/perf.ts` marks, and native profilers.

### Final Revised Position
Position C narrows to **Targeted Hotfixes & Native Profiling First, Zero Bespoke Harnesses**.
1. **Adopt**: Immediate 16MP hotfix, `src/platform/perf.ts` User Timing spans, and in-app Dev HUD.
2. **Stage**: Defer preview downsampling until verified necessary by real-device profiling.
3. **Reject**: Eliminate Node microbenchmarks and Playwright CI infrastructure permanently to preserve Tuck's lean, dependency-free development velocity.
