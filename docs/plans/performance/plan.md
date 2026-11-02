# Performance Audit, Benchmarking & Telemetry Plan

A comprehensive plan for auditing performance, establishing telemetry and profiling infrastructure, building benchmark suites, and targeting hotspots in the Tuck codebase without introducing new features.

---

## 1. Principles & Architectural Constraints

Tuck is a fast, local-first photo markup and finishing utility. Any telemetry and benchmarking setup must adhere strictly to the project's foundational constraints:

1. **Zero Cloud Telemetry (Local & Dev-Only)**: In accordance with **Principle 2 ("The photo stays private. Everything runs on the device")**, Tuck must never emit telemetry, analytics, crash logs, or user metrics to remote servers. All profiling, telemetry, and diagnostics must be 100% local, developer-facing (`__DEV__`), and tree-shaken from production builds.
2. **CSP Compliance**: The Content Security Policy in `vercel.json` (`connect-src 'self'`) and offline service worker must not be violated by third-party tracing agents or SDKs.
3. **No Overhead in Production**: Instrumentation must introduce near-zero overhead when disabled and zero bundle size penalty in release builds.
4. **Adaptive Platform Parity**: Benchmarks and telemetry must cover iOS, Android, and Web, accounting for differences in JavaScript runtimes (Hermes on native vs V8/JSC on web) and Skia rendering backends (Metal on iOS, Vulkan/GLES on Android, WebGL/WASM on web).

---

## 2. Codebase Audit: Key Hotspots & Bottlenecks

### A. GPU Texture Memory & VRAM Pressure
* **Uncompressed High-Resolution Textures**: Photo layers decode up to `MAX_PHOTO_PIXELS` (25 million pixels). A 24MP iPhone photo requires **~98 MB of uncompressed GPU texture memory** per layer. Opening 3–5 high-res photos on mobile devices or in mobile browser tabs creates extreme VRAM pressure and out-of-memory risks.
* **Decoded Image Cache Lifecycle**: `src/editor/render/decodedImages.ts` defers freeing textures by two animation frames (`afterSkiaDraws`) to prevent Skia replaying disposed textures during pending frames. Under rapid layer churn, temporary texture spikes occur.
* **WebGL Context Limits on Web**: `src/editor/render/drawOffscreen.web.ts` pools a single shared offscreen surface with a 10s idle timer because creating independent WebGL surfaces exhausts browser context limits (typically 8–16 contexts maximum).

### B. Canvas Render Loop & Gesture Hitches (60 / 120 FPS)
* **Live Stroke Pipeline**: `usePaintGesture.ts` and `useToolStroke.ts` stream points into Reanimated shared values (`strokePoints`), rendering via `LiveStrokeOverlay`. On touch release, the stroke is committed to the Zustand store and document layer model. Long or intricate strokes (high point counts) increase path tessellation time.
* **Multi-Pass Redaction Filters**: The `pixelateFilter` (`src/editor/layers/redaction/pixelateFilter.ts`) composites blur, morphology, displacement, and color shaders. When applied over large areas or multiple redaction layers, Skia's offscreen passes can cause frame drops, particularly on mid-range Android devices and integrated web GPUs.
* **Layer Transform Synchronization**: Continuous pan/pinch/rotate operations mutate live shared values. Ensuring zero React rerenders during gestures is critical to maintaining a hitch-free 120Hz display refresh rate.

### C. On-Device AI / ML Inference Latency
* **MobileSAM (Cut & Tap Tools)**:
  * Model weights add ~44 MB to the bundle/assets, plus ~34 MB for Android's ONNX Runtime arm64 binaries.
  * Cold start: iOS CoreML model compilation takes ~3s on the first tap after app launch (vs ~250ms warm).
  * Web encoding: Single-threaded WebAssembly takes ~3s to encode a 1024px photo.
* **Face & Text Detection**: `mediaPipe.ts` and `tesseractText.ts` divide large images into tiles (`faceTiles.ts`). Tile serialization and worker transfer overhead can cause perceptible pauses on low-power devices.

### D. Project Autosave & Storage I/O
* **Autosave Pipeline**: Handled in `src/projects/projectLifecycle.ts`. Autosaves serialize document JSON, generate offscreen thumbnails (`renderThumbnail`), and write to storage (IndexedDB on web, filesystem on native). Heavy export or thumbnail generation must never block the main/UI thread during ongoing canvas interactions.

---

## 3. Profiling & Telemetry Architecture

Because remote telemetry services are excluded by design, telemetry consists of **in-app diagnostic instrumentation** and **standardized developer inspection hooks**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tuck Developer Telemetry                        │
├──────────────────────────┬────────────────────────┬────────────────────┤
│       In-App HUD         │    User Timing API     │   Native Profilers │
│       (`__DEV__`)        │  (Chrome / Safari Dev) │  (Xcode / Perfetto)│
├──────────────────────────┼────────────────────────┼────────────────────┤
│ • Real-time FPS / Delta  │ • tuck:image-decode    │ • Hermes CPU Profile│
│ • Skia frame time        │ • tuck:canvas-render   │ • GPU Metal capture│
│ • Texture cache count    │ • tuck:export-render   │ • Native memory    │
│ • Estimated VRAM MB      │ • tuck:sam-encode      │ • Vsync hitch rate │
│ • JS heap size (web)     │ • tuck:autosave-io     │ • Choreographer    │
└──────────────────────────┴────────────────────────┴────────────────────┘
```

### 1. In-App Performance Diagnostics HUD (Dev Only)
A lightweight diagnostic HUD toggleable via debug shortcut or settings in `__DEV__` mode:
* **Frame Rate & Hitch Monitor**: Uses `requestAnimationFrame` / `useFrameCallback` to track frame deltas, rolling average FPS, and count jank frames (>16.6ms at 60Hz, >8.3ms at 120Hz).
* **VRAM / Decoded Texture Monitor**: Reads the internal count and pixel footprint of `decodedImages` to surface live VRAM consumption.
* **JS Heap Monitor (Web)**: Reads `(performance as any).memory?.usedJSHeapSize` to detect memory creep.

### 2. Standardized Performance Spans (`src/platform/perf.ts`)
A zero-cost wrapper around `performance.mark` and `performance.measure` that automatically integrates with browser DevTools and native Hermes tracing:
* `tuck:image-decode` (start of file read -> Skia image decoded)
* `tuck:render-document` (offscreen scene render duration)
* `tuck:export-encode` (Skia snapshot -> PNG/JPEG file/blob output)
* `tuck:sam-encode` / `tuck:sam-decode` (MobileSAM image embedding & mask generation)
* `tuck:detection-scan` (Face / OCR detection passes)
* `tuck:autosave-write` (Document serialization & storage commit)

### 3. Native & Browser Profiling Guide
* **Web**: Chrome DevTools Performance panel (with CPU & network throttling), Memory Allocation Timeline, and WebGL Inspector extension.
* **iOS**: Xcode Instruments (`Time Profiler`, `Allocations`, `Metal System Trace`) connected to a Release development build (`expo run:ios --configuration Release`).
* **Android**: Android Studio Profiler (CPU flame graphs, memory allocations) and `Perfetto` system tracing to isolate Choreographer frame drops.
* **Hermes**: Capture Hermes sampling profiles via React Native Dev Menu / `npx react-native profile-hermes` to identify JS hotspots.

---

## 4. Benchmark Suite Setup

The benchmark setup is divided into three deterministic tiers.

### Tier 1: Deterministic Node.js Microbenchmarks
* **Runner**: Runs natively using `node --test` (matching existing test runner setup).
* **Location**: `src/**/*.bench.ts`.
* **Targets**:
  1. **Geometry Math (`src/editor/document/geometry.bench.ts`)**: Benchmark matrix inversions, box intersections, and coordinate space transformations across 50,000 iterations.
  2. **Layer Bounds & Hit Testing (`src/editor/canvas/hitTest.bench.ts`)**: Measure hit-testing performance against scenes containing 10, 50, and 100 mixed layers.
  3. **Stroke Simplification & Path Building (`src/editor/layers/strokes.bench.ts`)**: Benchmark path point reduction, stroke bounding box computation, and stroke hit tests.
  4. **Document Edits & Immutability (`src/editor/document/documentEdits.bench.ts`)**: Profile document mutation operations (cropping, reordering, adding/removing layers) on large documents.
  5. **Color Space Math (`src/ui/color.bench.ts`)**: Measure HSV-to-hex, hex-to-HSV, and pixel buffer averaging throughput.

### Tier 2: Headless Web Performance & Memory Benchmarks
* **Runner**: Headless browser automation (Playwright) against the production web export (`pnpm build:web`).
* **Scenarios**:
  1. **High-Resolution Photo Loading**:
     - Load 2MP, 12MP, and 24MP images into the canvas.
     - Measure time to first render and memory increase.
  2. **Multi-Stroke Drawing Stress Test**:
     - Simulate 100 continuous freehand pen and highlighter strokes.
     - Record dropped frames and time to commit to document state.
  3. **Redaction Stacking Benchmark**:
     - Apply 10 overlapping pixelated and blurred redaction boxes.
     - Measure frame duration during viewport zoom and pan.
  4. **Export Throughput Benchmark**:
     - Export a multi-layer document at 1080p, 4K, and native photo resolution.
     - Measure time from export trigger to downloadable blob creation.
  5. **Memory Leak & Context Retention Suite**:
     - Cycle opening a project, performing edits, exporting, and closing 10 consecutive times.
     - Assert that JS heap and active WebGL textures return to baseline.

### Tier 3: ML Inference Latency Benchmarks
* Benchmark scripts testing `modules/image-analysis`:
  - MobileSAM image encoder latency on standard test fixtures (512px, 1024px, 2048px).
  - MobileSAM decoder tap-to-mask latency.
  - Face detection on the Solvay reference photo across backends (MediaPipe vs Apple Vision vs ML Kit).

---

## 5. Performance Optimization Roadmap (No New Features)

Once measurement and telemetry tooling are in place, optimizations will be tackled in order of impact:

| Phase | Focus Area | Goal | Verification Metric |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Measurement Baseline** | Implement `src/platform/perf.ts` and Tier 1 Node benchmarks | Baseline metrics recorded in CI/dev |
| **Phase 2** | **Canvas VRAM Reduction** | Decouple editing preview resolution (e.g. 2048px) from export resolution | ~8x VRAM reduction on 24MP photos |
| **Phase 3** | **WASM Multi-Threading** | Enable COOP/COEP headers for multi-threaded MobileSAM web encoding | Web SAM encode drops from ~3s to ~1s |
| **Phase 4** | **Filter Memoization** | Cache rasterized `SkPicture` / filter buffers for static redactions | Zero dropped frames on pan/zoom |
| **Phase 5** | **Export & I/O Yielding** | Yield UI thread during heavy offscreen renders and project serialization | Zero interaction hitching during autosave |

---

## 6. Execution Steps

1. **Scaffold Telemetry Utility**:
   - Create `src/platform/perf.ts` and `src/platform/perf.web.ts` using the User Timing API (`performance.mark`/`measure`).
2. **Implement Node.js Benchmark Suite**:
   - Add initial benchmark scripts in `src/editor/document/geometry.bench.ts` and `src/editor/canvas/hitTest.bench.ts`.
   - Add a `pnpm bench` script to `package.json`.
3. **Add Dev Diagnostic Overlay**:
   - Create a lightweight diagnostic component in `src/editor/shell/` displaying live frame times and texture cache stats.
4. **Run Baseline Audit & Document Findings**:
   - Run the benchmark suite and document baseline numbers in `docs/plans/performance/baselines.md`.
