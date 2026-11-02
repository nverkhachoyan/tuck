# Position A: Runtime & Memory Architecture First

Tuck's performance strategy must prioritize immediate architectural interventions over synthetic benchmark suites. Mobile photo markup utilities live or die by memory stability and interaction smoothness. Today, Tuck suffers from critical, well-documented bottlenecks that cause fatal out-of-memory (OOM) crashes and frame hitches on real devices. Constructing synthetic Node.js microbenchmarks and headless Playwright suites before resolving these flaws is premature over-engineering that wastes scarce engineering cycles on tests blind to native mobile realities.

---

### Claim A1: Decoupling Preview from Export Resolution is Urgent to Prevent Fatal OOM Crashes
**Criteria: OOM & Crash Prevention (30%)**
- **Repository Evidence**: `src/photos/photoScale.ts` (L7) defines `MAX_PHOTO_PIXELS = 25_000_000` (~25 MP). Standard 24MP iPhone photos (5712×4284) decode into uncompressed RGBA GPU textures consuming ~98 MB of VRAM per layer. `src/editor/render/decodedImages.ts` (L9–13, L28) and `src/editor/render/useDecodedImage.ts` (L38–42) load these full-resolution textures directly into the live editing canvas (`EditorCanvas.tsx`). Furthermore, `src/editor/render/imageCache.ts` (L23–38) defers GPU disposal across two animation frames (`afterSkiaDraws`), causing severe VRAM spikes during layer churn. On web, `src/editor/render/drawOffscreen.web.ts` (L10, L25–45) pools a single offscreen surface with a 10s idle timer because browser WebGL context limits (8–16 contexts) are easily exhausted.
- **Impact**: Holding full-resolution textures in the interactive canvas provides zero perceptible visual benefit on 1080p/Retina viewports, but routinely triggers OS jetsam kills on iOS and tab crashes in mobile browsers. Implementing Phase 2 (downsampling the live editing canvas to ~2048px while reserving full-res decode exclusively for export) delivers an immediate ~6× to 8× VRAM reduction (~16 MB vs ~98 MB), neutralizing Tuck's #1 crash risk immediately.

### Claim A2: Redaction Filter Memoization is Essential to Eliminate Severe Gesture Jank
**Criteria: Interaction Fidelity & Frame Rate (25%)**
- **Repository Evidence**: In `src/editor/layers/redaction/RedactionLayerView.tsx` (L35–39, L63–71), non-solid redactions apply `BackdropFilter` using `redactionFilter`. For pixelation, `pixelateFilter` (L118–132) executes `Skia.ImageFilter.MakeBlur` followed by two passes of `samplePixels` (L72–101), generating 4 dynamic linear gradients and 4 displacement maps (`MakeDisplacementMap`) across `PIXEL_SAMPLES` (`[1/2, 11/16]`). Unlike `strokesPicture` (L180–192) or `maskedRedactionPicture` (L278–294), box redactions lack any `SkPicture` memoization or raster caching.
- **Impact**: Skia re-evaluates expensive multi-pass displacement shader trees on every frame during pan, pinch, zoom, and live stroke gestures (`EditorCanvas.tsx` L219). On mobile GPUs and integrated web graphics, this immediately blows through the 16.6ms (60Hz) and 8.3ms (120Hz) frame budgets. Implementing Phase 4 to memoize static filter trees and cache rasterized `SkPicture` buffers guarantees hitch-free 120 FPS interactions.

### Claim A3: Yielding During Export and Autosave Eliminates UI Thread Freezes
**Criteria: Interaction Fidelity & Frame Rate (25%) | Architectural Safety & Regression Protection (10%)**
- **Repository Evidence**: `src/projects/projectLifecycle.ts` (L164–184) fires debounced autosave (`AUTOSAVE_DELAY_MS = 500`), running synchronous `JSON.stringify` (L254) and disk/IndexedDB writes. Crucially, `renderThumbnail` (`renderDocument.tsx` L87–95) and `useRenderedDocument.tsx` (L43–52, L64–76) execute synchronous offscreen Skia rendering and base64 PNG/JPEG encoding (`encodeToBase64`) on the JavaScript thread.
- **Impact**: Heavy serialization and synchronous encoding lock the UI thread during active editing, causing touch stutter. Cooperative yielding (`requestAnimationFrame` / microtask chunking) and backgrounding Phase 5 fixes this without altering export parity.

### Claim A4: Synthetic Microbenchmarks Suffer Severe Platform Divergence and Divert Scarce Focus
**Criteria: Engineering Cost & Maintenance Overhead (20%) | Diagnostic Realism & Platform Parity (15%)**
- **Repository Evidence**: `package.json` uses Node's native test runner (`node --test`). Node microbenchmarks run on V8 with CPU-bound JIT, completely blind to Hermes bytecode execution on iOS/Android, Metal/Vulkan GPU command scheduling, and native memory pressure. Headless Playwright tests in Chromium fail to replicate iOS jetsam thresholds or Choreographer vsync timings.
- **Impact**: Building bespoke synthetic benchmark suites upfront delays critical architectural fixes while providing distorted diagnostics with high maintenance overhead. Developer-facing HUD instrumentation and targeted native profilers (Xcode Instruments / Perfetto) deliver realistic diagnostics at near-zero cost.

---

### Known Weaknesses of Position A
1. **Regression Visibility**: Without automated microbenchmarks, subtle math or geometry performance regressions in layer transformations might go undetected until manual profiling.
2. **Visual Parity Edge Cases**: Downsampling preview textures introduces potential mipmapping or filtering discrepancies during extreme zoom levels that must be carefully validated against export output.
3. **Cache State Complexity**: Introducing preview downsampling and `SkPicture` invalidation increases cache lifecycle complexity in `imageCache.ts` and `EditorScene.tsx`.
