# Position B Opening Statement: Infrastructure & Benchmark Baselines First

Tuck's performance strategy must follow an uncompromising engineering axiom: **if you cannot measure it deterministically, you cannot optimize it safely**. Rushing into architectural overhauls—decoupling preview resolutions, rewriting Skia picture caches, or altering UI worklet execution—without automated benchmark baselines invites silent visual regressions, export corruption, and phantom optimizations. We must establish deterministic measurement infrastructure before altering delicate rendering pipelines.

### B1. Unmeasured Downsampling and Caching Invite Catastrophic Memory Regressions
**Criterion: OOM & Crash Prevention [30%]**  
In `src/photos/photoScale.ts` (L7), `MAX_PHOTO_PIXELS = 25_000_000` decodes 24MP photos into ~98 MB of uncompressed VRAM per layer. In `src/editor/render/drawOffscreen.web.ts` (L10–24), offscreen rendering relies on a shared `SkSurface` with a 10s idle timer specifically to avoid exhausting browser WebGL context limits (8–16 max). Furthermore, `src/editor/render/decodedImages.ts` (L21–25) coordinates texture disposal using `afterSkiaDraws` across two animation frames to prevent drawing deleted textures. Refactoring memory pipelines (e.g. preview downsampling or multi-surface caching) without Tier 2 headless Web Playwright tests asserting memory leak baselines (cycling 10 edit/export iterations) risks subtle lifecycle race conditions that trigger fatal browser context loss and native GPU panics.

### B2. Gesture Math and Hit-Testing Execute on UI Worklets Requiring Microsecond Baselines
**Criterion: Interaction Fidelity & Frame Rate [25%]**  
Tuck's gesture responsiveness depends on worklets running directly on the UI thread: `src/editor/document/geometry.ts` (L45–167: `cosSin`, `toLayerSpace`, `hitTestBox`, `transformMatrix`, `invertMatrix`), `src/editor/canvas/hitTest.ts` (L39–55: `findLayerAt`), and `src/editor/layers/strokes.ts` (L125–155: `segmentDistanceSquared`, `nearLine`) are all marked `"worklet"`. Within a 120Hz frame budget (8.3ms), UI thread budget is razor-thin. Prematurely modifying stroke simplification or spatial indexing without Tier 1 Node.js microbenchmarks (`src/editor/document/geometry.bench.ts`, `src/editor/canvas/hitTest.bench.ts` testing 50,000 iterations and 100-layer scenes) risks microsecond regressions that directly induce dropped frames and touch hitching.

### B3. Native Tooling and Zero-Cost Telemetry Avert Expensive Architectural Churn
**Criterion: Engineering Cost & Maintenance Overhead [20%]**  
`package.json` (L15) runs tests via native Node.js (`node --test`), proving Tuck values lightweight, dependency-free developer tooling. Tier 1 microbenchmarks run directly via `node --test` under `pnpm bench` with zero external dependencies. Standardized telemetry via `src/platform/perf.ts` wrapping `performance.mark` and `performance.measure` introduces zero production bundle overhead (tree-shaken outside `__DEV__`), complying with Constraint 3. Without standardized telemetry spans (`tuck:image-decode`, `tuck:render-document`, `tuck:export-encode`), engineers will waste dozens of hours debugging ad-hoc, unrepeatable profiling traces.

### B4. Tiered Measurement Isolates Algorithmic Math from Heterogeneous Engine Noise
**Criterion: Diagnostic Realism & Platform Parity [15%]**  
Tuck targets heterogeneous runtimes: React Native 0.88 with Hermes on iOS/Android, and Skia 2.15.2 across Metal, Vulkan, and WebGL/WASM (`package.json` L39–44). Manual profiling on a single platform conflates runtime JIT/AOT variance with algorithmic complexity. Tier 1 benchmarks isolate pure CPU algorithmic efficiency (geometry, color space, immutability mutations in `src/editor/document/documentEdits.ts`). Tier 2 Playwright benchmarks evaluate real-world Skia rendering pipelines under heavy shader workloads like `src/editor/layers/redaction/RedactionLayerView.tsx` (L38–120: multi-pass `samplePixels` and `BLUR_REACH = 3`).

### B5. Preview Decoupling and Cache Mutation Threaten Bit-for-Bit Export Fidelity
**Criterion: Architectural Safety & Regression Protection [10%]**  
Constraint 4 mandates absolute export fidelity. In `src/editor/render/drawOffscreen.web.ts` (L36–41), offscreen snapshots produce CPU non-texture images for export blobs. Decoupling editing resolution from export resolution or caching rasterized `SkPicture` trees before establishing automated visual regression and export throughput suites invites silent export corruption, sub-pixel rounding drift, and canvas clipping bugs. Automated test baselines guarantee architectural invariants remain inviolate.

---

### Known Weaknesses of Position B
1. **Engine Divergence**: Tier 1 Node.js benchmarks run on V8, which does not mirror Hermes bytecode execution, register-based memory allocation, or physical device thermal throttling.
2. **CI Footprint**: Tier 2 Playwright suites introduce browser automation overhead and require headless WebGL mocking, increasing CI execution time.
3. **Delayed Immediate Relief**: Prioritizing benchmark infrastructure delays shipping immediate hotfixes for acute 24MP VRAM pressure (`MAX_PHOTO_PIXELS`).
