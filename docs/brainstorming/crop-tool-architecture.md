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

## Concrete Architectural Specification

### 1. Updated `src/editor/defineTool.ts`

```ts
import type { ComponentType, ReactNode } from "react";
import type { EditorDocument } from "@/model/document";
import type { Framing } from "@/model/framing";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import type { ToolStroke } from "./canvas/canvasTool";
import type { CanvasInput } from "./canvasInputFor";
import type { EditorHost } from "./editorHost";
import type { OwnTool } from "./shell/toolList";
import type { ToolId, ToolSpec } from "./toolSpec";

export type ToolView<C> = ComponentType<{ controller: C }>;

/** Base environment common to all tools. */
export type LayerToolEnv = {
	document: EditorDocument;
	documentSize: Size;
	open: boolean;
	image: ImageLayer | null;
	close: () => void;
	notify: (message: string) => void;
	view: { zoomToArea: (area: Rect) => void; fit: () => void };
	addImage: EditorHost["addImage"];
};

/** Specialized environment for tools that mutate document framing/canvas bounds. */
export type StageToolEnv = LayerToolEnv & {
	reframe: (framing: Framing, turnLayers: boolean) => void;
};

export type BaseToolViews<C> = {
	Dock: ToolView<C>;
	Bar?: ToolView<C>;
	Tray?: ToolView<C>;
	Results?: ToolView<C>;
	Inspector?: ComponentType<{ controller: C; children: ReactNode }>;
};

type CommonToolDefinition<C, E> = {
	spec: ToolSpec;
	useController: (env: E) => C;
	prepare?: (controller: C) => void;
	started?: (controller: C, image: ImageLayer) => void;
	doneLabel?: (controller: C) => string | undefined;
	done?: (controller: C) => void;
	deselectOnDone?: boolean;
	reset?: (controller: C) => (() => void) | undefined;
	announcement?: (controller: C) => string | null;
};

/** Standard layer-mutating tool (draw, redact, find, cutout, adjust). */
export type LayerToolDefinition<C> = CommonToolDefinition<C, LayerToolEnv> & {
	archetype?: "layer";
	views: BaseToolViews<C>;
	canvasInput?: (controller: C) => CanvasInput | null;
	finishStroke?: (controller: C, stroke: ToolStroke) => void;
} & (
	| { spec: ToolSpec & { sized: true }; stepSize: (controller: C, step: 1 | -1) => void }
	| { spec: ToolSpec & { sized: false }; stepSize?: never }
);

/** Stage-level tool providing custom viewport staging (crop, perspective warp). */
export type StageToolDefinition<C> = CommonToolDefinition<C, StageToolEnv> & {
	archetype: "stage";
	views: BaseToolViews<C> & {
		/** Canvas replacement mounted strictly inside CanvasStage */
		Stage: ToolView<C>;
		/** Optional desktop bottom strip (e.g. Rotate dial strip) */
		StageFooter?: ToolView<C>;
		/** Optional controls row mounted above the mobile dock */
		Controls?: ToolView<C>;
	};
	stepSize?: never;
};

export type ToolDefinition<C> = LayerToolDefinition<C> | StageToolDefinition<C>;

export function defineTool<C>(definition: ToolDefinition<C>): ToolDefinition<C> {
	return definition;
}
```

### 2. Definition of `cropTool` (`src/editor/tools/crop/cropTool.ts`)

```ts
import { defineTool } from "../../defineTool";
import { cropSpec } from "./cropSpec";
import { CropBar, CropControls, CropDock, CropStage, CropStageFooter } from "./CropViews";
import { type CropController, useCropTool } from "./useCropTool";

export const cropTool = defineTool<CropController>({
	archetype: "stage",
	spec: cropSpec,
	useController: useCropTool,
	views: {
		Dock: CropDock,
		Bar: CropBar,
		Stage: CropStage,
		StageFooter: CropStageFooter,
		Controls: CropControls,
	},
	done: (controller) => controller.commit(),
	reset: (controller) => (controller.changed ? controller.reset : undefined),
});
```

### 3. Layout Integration in `src/editor/Editor.tsx`

```tsx
{/* Inside CanvasStage */}
<CanvasStage ref={layout.stageRef} toBottom frameless={wide}>
    <EditorCanvas
        ref={canvasRef}
        document={document}
        selectedLayer={selectedLayer}
        // ... standard props
    />
    {activeStageTool && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <activeStageTool.definition.views.Stage
                controller={activeStageTool.controller}
            />
        </View>
    )}
    {!wide && (
        <ToolTrays context={panels} modeState={modeState} panel={panel} />
    )}
</CanvasStage>

{/* Desktop StageFooter (e.g. Straighten Dial) */}
{wide && activeStageTool?.definition.views.StageFooter && (
    <activeStageTool.definition.views.StageFooter
        controller={activeStageTool.controller}
    />
)}

{/* Mobile Dynamic Controls row above Dock */}
{!wide && activeStageTool?.definition.views.Controls && (
    <activeStageTool.definition.views.Controls
        controller={activeStageTool.controller}
    />
)}
```

---

## Phased Implementation Plan

Refactoring Crop into a first-class tool touches both the tool registry and layout chrome. A 4-phase rollout ensures that every step is verifiable and zero regressions occur.

### Phase 1: Type Foundation & Archetype Definitions
- **Files:** `src/editor/defineTool.ts`, `src/editor/toolSpec.ts`.
- **Changes:**
  - Introduce `LayerToolEnv`, `StageToolEnv`, `LayerToolDefinition`, and `StageToolDefinition`.
  - Update `ToolDefinition` union.
  - Verify that existing built-in tools (`draw`, `redact`, `find`, `cutout`, `adjust`) typecheck without modifications.
- **Verification:** `npm run typecheck` and `npm test`.

### Phase 2: Views Extraction & Controller Adaptation
- **Files:** Move files from `src/editor/crop/` to `src/editor/tools/crop/`.
- **Changes:**
  - Create `cropSpec.ts` with label, icon (`crop-rotate`), and shortcut key (`C`).
  - Adapt `useCropController` into `useCropTool(env: StageToolEnv)`. Connect `env.reframe` to `commit()`.
  - Split `CropTool.tsx` into modular views: `CropDock`, `CropBar`, `CropStage`, `CropStageFooter` (the desktop dial strip), and `CropControls` (mobile sub-controls).
  - Delete `CropTool.tsx`'s duplicate `ScreenHeader`, `ContextBar`, `Dock`, and `DockFooter`.
- **Verification:** Unit test `cropSpec.ts` and controller commit behavior.

### Phase 3: Shell Integration & Core Cleanup
- **Files:** `src/editor/Editor.tsx`, `src/editor/useEditorTools.ts`, `src/editor/editorMode.ts`, `src/editor/editorChrome.ts`, `src/editor/shell/toolList.ts`, `src/editor/builtInTools.ts`.
- **Changes:**
  - Register `cropTool` in `builtInTools.ts` and `builtInSpecs.ts`.
  - Remove `"crop"` from `OwnTool` in `toolList.ts` and `TakenId` in `defineTool.ts`.
  - Excised `{ type: "crop" }` and `{ type: "startCrop" } | { type: "endCrop" }` from `EditorMode`. Crop now activates via standard `{ type: "tool", tool: "crop" }`.
  - Wire `views.Stage`, `views.StageFooter`, and `views.Controls` into `Editor.tsx`.
  - Remove `{cropping && <CropTool ... />}` and custom `startCrop`/`closeCrop`/`finishCrop` in `useEditorTools.ts`.
  - Add centralized Android hardware back handling for active tools.
- **Verification:** `npm run check`, `npm run typecheck`, `npm test`.

### Phase 4: Regression Testing & Interactive Docs
- **Files:** `src/editor/store/__tests__/editorSlice.test.ts`, `docs/interactive/`.
- **Tests & Smoke Checks:**
  1. **Undo Coalescing:** Verify that adjusting crop box and canceling results in zero undo entries; committing results in exactly 1 undo entry.
  2. **Soft Keyboard Avoidance:** Verify mobile dock with `keyboardOverlap` properly offsets when changing crop ratios or typing.
  3. **Banner Visibility:** Trigger save error during crop; confirm `SaveErrorBanner` is visible.
  4. **Desktop Rail:** Confirm `EditorRail` remains steady on wide screens when entering and exiting Crop.
  5. **WebGL Stability:** Verify canvas does not flash or re-render unexpectedly on web when toggling Crop.
  6. **Interactive Docs:** Update any lesson import paths pointing to `crop/cropGeometry.ts` to `tools/crop/cropGeometry.ts`.
- **Final Checks:** `npm run check`, `npm run typecheck`, `npm test`, `npm run build:web`, and `npm run build --prefix docs/interactive`.
