# What's left of the tools in the editor's root

A refactoring plan written October 27, 2026, the next step after [tool-independence-plan.md](tool-independence-plan.md), which gave each tool a `defineTool` definition for its views and how it finishes (`c1c4452`). Three things still have a case per tool in the editor's root: the mode (`editorMode.ts`), what input on the canvas does (`canvasInputFor.ts`, `useCanvasInput.ts`), and starting a tool (`useEditorTools.ts`). This plan moves each into the tools.

**Status, October 27, 2026:** built (`ecb4fa8` to `28ae186`).

It changes APIs, not behavior, with one exception: picking Cut out again from the wide rail while it's open keeps it open, as every other tool does, instead of closing it (step 6).

## What happens today

Paths are under `src/screens/editor/`, read at `d8f9c31`.

| Fact | Where it's decided |
| --- | --- |
| Which tools there are | `EditorMode`'s union (`editorMode.ts`), one line per shape of tool mode. `EditorTool` is derived from it. |
| Whether a tool has a tray | The union: Draw, Redact, Find, and Cut out carry `optionsOpen`. `toolMode` builds each shape by name. |
| What a tool works on | The union again: Adjust and Cut out carry `layerId`. `settle` puts those down when their image goes, and Find down by name (`mode.tool === "find"`) when there's no photo (`ModeTargets.canFind`). `toolImageId` takes `"adjust" \| "cutOut"`. |
| Whether `[` and `]` step it | `SIZED_TOOLS` in `editorMode.ts`, read by `shortcutCommand`, and separately each definition's `stepSize`. Nothing checks that they agree. |
| What the canvas does | `canvasToolFor` picks Cut out's, Draw's, or Redact's `CanvasTool` by name, and `canvasInputFor` Find's or Adjust's input. `useCanvasInput` takes each tool's settings as its own argument (`draw`, `redact`, `cut`, `find`, `adjustController`), memoizes them part by part, and builds Adjust's dial drag. |
| What a finished stroke does | `useCanvasInput`'s `finishStroke`: a switch on the stroke's kind that calls Draw's, Redact's, and Cut out's store actions, and Cut out's `pickSubject`. |
| How a tool starts | `useEditorTools`: one starter per tool (`startDrawing`, `startRedacting`, `startFinding`, `startAdjusting`, `startCutOut`). Draw and Redact pick their sub-tool first (`chooseTool`); Find, Adjust, and Cut out need a photo; Cut out's cut starts from `pendingCut` and an effect that must run after `useToolSession`'s. |

`editorMode.ts` and `canvasInputFor.ts` are plain TypeScript with tests in Node (`__tests__/editorMode.test.ts`, 30 tool names; `__tests__/canvasInputFor.test.ts`). The definitions import views (`.tsx`), which Node can't load. That's why phase C left these alone, and it shapes the decisions below.

## Decisions

* **Each tool has a pure spec beside its definition.** `tools/draw/drawSpec.ts`, and one per tool, holds the facts the mode and the shortcuts need, in plain TypeScript that Node's tests can import:

  ```ts
  export const drawSpec = {
  	id: "draw",
  	target: "none", // "none", "photo" (any photo to work in), or "image" (the one it started on)
  	tray: true,
  	sized: true,
  } as const satisfies ToolSpec;
  ```

  `toolSpec.ts` (root, pure) declares `ToolSpec`, and `toolSpecs.ts` (root, pure) lists the specs by name. `EditorTool` becomes `keyof typeof TOOL_SPECS`. A file per tool keeps every fact about a tool in its folder, so adding one is a folder and a line in each list. Find's target is `"photo"`, Adjust's and Cut out's `"image"`, Draw's and Redact's `"none"`.
* **A definition is built from its spec.** `defineTool<DrawController>({ spec: drawSpec, views, … })`. The spec is a field, not a first argument: with `defineTool(spec, rest)`, naming the controller would mean naming the spec's type too, since TypeScript can't infer one type parameter and take the other. `ToolDefinition<C>` is a union on `spec.sized`, which requires `stepSize` when it's true and forbids it when it's false, so the two can't disagree, and `SIZED_TOOLS` goes.
* **The mode union is derived from the specs.** A tool's mode is `{ type: "tool"; tool }`, plus `layerId` when its target is `"image"`, plus `optionsOpen` when it has a tray, written as one mapped type over `TOOL_SPECS` and flattened so hovers show plain objects. `ToolStart` is derived the same way. It's one member per tool where today's has one for Draw, Redact, and Find together, but `toolImageId`, `openTray`, and every narrowing keep working. A hand-written union would repeat the names and fields the specs hold, and checking it against them would take as much type-level code as deriving it.
* **The reducer reads specs, not names.** `toolMode(start)` adds `optionsOpen: false` when the spec has a tray. TypeScript can't check a member of the mapped union built from a generic tool, so it casts once; `editorMode.test.ts` covers each tool's mode. `settle` puts a tool down by its target: `"image"` when `isAdjustable(layerId)` fails, `"photo"` when there's no photo. `ModeTargets.canFind` becomes `hasPhoto`. `toolImageId(mode, tool)` takes any `"image"` tool.
* **Each controller owns its canvas input.** Draw's, Redact's, and Cut out's hooks return a memoized `canvasInput` (`{ type: "tool", tool }` from `drawCanvasTool`, `redactCanvasTool`, or `cutCanvasTool`), Find's its regions to tap, and Adjust's its dial drag, which moves from `useCanvasInput` into `useAdjustTool`. A definition's `canvasInput(controller)` hands it over. Each hook memoizes on its own inputs, so the part-by-part memoization in `useCanvasInput` goes with the per-tool arguments. The builders' tests in each tool's `__tests__/` stay as they are.
  * `useCutOutTool` takes the document's size, which `cutCanvasTool` needs; Draw's and Redact's hooks take it already.
  * Find's input is null without an image, as Cut out's is while its image is hidden, so a definition's `canvasInput` returns `CanvasInput | null`.
  * Find's `toggle` becomes stable, or its memoized input would still be rebuilt every render: `detection.toggle` is already a callback, and `setReviewed((reviewed) => reviewed === null ? null : index)` drops the dependency on `reviewed`.
* **Each controller finishes its own strokes.** Draw's hook handles `draw` and `drawShape`, Redact's `redactBrush` and `redactBox`, and Cut out's `cutBrush` and `pickSubject`, each as `finishStroke(stroke)`. A definition's `finishStroke` hands the stroke to it. The eyedropper's `pickColor` is the editor's and stays in `useCanvasInput`. Handing a stroke to the open tool is the same as switching on its kind: `useToolStroke` builds the stroke when the finger lifts from the open tool's canvas tool, and drops it when no tool is open.
* **`canvasInputFor` keeps only what isn't a tool's.** The eyedropper's pick, then the open tool's input, then typing, then selecting. `canvasToolFor` goes. Its tests become tests of that order, and a tool with no input leaves the canvas to typing or selecting. The ones that picked between tools ("gives Cut out the canvas over Draw") go, since only the open tool has a say, and so does Find's "only while it has an image", which is its hook's now.
* **The canvas's input kinds stop naming tools.** `CanvasInput`'s `"find"` becomes `"regions"` (taps toggle the regions shown) and `"adjust"` becomes `"dial"` (a sideways drag turns a dial). `inputRules` and `outlinedLayerFor` follow, and so does `EditorCanvas`. This is a rename only.
* **A tool starts from its definition.** `useEditorTools` has one `startTool(tool)`: without a photo it does nothing for a `"photo"` or `"image"` tool, it calls the definition's `prepare(controller)` if there is one (Draw's and Redact's `chooseTool`), and it dispatches `startTool` with the photo's `layerId` for an `"image"` tool. `ToolStarters`' tool entries are mapped from the list. Text, Sticker, Add photo, and Crop keep their own starters.
* **Cut out's cut starts from a generic hook into the session.** A definition's `started(controller, image)` runs once the tool's undo session has begun: from an effect after `useToolSession`'s, as `pendingCut` does now, and at once when the tool is already open on that image. `pendingCut` becomes `pendingStart`, holding the tool and its image. The comment on the effect order moves with it.
* **Starting an open tool again reopens it.** `startTool` always dispatches, also when the tool is already open on that image. Only the wide rail can do that (it finishes the open tool, then starts the one picked), and today every tool reopens there but Cut out, whose starter returns before dispatching, so the rail's `endTool` closes it. Now Cut out reopens too, and `started` runs at once: an uncut photo has its subjects cut out, and a cut one keeps its cut.
* **What stays.** The tool hooks are still called by name in `useEditorTools`, since their inputs differ. The dock's buttons and keys (`shell/toolList.ts`, `shortcuts.ts`) still list Text, Sticker, Crop, and Add photo beside the tools. `toolList.ts`'s `needsImage` repeats Find's, Adjust's, and Cut out's targets, but `shell/` doesn't import the editor's root, so it stays. Text and Crop are still modes of their own.

## Steps

Each step is its own commit and passes `npm run check`, `npm run typecheck`, and `npm test`.

### 1. Give each tool a spec

No behavior or API change outside the tools.

* Add `toolSpec.ts` (`ToolSpec`), a spec in each tool's folder, and `toolSpecs.ts`. Each imports by relative `.ts` path, as tested modules do.
* `defineTool` takes the spec as `spec`, and its type requires `stepSize` exactly when the spec is `sized`. Each definition passes its spec.
* `__tests__/toolSpecs.test.ts`: each spec's `id` is its key in `TOOL_SPECS`.

`refactor: give each tool a pure spec of what it works on`

### 2. Derive the mode from the specs

* `editorMode.ts`: `EditorTool` from `TOOL_SPECS`, the tool modes and `ToolStart` derived as decided, `toolMode` and `hasTray` from the spec, `settle` by target, `toolImageId(mode, tool)`, and `shortcutCommand` reading `sized`. `SIZED_TOOLS` goes.
* `ModeTargets.canFind` becomes `hasPhoto` (`EditorScreen.tsx`).
* `__tests__/editorMode.test.ts`: rename `canFind` and update `toolImageId`'s calls. Every expectation stays the same.

`refactor: derive the editor's tool modes from the tools' specs`

### 3. Let each controller give its canvas input

* `useDrawTool`, `useRedactTool`, `useCutOutTool`, `useFindTool`, and `useAdjustTool` return a memoized `canvasInput`. Find's needs its image, which it already takes, and is null without one. Cut out's takes the document's size. Adjust's builds the dial drag that `useCanvasInput` builds now.
* `useFindTool`: a stable `toggle`.
* `defineTool`: `canvasInput(controller)`, a `CanvasInput` or null. Each definition hands its controller's over.
* `canvasInputFor({ eyedropper, toolInput, editingText })`, and `canvasToolFor` goes. `useCanvasInput` takes the open tool's input from its definition in place of `draw`, `redact`, `cut`, `find`, and `adjustController`.
* `__tests__/canvasInputFor.test.ts`: the `canvasToolFor` tests become tests of the order (the eyedropper over a tool's input, a tool's over typing, typing over selecting, and a tool with no input leaving the canvas to either).

`refactor: let each tool give what input on the canvas does`

### 4. Let each controller finish its strokes

* Draw's, Redact's, and Cut out's hooks return `finishStroke(stroke)`, each switching over its own kinds. `defineTool`: `finishStroke(controller, stroke)`.
* `useCanvasInput`'s `finishStroke` keeps `pickColor` and hands the rest to the open tool's definition. Its `actions` argument goes.

`refactor: let each tool finish its own strokes on the canvas`

### 5. Name the canvas's input kinds for what they do

* `CanvasInput`: `"find"` → `"regions"`, `"adjust"` → `"dial"`, in `canvasInputFor.ts`, `EditorCanvas.tsx`, `tools/find/useFindTap.ts`, and the tests.

`refactor: name the canvas's input kinds for what they do`

### 6. Start each tool from its definition

* `defineTool`: `prepare(controller)` and `started(controller, image)`. Draw's and Redact's `prepare` is `chooseTool`; Cut out's `started` is `start`.
* `useEditorTools`: one `startTool(tool)` as decided, which always dispatches, `pendingStart` in place of `pendingCut`, and `ToolStarters`' tool entries mapped from the list. `startDrawing`, `startRedacting`, `startFinding`, `startAdjusting`, and `startCutOut` go.

`refactor: start each tool from its definition`

Its message says that picking Cut out again from the wide rail now reopens it.

### 7. Docs

* `docs/architecture.md`: tool specs and definitions, what a definition gives the canvas and the mode, and the boundaries (tools reach the editor through `defineTool.ts`, `toolSpec.ts`, and `editorContext.ts`).
* `docs/plans/tool-independence-plan.md`: take what this plan moved out of "Still central".

`docs: describe tool specs, and what definitions give the mode and the canvas`

## Checks

After steps 3, 4, and 6, in the web editor at 390 and 1440 points wide, and once at the end on the iOS simulator:

* **Starting.** Each tool from its dock or rail button, its key, and a photo's layer actions. Draw and Redact pick their sub-tool from a selected drawing, shape, or redaction. Find, Adjust, and Cut out don't start without a photo. Cut out on an uncut photo cuts out its subjects at once, Cancel takes the cut back in one step, and opening it again on a cut photo keeps the cut to refine. At 1440, picking the open tool again from the rail reopens it, Cut out included.
* **Putting down.** Hiding or deleting the image puts Adjust or Cut out down, and deleting the last photo puts Find down.
* **The canvas.** A pen, highlighter, and eraser stroke; a dragged rectangle and arrow, and a drag that moves the selected shape; a Redact box, a brushed redaction that joins the selected one, and a tap that selects a box; a Keep and an Erase stroke and a Pick tap in Cut out; a Find region chosen and unchosen; a sideways drag in Adjust; the eyedropper from Draw's color; and a tap off the document that puts the tool down.
* **Keys.** `[` and `]` in Draw, Redact, and Cut out, and nothing in Find or Adjust.
