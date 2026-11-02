# Position B Closing Statement: Focused, Zero-Dependency Baselines

Having absorbed the critiques from Positions A and C, Position B presents a refined, pragmatic synthesis that eliminates synthetic CI bloat while preserving deterministic regression defense.

### Crux 1: Structural Decoupling is Mandatory, Gated by Lightweight Invariants
Position C’s proposal to reduce `MAX_PHOTO_PIXELS` from 25MP to 16MP is insufficient: 16MP still allocates ~64 MB of VRAM per layer, guaranteeing fatal Jetsam kills on 3–5 layer documents under `afterSkiaDraws`. We concede to Position A that structural preview decoupling (Phase 2, ~2048px interactive canvas) is architecturally mandatory. However, rather than requiring heavy browser harnesses, we narrow our demand: decouple preview from export immediately, but enforce strict unit-test assertions verifying texture cache disposal lifecycles (`src/editor/render/imageCache.ts`) to prevent WebGL context exhaustion in `drawOffscreen.web.ts`.

### Crux 2: Retain Zero-Dependency Node Benchmarks Strictly for Scaling Math
We concede that simple affine matrix inversion in `geometry.ts` is nanosecond-fast. However, stroke hit-testing (`src/editor/layers/strokes.ts#L125-L155`) and layer hit-testing (`src/editor/canvas/hitTest.ts#L39-L55`) execute inside UI worklets during 120Hz gestures. An unintended $O(N^2)$ complexity regression across 100 layers will hitch the frame budget on Hermes just as on V8. Using Tuck’s existing native `node --test` runner (`package.json#L15`) incurs zero new dependencies or CI cost, catching algorithmic regressions in milliseconds.

### Crux 3: Concede Playwright; Adopt In-App Dev HUD and Native Profilers
We formally withdraw the proposal for headless Playwright CI automation. The maintenance overhead, multi-gigabyte browser binaries, and blindness to native Metal/Vulkan unified memory make Playwright unjustifiable. We converge with Positions A and C on standardized `src/platform/perf.ts` User Timing spans, an in-app `__DEV__` diagnostic HUD for live VRAM tracking, and targeted native profiling (Xcode Instruments / Perfetto).
