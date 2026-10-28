# Architectural Evaluation: Crop as an Editor Mode vs. First-Class Tool

**Topic:** Determining whether `crop` should remain an independent editor mode under `src/editor/crop/` or be refactored into `src/editor/tools/` as a first-class tool definition.

---

## Executive Summary of the Architectural Debate

An architectural debate was conducted between two specialized subagents:
- **Subagent A ("Status-Quo Architect")**: Defended keeping Crop as an independent editor mode under `src/editor/crop/`, arguing from framing vs. layer mutation boundaries, dedicated Skia canvas requirements, and preserving a lean `ToolDefinition`.
- **Subagent B ("Pluggable Systems Engineer")**: Advocated unifying Crop into `src/editor/tools/`, arguing from user mental models, consumer pluggability (`<Editor tools={...} />`), eliminating 265 lines of duplicate UI chrome, and fixing active UI drift bugs.

### Key Discoveries During Debate
1. **The Duplication in `CropTool.tsx` Has Already Caused Active Bugs:**
   - In [`src/editor/crop/CropTool.tsx` (line 155)](file:///Users/nverk/Dev/tuck/src/editor/crop/CropTool.tsx#L155), the duplicated `<Dock>` omitted `keyboardOverlap={layout.keyboardOverlap}`, breaking soft-keyboard avoidance on mobile.
   - `CropTool.tsx` renders a full-screen opaque blanket (`...StyleSheet.absoluteFill, backgroundColor: colors.background`), which completely occludes [`SaveErrorBanner`](file:///Users/nverk/Dev/tuck/src/editor/Editor.tsx#L470) and undo [`Toast`](file:///Users/nverk/Dev/tuck/src/editor/Editor.tsx#L531).
   - On desktop screens, opening Crop completely destroys the [`EditorRail`](file:///Users/nverk/Dev/tuck/src/editor/Editor.tsx#L478), causing a jarring layout shift.
2. **`useToolSession` Natively Supports Atomic Single-Step Edits:**
   - In [`src/editor/store/editorSlice.ts` (lines 506–512)](file:///Users/nverk/Dev/tuck/src/editor/store/editorSlice.ts#L506-L512), `commitSession` checks `if (document === session.document) { set({ session: null }); return; }`. 
   - Because of this snapshot comparison, intermediate scratch gestures in a local controller do *not* generate store actions or undo history. When `done` executes `reframe`, `commitSession` commits exactly one atomic undo snapshot. The claim that Crop's transactional model is incompatible with `useToolSession` is factually incorrect.
3. **Unmounting `EditorCanvas` is Dangerous; Scoped Stage Overlays are Safe:**
   - Unmounting `EditorCanvas` whenever Crop opens destroys Skia WebGL surfaces, risks browser context drops, and thrashes viewport state.
   - However, Crop does not need to replace `EditorCanvas` in the DOM tree. Rendering `CropCanvas` as an overlay **scoped strictly within `<CanvasStage>`** keeps `EditorCanvas` warm while allowing the shared `ScreenHeader`, `ContextBar`, `Dock`, `DockFooter`, `EditorRail`, and error banners to remain active and un-occluded.
4. **Interface Segregation Must Be Maintained:**
   - Blithely adding `reframe` to the generic `ToolEnv` violates Interface Segregation and pollutes standard layer tools (`draw`, `redact`, `find`, `cutout`, `adjust`).
   - A discriminated union between **`LayerToolDefinition`** and **`StageToolDefinition`** preserves 100% type purity and Node testability.

### Consensus Verdict
Both agents converged on a **Hybrid Architecture**: Crop is refactored into `src/editor/tools/crop/` as a built-in tool conforming to a new `StageToolDefinition` archetype.

The review on October 28, 2026 kept the hybrid but slimmed it: see [Decisions](#decisions-october-28-2026). The debate below is kept as the record; where it disagrees with the decisions, the decisions win.

---

## Detailed Summary of Debate Rounds

### Round 1: Opening Arguments & Code Citations

#### Subagent A (Defending Separation):
- **Framing Mutations vs. Layer Edits:** Layer tools mutate layers within existing document bounds and run continuous undo sessions on the store; Crop completely changes document framing ([`src/model/framing.ts` lines 89–102, 162–192](file:///Users/nverk/Dev/tuck/src/model/framing.ts#L89-L102)), recalculating bounds and rebasing every layer via `rebaseTransform`.
- **Canvas Staging:** Standard tools cleanly share `EditorCanvas` via generalized input pipelines (`canvasInputFor.ts`). Crop requires its own dedicated Skia canvas (`CropCanvas.tsx`) with specialized 8-handle box dragging (`cropDrag.ts`), inverted scrim clip, aspect-ratio snapping, and straighten dials.
- **`composition-plan.md` Intent:** The plan specifically warned: *"Giving ToolDefinition a case for each would make it describe the editor rather than a tool, so they stay the editor's own."*

#### Subagent B (Advocating Unification):
- **User Mental Model:** Crop is in `BUILT_IN_TOOLBAR` right between Stickers and Adjust, has an icon (`crop-rotate`), label ("Crop"), shortcut key (`C`), and standard Done/Cancel footer. Segregating it leaks internal storage mechanics into top-level architecture.
- **Pervasive Code Sprawl:** Quarantining Crop forces special-casing across 5 core files:
  - `editorMode.ts`: `{ type: "crop" }`, `{ type: "startCrop" }`, `{ type: "endCrop" }`.
  - `shell/toolList.ts`: `OwnTool = "text" | "sticker" | "crop" | "photo"`.
  - `editorChrome.ts`: `railChosenTool` has `if (cropping) return "crop"`.
  - `useEditorTools.ts`: Bespoke `startCrop`, `closeCrop`, and `finishCrop`.
  - `Editor.tsx`: `{cropping && <CropTool ... />}`.
- **Layout Chrome Duplication:** `CropTool.tsx` duplicates 265 lines of layout chrome (`ScreenHeader`, `ContextBar`, `Dock`, `DockFooter`, and manual key listeners).
- **Pluggability Lock-out:** Consumers of `<Editor tools={...} toolbar={...} />` cannot customize, wrap, disable, or replace Crop (e.g. with a perspective cropper or auto-scan cropper) because `editorTools` explicitly bans `"crop"` via `TakenId`.

---

### Round 2: Rebuttal & Stress-Testing

#### Subagent A's Counter-Attack:
- **WebGL Context Thrashing:** If `EditorCanvas` is unmounted when `CropCanvas` mounts, WebGL contexts are repeatedly destroyed and recreated, risking context loss and blanking on web (`AGENTS.md`).
- **Loss of Viewport State:** Unmounting `EditorCanvas` wipes ephemeral pan/zoom and viewport scale.
- **Interface Pollution:** Adding `reframe` to `ToolEnv` hands whole-document framing mechanics to tools like `draw` and `redact`, complicating pure Node unit tests.
- **Layout Incompatibilities:** Crop has unique layout requirements:
  - Wide screens require a 100pt `<DialStrip>` underneath the canvas stage.
  - Mobile screens require dynamic-height controls (`CONTROLS_WITH_DIAL` 120pt vs `CONTROLS_WITHOUT_DIAL` 64pt) above the dock.
  - Crop binds Android `BackHandler` and window key listeners for Escape and Enter.

#### Subagent B's Rebuttal:
- **The Duplication is Already Rotting:** Pointed out that `CropTool.tsx` has already drifted from `Editor.tsx`:
  - Soft-keyboard avoidance is broken in Crop because `keyboardOverlap` was omitted from its `<Dock>`.
  - Auto-save error banners and undo toasts are completely occluded by `CropTool`'s full-screen background.
  - The wide desktop `EditorRail` vanishes when Crop is opened, disrupting the desktop UI.
- **`useToolSession` Coalescing:** Proved that `useToolSession` naturally supports local controller drafts. Because `commitSession` compares document references, intermediate gestures never pollute the store, and `reframe` commits as exactly one undo step.
- **Scoped CanvasStage Overlay:** Proved that `EditorCanvas` does not need to be unmounted. Mounting `CropCanvas` as an overlay inside `<CanvasStage>` preserves WebGL context warmth while keeping the outer shell unified.

---

### Round 3: Convergence & Hybrid Design

Both agents agreed that neither the pure status quo nor naive unification is optimal. They converged on a **Two-Archetype Tool Architecture**:

1. **Typed Tool Archetypes (`LayerToolDefinition` vs. `StageToolDefinition`):**
   - `LayerToolEnv` stays 100% pure (no `reframe`, identical to current `ToolEnv`).
   - `StageToolEnv` extends `LayerToolEnv` with `reframe`.
   - Node tests for layer tools remain completely insulated.
2. **Non-Destructive In-Stage Viewport Staging:**
   - `EditorCanvas` remains mounted inside `<CanvasStage>`.
   - `views.Stage` mounts as a scoped overlay *inside* `<CanvasStage>`, leaving `EditorHeader`, `Dock`, `EditorRail`, and error banners fully visible.
3. **Formalized Slots for Asymmetric Controls:**
   - Desktop straighten dial mounts via `views.StageFooter` under `<CanvasStage>`.
   - Dynamic mobile controls mount via `views.Controls` above `<Dock>`.
   - Mobile dock tab row mounts inside the unified `<Dock>`, inheriting `keyboardOverlap`.
4. **Shell-Level Event Centralization:**
   - Android `BackHandler` and Enter/Escape shortcuts are handled centrally by `useEditorTools` and `useEditorShortcuts`.

---

## Direct Comparison of Trade-Offs

| Evaluation Dimension | Status Quo (`src/editor/crop/`) | Naive Unification (`ToolDefinition`) | Converged Hybrid Architecture |
| :--- | :--- | :--- | :--- |
| **`ToolEnv` Purity** | High (Crop excluded from tools) | Low (`reframe` leaked to all tools) | **High** (`LayerToolEnv` vs `StageToolEnv`) |
| **Node Testability** | Simple for layer tools | Polluted with mock framing calls | **Simple & Pure** (Layer tools see no framing) |
| **Layout Duplication** | 265 lines duplicated in `CropTool.tsx` | None, but cramped controls | **Zero Duplication** (Shared shell with typed slots) |
| **UI Consistency & Bugs** | ⚠️ Broken keyboard avoidance; banner occlusion; rail disappears | Clean UI composition | **Fully Fixed** (Inherits `keyboardOverlap`, rail persists) |
| **Skia WebGL Lifecycle** | Two active canvases simultaneously | Thrashing WebGL contexts if unmounted | **Scoped in-stage overlay** (Canvas stays warm) |
| **Store Undo Session** | Custom `finishCrop` wrapper | Risk of empty session if unhandled | **Native** (`commitSession` coalesces 1 step) |
| **Pluggability & Extensibility** | ❌ Hardcoded in `Editor.tsx`; banned in `TakenId` | ✅ Pluggable | **✅ Fully Pluggable** via `<Editor tools={...} />` |
| **Code Sprawl in Editor Core** | High (Branches in 5 core modules) | Low | **Low** (Unified under standard tool loop) |

---

## Decisions (October 28, 2026)

### Corrections to the debate

Checked against the code at `9e777f8`:

* **No keyboard bug.** `keyboardOverlap` is measured only while text is typed (`useKeyboardOverlap(stageRef, typing)` in `useEditorLayout.ts`), and Crop never types, so its `Dock` loses nothing without it.
* **`EditorCanvas` was never unmounted.** `CropTool` draws over it, so the canvas already stays warm; the hybrid still runs two Skia canvases, as now. The WebGL argument doesn't decide anything.
* **No `StageToolEnv`.** `reframe` is already a store action (`editorSlice.ts`), and a tool's hook may read the store, as Adjust and Cut out do. Crop calls it itself, so `ToolEnv` stays as it is and the Interface Segregation argument goes away.
* **Less duplication than claimed.** 265 lines is all of `CropTool.tsx`, its dial strip and keys included; the chrome it repeats is about 60.
* **Real:** the wide rail vanishes and `SaveErrorBanner` is covered while cropping, and Crop can't be replaced or left out by `<Editor tools>`, which matters for open-sourcing.

### What the debate missed

* **Every tool's hook runs every render**, open or not. Crop's controller seeds its draft once, on mount (`useState(() => startCrop(document))`), so as a tool it must seed it again each time it opens.
* **Crop takes the keys** (`takesKeys` in `editorMode.ts`): no undo or redo, tool letters, paste, or drop while it's open. Undo under a local draft would change the document beneath it.
* **The header keeps Back and Export through every tool**, while Crop's shows only Reset. Export mid-crop would export the uncropped document.
* **The inspector and layers sheet would stay live** beside an in-stage overlay, and an edit there would change the document after the draft was seeded.
* **It reverses a decision in `composition-plan.md`** ("Text, Crop, Layers, and Stickers stay the editor's own"), which `docs/architecture.md` and `biome.json` follow.

### Settled

1. **Crop becomes a tool, slim.** It moves to `src/editor/tools/crop/` and is built with `defineTool`, with no `archetype` field and no second env. `ToolDefinition` gains two optional views and its spec one flag (below); `"crop"` leaves `OwnTool`, `TOOLS`, and `TakenId`, and joins `builtInSpecs.ts`, `builtInTools.ts`, and the default toolbar by id.
2. **The rest of the editor treats it like any tool.** The rail stays and marks Crop. Any close but Cancel applies the crop, as any close but Cancel keeps a tool's changes: Done, Escape, picking another tool, Back, and Android's back button. Export hides while it's open, and the inspector's layers and the layers sheet are inert.
3. **Two view slots, `Stage` and `Controls`.** `Stage` replaces the canvas, drawn opaque over `EditorCanvas` inside `CanvasStage` and clear of the dock and controls. `Controls` is a strip the tool keeps under the canvas on both layouts: above the dock on a phone (Crop's tab controls, at a fixed height so the photo holds still), under the stage on a wide screen (the straighten dial's strip). No `StageFooter`.
4. **It lands as composition-plan step 8d, before step 9**, so the docs and Biome's rules are written once, for the final shape.

### The shape

* `ToolSpec` gains `takesKeys?: true`: while the tool is open the editor's shortcuts, paste, and drop are off, as for typing, and Escape and Enter (from the canvas, not a focused control) run Done. `takesKeys(mode)` reads it from the specs, replacing `mode.type === "crop"`.
* `ToolDefinition`'s views gain `Stage?` and `Controls?`. A definition with `Stage` gives no `canvasInput` or `finishStroke`, which the type enforces with a union beside the `sized` one.
* Crop's hook keeps its draft locally and seeds it from the document when `env.open` turns true. Its `done` calls the store's `reframe` once, inside the tool's session, so the crop is one undo step and Cancel leaves none; `reset` is its Reset while the draft changed.
* Every close but Cancel runs the open tool's `done` before closing: the rail and dock picking another tool, Back, and Android's back button (one `BackHandler` in the editor for any open tool, replacing Crop's own). Leaving the editor any other way keeps the session, as now, and loses only an unapplied crop draft.
* `EditorMode` loses `{ type: "crop" }`, `startCrop`, and `endCrop`; `editorChrome`'s `cropping` and `useEditorTools`' `startCrop`, `closeCrop`, and `finishCrop` go. `CropTool.tsx` goes, its pieces becoming Crop's views: `Dock` (the tab row), `Bar` (the wide header's options), `Stage` (`CropCanvas`), and `Controls`.
* Crop's tab moves from `CropTool`'s state into its controller, since the views that share it mount apart.
* The interactive docs' imports of `crop/cropGeometry.ts` move to `tools/crop/cropGeometry.ts`, with `sources.ts`.

### Checks

Besides the four checks and the interactive docs' build, in the browser pane and the iOS simulator:

* Crop, then Cancel: no undo step. Crop, then Done: one, and Undo restores the framing.
* On a wide window the rail stays put through Crop, and picking Draw from it applies the crop. Export is hidden, and the layers can't be changed.
* Escape and Enter apply; undo and the tool letters do nothing while Crop is open; a dropped photo is ignored.
* A save error shows its banner over Crop.
* The phone's photo holds still as Crop's tabs change, and the wide one as Rotate is chosen.
* `<Editor tools>` without Crop: no button, no key, no line in the shortcuts.
