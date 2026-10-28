# Crop as a Stage Tool

**Topic:** whether Crop stays an editor mode in `src/editor/crop/` or becomes a tool in `src/editor/tools/`, and if so, how.

**Status:** revised after a review of the first draft against the code. The first draft's direction holds: Crop becomes a built-in tool, defined like the others and replaceable through `<Editor tools>`. Its premises, type design, layout code, and phase plan are corrected below.

---

## Background: the debate

Two positions were argued:

- **Keep Crop separate** (`src/editor/crop/`). Crop rewrites the document's framing rather than editing layers, it draws on its own canvas (`CropCanvas`), and `docs/plans/composition-plan.md:151` decided that "giving `ToolDefinition` a case for each would make it describe the editor rather than a tool".
- **Make Crop a tool** (`src/editor/tools/`). It already looks like one to the user (a toolbar button, key `C`, Done and Cancel). It's special-cased in `editorMode.ts`, `shell/toolList.ts`, `editorChrome.ts`, `useEditorTools.ts`, and `Editor.tsx`. Hosts can't replace or remove it, because `TakenId` reserves `"crop"`. And `CropTool.tsx` repeats the editor's header, context bar, dock, and footer.

Both sides settled on a middle path: Crop becomes a tool, of a second kind that shows its own canvas inside the editor's stage. This revision keeps that outcome and changes how it's built.

This reverses the composition plan's decision for Crop only. Text, Layers, and Stickers stay the editor's own.

## What the first draft got wrong

| First draft's claim | What the code shows |
| :-- | :-- |
| Crop's `<Dock>` lacks `keyboardOverlap`, so keyboard avoidance is broken. | Not a bug. `keyboardOverlap` is non-zero only while text is being typed (`useEditorLayout.ts:42`), and Crop has no text input. |
| The opaque cover hides `SaveErrorBanner` and the undo `Toast`. | True. It's a small issue, and Phase 2 fixes it. |
| Crop "destroys" the wide rail. | It covers it, on purpose ("Its header covers the editor's"). The cover is also what stops the editor changing the document mid-crop, which the new design has to handle explicitly (see "Modal tools"). |
| `CropTool.tsx` duplicates 265 lines of chrome. | Most of the file is Crop's own: the dial strip, keys, back handler, tab state, and controls sizing. About 50 lines repeat the editor's wiring. |
| Keeping `EditorCanvas` mounted avoids WebGL context thrashing. | `EditorCanvas` already stays mounted under today's `CropTool`, so both designs run the same two canvases. This doesn't separate them. |
| `useToolSession` already handles Crop. | Only for undo: Done → `reframe` → `commitSession` makes one undo step, and Cancel makes none. But a session also promises that closing a tool any way keeps its changes. Crop keeps a draft outside the store until Done, so any exit that skips `definition.done` (Back, Export) would silently lose it. |
| `LayerToolEnv` / `StageToolEnv` keep `reframe` away from layer tools. | Nothing enforces it. `archetype` is self-declared, and every tool already reads store actions through `useStore` (`useAdjustTool.ts:75`), which biome allows. Tool hooks also take `Pick<ToolEnv, …>`, so a new field touches none of them. |
| Existing code typechecks unchanged after Phase 1. | Five tool hooks and `useEditorTools.ts` import `ToolEnv` by name, and `useCanvasInput.ts:38,56` reads `canvasInput`/`finishStroke`, which don't exist on that union (TS2339). The draft's types also accepted a stage tool with `sized: true` and no `stepSize`, and silently ignored `views.Stage` on a definition without `archetype`. |
| `views.Controls` and `views.StageFooter` render after `</CanvasStage>`. | The dock is positioned absolutely inside `CanvasStage`, so this puts the phone's controls below the dock, under the home indicator. A footer outside the stage makes the stage shorter, so the wide rail and inspector cards move when Crop opens. |

## Design

### 1. One `ToolEnv`, and a `stage` part on the definition

`ToolEnv` stays as it is. Crop takes `reframe` from the store, as other tools take their own actions. A stage tool differs in what it shows and how much of the editor it takes over, so that is what the type describes.

```ts
// src/editor/defineTool.ts (sketch)

/** What covers the stage's edges: the dock and its controls, the rail, the inspector. */
export type StageInset = { left: number; right: number; bottom: number };

/**
 * What a stage tool shows in place of the editor's canvas.
 * - `Stage`: its canvas, over the editor's, inside `CanvasStage`. It keeps
 *   what it draws and drags clear of `inset`.
 * - `Footer`: a strip along the stage's bottom on a wide screen, between the
 *   rail and the inspector (Crop's straighten dial).
 * - `Controls`: a row over the phone's dock (Crop's tab controls).
 */
export type StageViews<C> = {
	Stage: ComponentType<{ controller: C; inset: StageInset }>;
	Footer?: ToolView<C>;
	Controls?: ToolView<C>;
};

export type ToolDefinition<C> = {
	useController: (env: ToolEnv) => C;
	views: { Dock; Bar?; Tray?; Results?; Inspector? }; // unchanged
	prepare?; started?; doneLabel?; done?; deselectOnDone?; reset?; announcement?; // unchanged
} & (
	| ({
			stage?: never;
			canvasInput?: (controller: C) => CanvasInput | null;
			finishStroke?: (controller: C, stroke: ToolStroke) => void;
	  } & (
			| { spec: ToolSpec & { sized: true; modal?: false }; stepSize: (controller: C, step: 1 | -1) => void }
			| { spec: ToolSpec & { sized: false; modal?: false }; stepSize?: never }
	  ))
	| {
			stage: StageViews<C>;
			spec: ToolSpec & { sized: false; modal: true };
			stepSize?: never;
			canvasInput?: never;
			finishStroke?: never;
	  }
);
```

`ToolSpec` gains `modal?: boolean` (see "Modal tools"). It's optional, so existing specs, including hosts' own, still compile.

How this compares with the first draft:

- The views sit under `stage` rather than beside the dock views, so a definition can't have a stage canvas without being a stage tool. The draft's `views.Stage` without `archetype` compiled and was never drawn.
- The stage member types `canvasInput` and `finishStroke` as `never` instead of leaving them out, so the editor reads them on any definition without narrowing.
- Checked with `tsc` against probe definitions. Rejected: a stage tool that's `sized`, that has `canvasInput`, that lacks `Stage`, that isn't `modal`, and a `modal` spec without `stage`. Accepted: ordinary layer and stage tools, and `definition.canvasInput` / `.finishStroke` / `.stepSize` / `.stage` read on the union.
- `Tool`, `ToolList`, `definitionOf`, `OpenTool`, `ToolControllers`, `TakenId`, and `editorTools` stay. `TakenId` loses `"crop"` only because `OwnTool` does.

### 2. Modal tools

Today the cover and `takesKeys` stop the editor changing the document mid-crop. A stage tool shares the editor's chrome, so the editor has to stop those changes itself. A tool whose spec is `modal`:

- **Keys.** `shortcutCommand` gets a branch for modal tools: Escape and Enter (`deselect`, and `edit`, which only fires with focus on the page body) give `doneWithTool`; `?` opens the shortcuts list; everything else is `"held"`. That includes zoom, which would otherwise zoom the hidden `EditorCanvas`, and Export. `takesKeys` stays as it is (text only), so the shortcut hook stays on.
- **Paste and drop.** `useAddImage` is disabled while a modal tool is open. Add an `isModal(mode, specs)` helper in `editorMode.ts` and use it next to `keysTaken` (`Editor.tsx:170`).
- **Back and Export.** `leave` and `openExport` call `finishTool()` first when the open tool is modal, as they already call `text.finish()`. Android's back button applies a modal tool, as Crop's does today. Other tools keep their current back behavior.
- **Inspector.** On a wide screen it stays where it is, so the photo doesn't move, but it becomes inert: `pointerEvents="none"`, `inert` on web (set from a ref, see AGENTS.md), `accessibilityElementsHidden` on native. Its layer list can't hide, delete, or reorder the photo the crop is anchored to.
- **Rail.** It stays usable. It already calls `finishTool` before switching, so choosing another tool applies the crop, as Escape does.
- **Undo and redo.** Nothing new: `selectCanUndo` and `selectCanRedo` already stop at the session's start.

### 3. A controller that starts fresh each time it opens

`useEditorTools` runs every tool's `useController` on every render, from the moment the editor mounts. `useCropController` is written to start fresh on each mount, so as a tool hook it would carry state from one crop to the next:

- `startCrop(document)` and `document.background` would be captured once, when the editor opens.
- `viewSize` would carry over between crops, so:
  - the first-fit check (`viewport.value.scale === 0`) fails and the view eases in from the last crop's viewport;
  - `viewScale > 0` is already true on the first render, so the Skia scene mounts before its surface has a size. On web that can leave it blank (AGENTS.md, Skia).

`useCropTool` resets when `open` turns on:

- The crop, aspect, background, turn-layers flag, and tab reset to their starting values, set while rendering (React's "adjust state when a prop changes" pattern), so no render shows the last crop's state.
- `viewSize` resets to zero, so `CropStage` draws nothing until its own `onLayout`. By then the shared values written by the reset have reached the UI thread, so the last crop's box can't flash.
- Whether the next fit is the first is a flag reset on open, not `viewport.value.scale === 0`.
- While closed, it does no work beyond its hooks' bookkeeping.

The tab (Crop, Rotate, Size, …) moves from `CropTool`'s local state into the controller, since the bar, dock, controls, and footer become separate views.

### 4. Layout inside `CanvasStage`

```tsx
<CanvasStage ref={layout.stageRef} toBottom frameless={wide}>
	<EditorCanvas … />
	{stageTool && (
		<stageTool.definition.stage.Stage
			controller={stageTool.controller}
			inset={layout.canvasInset}
		/>
	)}
	{!wide && <ToolTrays … />}
	{/* banner, announcements, rail, unchanged */}
	{stageTool && <StageChrome tool={stageTool} wide={wide} layout={layout} />}
	{/* inspector or dock, unchanged */}
</CanvasStage>
```

- **`Stage`** is absolute-fill and opaque (`colors.canvasWell`), drawn after `EditorCanvas`. The banner, rail, trays, and dock come after it, so they stay on top and get touches first. `CropCanvas` takes `inset`: its fit and its drag limits (`useCropGesture.ts:103`, now the whole view) use the part of the view nothing covers, so no handle can end up under the dock, rail, or inspector. It stays full-bleed rather than inset, so the editor's photo can't show through the gaps around the wide cards.
- **`StageChrome`** places `Controls` (phone) absolutely at `bottom: layout.dockInset`, over the dock, which already pads the safe area. It places `Footer` (wide) along the stage's bottom between `canvasInset.left` and `canvasInset.right`, padded by the bottom safe area itself, as `DialStrip` is today. Neither is in the column outside the stage, so the rail and inspector don't move.
- **Their heights** go into `useEditorLayout` like an open tray's: added to `canvasInset.bottom` on both layouts and to `coveredBottom`, so the Toast sits above them. Crop keeps them fixed while it's open (120 or 64 points for the phone's controls, 100 for the wide strip, which holds the dial only on Rotate) so its canvas holds still as tabs change.
- **Resizing.** Crossing the wide breakpoint swaps `Footer` and `Controls`, and the dock and inspector, without remounting `Stage`, which keeps its place among the stage's children. Opening the inspector or resizing changes `inset`, and Crop refits with its existing ease. A resize during a drag rebuilds `useCropGesture` (as `onLayout` does today), so test that `dragging` doesn't stay set.

### 5. Crop's definition

```ts
// src/editor/tools/crop/cropSpec.ts
export const cropSpec = {
	target: "none", // with no locked photo, Crop crops and turns the canvas itself
	tray: false,
	sized: false,
	modal: true,
	label: "Crop",
	icon: "crop-rotate",
	key: "C",
	shortcut: "Crop",
	actsOn: () => false,
} satisfies ToolSpec;

// src/editor/tools/crop/cropTool.ts
export const cropTool = defineTool<CropController>({
	spec: cropSpec,
	useController: useCropTool,
	views: { Dock: CropDock, Bar: CropBar },
	stage: { Stage: CropStage, Footer: CropFooter, Controls: CropControls },
	done: (crop) => crop.done(),
	reset: (crop) => (crop.changed ? crop.reset : undefined),
});
```

What Done gives `reframe` (the current framing when the crop is untouched, otherwise `cropFraming`) moves into `cropGeometry.ts` as a plain function, so Node can test it.

## Plan

Each phase leaves `main` working and passes `npm run check`, `npm run typecheck`, and `npm test`. Phase 3 also runs `npm run build:web` and the interactive docs' build.

### Phase 1: types and modal rules (nothing visible changes)

- `defineTool.ts`: `StageInset`, `StageViews`, and the `stage` member above. `ToolEnv` is unchanged.
- `toolSpec.ts`: `modal?: boolean`, documented.
- `editorMode.ts`: `isModal(mode, specs)`, and the modal branch in `shortcutCommand`.
- Tests:
  - `defineTool.test.ts`: `@ts-expect-error` cases for a stage tool that's `sized`, has `canvasInput`, lacks `Stage`, or isn't `modal`, and a `modal` spec without `stage`; a ruler stage tool that passes `editorTools`.
  - `editorMode.test.ts`: with a modal tool open, Escape and Enter give `doneWithTool`, `?` opens the list, and zoom, export, undo, tool keys, and `[` / `]` are held.
- No tool uses any of it yet.

### Phase 2: Crop becomes a stage tool, files in place

One change, so Crop works before and after it.

- **Editor.** Render `Stage` and `StageChrome` as in "Layout inside `CanvasStage`", and feed their heights into `useEditorLayout`. Add the modal rules: paste gate, inert inspector, `leave` and `openExport` finishing a modal tool, and Android back for modal tools.
- **Crop** (still in `src/editor/crop/`):
  - `cropSpec.ts` and `cropTool.ts`.
  - `useCropController` becomes `useCropTool(env)`, with the reset on open and the tab state.
  - `CropPanel.tsx` exports `CropDock` (the tab row), `CropBar`, `CropControls`, and `CropFooter` (the dial), each taking only `controller`.
  - `CropCanvas` takes `inset`.
  - Done's framing moves into `cropGeometry.ts`, with tests.
- **Registry.** `crop` joins `BUILT_IN_SPECS` and `BUILT_IN_TOOLS`. `BUILT_IN_TOOLBAR` keeps its order. `src/editor/index.ts` exports `cropTool`.
- **Removed:**
  - `CropTool.tsx`;
  - `{ type: "crop" }`, `startCrop`, and `endCrop` in `editorMode.ts`;
  - `"crop"` in `OwnTool`, `TOOLS`, and `TOOL_KEYS`;
  - `cropping` in `railChosenTool`;
  - `startCrop`, `closeCrop`, and `finishCrop` in `useEditorTools.ts`;
  - the shortcuts list's Crop group, whose rows join the tools' group ("Enter: Apply a crop").
- **Tests updated:** `editorMode.test.ts` (the crop cases, and `takesKeys` back to text only), `editorChrome.test.ts` (Crop's entry now comes from its spec; `railChosenTool` without `cropping`), and `shortcuts.test.ts`.
- **Behavior changes,** for the change's description:
  - Starting Crop closes the layers sheet, as every tool does. Today it leaves it open (`editorMode.test.ts:106`).
  - The editor's header, rail, banner, and Toast stay visible during a crop.
  - Back and Export apply the crop first.
  - `?` works during a crop.
- **Host migration.** A host passing its own `tools` must add `cropTool` to keep Crop. Without it, a `toolbar` naming `"crop"` fails `editorTools`, and at runtime `toolbarEntries` would throw on the missing spec. Put this in the change's description, and consider having `toolbarEntries` skip ids it has no spec for.
- **Check by hand** on a phone (simulator or emulator), a wide window, and web:
  - The box fits and drags clear of the dock, controls, rail, and inspector.
  - The rail and inspector don't move as Crop opens and closes.
  - A second crop starts from the document, not from the last crop, and no stale box flashes.
  - Paste, drop, zoom keys, and the inspector do nothing mid-crop.
  - Back and Export apply the crop.
  - Escape and Enter apply; Cancel leaves no undo step; Done leaves one.
  - A save error shows its banner during a crop.
  - Resizing across the wide breakpoint keeps the crop and tab.

### Phase 3: move to `src/editor/tools/crop/`

A move, with no change in behavior.

- `git mv src/editor/crop src/editor/tools/crop`, tests included. Update the imports in `builtInSpecs.ts`, `builtInTools.ts`, and the moved files, which then reach the editor through `../../`.
- `biome.json`:
  - remove `src/editor/crop/**` from the override it shares with `layers/` and `text/`;
  - add `../crop/**` to `tools/**`'s sibling bans;
  - drop the `crop` patterns that no longer match anything, including `canvas/**`'s `../crop/**`.
- `docs/architecture.md`: line 29 (Crop's folder and what it holds), line 38 (stage tools, `stage`, `modal`), line 62 (the import rules).
- `docs/plans/composition-plan.md:151`: note that Crop has since become a stage tool, with a link here.
- `docs/interactive`: `src/source/sources.ts` (the `?raw` import on line 3 and the path key on line 67) and `src/lessons/model/FramingLesson.tsx` (the import on line 26 and the `file:` paths on lines 271–286).
- Run `npm run build:web` and `npm run build --prefix docs/interactive`.

## Open questions

- Should Android back apply every tool, not only modal ones? That's a separate decision; this plan leaves other tools as they are.
- Should `toolbarEntries` skip toolbar ids with no spec, so a host that forgets `cropTool` loses the button rather than crashing?
