# Position A Closing: Final Revised Position

### Crux 1: Structural Preview Decoupling vs. Parameter Tuning
Position C's proposal to lower `MAX_PHOTO_PIXELS` to 16MP violates Constraint 4 by degrading 24MP exports, while leaving ~65 MB VRAM per layer—still causing Jetsam kills on multi-photo projects. Parameter tuning cannot defeat GPU memory physics. Structural decoupling (Phase 2: ~2048px preview texture, full-resolution decode strictly on-demand in `renderDocument.tsx`) slashes canvas VRAM by ~80% (~16 MB vs ~98 MB) with zero export loss. To address dual-cache concerns, we narrow scope: full-resolution textures are never cached during editing; they are decoded and disposed strictly during export.

### Crux 2: Worklet Math Microbenchmarks vs. Engine Divergence
Gesture drops in Tuck are overwhelmingly GPU-bound: `RedactionLayerView.tsx` executes 8 dynamic shader stages per frame without memoization. Matrix math runs in nanoseconds. Conceding to Agent B regarding asymptotic regressions ($O(N) \to O(N^2)$), we accept lightweight Tier 1 benchmarks running natively via `node --test` with zero dependencies, strictly scoped to core geometry and strokes.

### Crux 3: Headless Playwright vs. In-App Dev HUD & Profilers
We firmly reject Playwright. Headless Chromium on 32GB CI runners cannot simulate mobile unified memory, iOS Jetsam thresholds, or Metal command buffers. WebGL context limits are already guarded by single-surface pooling in `drawOffscreen.web.ts`. Real diagnostic fidelity requires the zero-cost in-app Dev HUD and `src/platform/perf.ts` spans, paired with native Xcode/Perfetto profilers.

### Final Revised Position
1. **Immediate Telemetry & Guardrails**: Ship zero-overhead `src/platform/perf.ts`, in-app Dev HUD, and lightweight `node --test` math benchmarks.
2. **Phase 2 Decoupling**: Downsample interactive canvas textures to ~2048px; decode full-resolution images strictly on-demand during export.
3. **Phase 4 & 5 Fixes**: Memoize redaction filters with `SkPicture` and yield the UI thread during autosave/export serialization.
