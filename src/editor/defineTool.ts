import type { ComponentType, ReactNode } from "react";
import type { EditorDocument } from "@/model/document";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import type { ToolStroke } from "./canvas/canvasTool";
import type { CanvasInput } from "./canvasInputFor";
import type { EditorHost } from "./editorHost";
import type { OwnTool } from "./shell/toolList";
import type { ToolId, ToolSpec } from "./toolSpec";

type ToolView<C> = ComponentType<{ controller: C }>;

type ToolViews<C> = {
	Dock: ToolView<C>;
	Bar?: ToolView<C>;
	Tray?: ToolView<C>;
	Results?: ToolView<C>;
	Inspector?: ComponentType<{ controller: C; children: ReactNode }>;
	Controls?: ToolView<C>;
};

/**
 * What the editor gives a tool's hook, which runs in the editor's body,
 * above the context its views read.
 * - `open`: whether the tool is open.
 * - `image`: what its spec's target gives: the target photo for "photo",
 *   the image it started on while it's open for "image", and null for
 *   "none".
 * - `close`: puts the tool down, keeping its changes.
 * - `notify`: shows `message` in the edit notice, with Undo.
 * - `view`: zooms the canvas to an area of the document, or back to the fit.
 * - `addImage`: keeps an image the tool made, as the host does.
 */
export type ToolEnv = {
	document: EditorDocument;
	documentSize: Size;
	open: boolean;
	image: ImageLayer | null;
	close: () => void;
	notify: (message: string) => void;
	view: { zoomToArea: (area: Rect) => void; fit: () => void };
	addImage: EditorHost["addImage"];
};

/**
 * One of the editor's tools, as its own folder describes it, given its
 * controller `C` (what its hook returns). The editor reads it wherever it
 * shows or finishes the tool.
 * - `spec`: what the mode, the chrome, and the shortcuts know of it (see
 *   `ToolSpec`).
 * - `useController`: its hook, given what the editor gives it (`ToolEnv`).
 * - `views.Dock`: the phone dock's panel.
 * - `views.Bar`: the wide header's options, inside the shared `ContextBar`;
 *   without it, the bar has the title, ✕, and ✓ only.
 * - `views.Tray`: the phone's tray of options, while it's open.
 * - `views.Results`: what sits over the canvas while no tray is open and the
 *   eyedropper isn't running.
 * - `views.Inspector`: a section above the wide inspector's layers, given
 *   them as children. A tool with one opens the inspector.
 * - `views.Stage`: drawn in the canvas's place, opaque over it, while it's
 *   open. A tool with one has no `canvasInput` or `finishStroke`.
 * - `views.Controls`: a strip under the canvas while it's open, above the
 *   phone's dock or along the bottom of a wide stage.
 * - `prepare`: readies it before it opens, as by picking the sub-tool that
 *   fits the selection.
 * - `started`: what it does with the photo it opened on, once its undo
 *   session has begun.
 * - `canvasInput`: what input on the canvas does while it's open, or null
 *   to leave the canvas to typing or selecting.
 * - `finishStroke`: what a stroke made with its canvas input does, once the
 *   finger lifts.
 * - `doneLabel`: what Done says, when it isn't "Done".
 * - `done`: what Done does before the tool closes.
 * - `deselectOnDone`: whether Done lets go of the selected layer, so a
 *   stray drag can't move what the tool just made.
 * - `reset`: what the header's Reset does while it's open, or undefined to
 *   hide Reset.
 * - `announcement`: what the editor announces for it.
 * - `stepSize`: steps its brush for `[` and `]`, exactly when its spec is
 *   `sized`.
 */
export type ToolDefinition<C> = {
	useController: (env: ToolEnv) => C;
	prepare?: (controller: C) => void;
	started?: (controller: C, image: ImageLayer) => void;
	doneLabel?: (controller: C) => string | undefined;
	done?: (controller: C) => void;
	deselectOnDone?: boolean;
	reset?: (controller: C) => (() => void) | undefined;
	announcement?: (controller: C) => string | null;
} & (
	| {
			views: ToolViews<C> & { Stage?: never };
			canvasInput?: (controller: C) => CanvasInput | null;
			finishStroke?: (controller: C, stroke: ToolStroke) => void;
	  }
	| {
			views: ToolViews<C> & { Stage: ToolView<C> };
			canvasInput?: never;
			finishStroke?: never;
	  }
) &
	(
		| {
				spec: ToolSpec & { sized: true };
				stepSize: (controller: C, step: 1 | -1) => void;
		  }
		| { spec: ToolSpec & { sized: false }; stepSize?: never }
	);

/** A tool's definition, with its controller's type checked against it. */
export function defineTool<C>(
	definition: ToolDefinition<C>,
): ToolDefinition<C> {
	return definition;
}

/**
 * A tool in a list, whatever its controller. A list can't carry each
 * controller's type, so `definitionOf` gives a tool its definition back.
 */
export type Tool = { spec: ToolSpec };

/** The editor's tools, by id. */
export type ToolList = Readonly<Record<ToolId, Tool>>;

export function definitionOf(tool: Tool): ToolDefinition<unknown> {
	return tool as ToolDefinition<unknown>;
}

/** A tool's definition, with the controller its hook built this render. */
export type OpenTool = {
	definition: ToolDefinition<unknown>;
	controller: unknown;
};

/** Each tool, with its controller, by id. */
export type ToolControllers = Record<ToolId, OpenTool>;

// Ids the editor's own entries and panels already use.
type TakenId = OwnTool | "layer" | "idle";

/**
 * `tools` and the order of the dock's and the rail's buttons (`toolbar`),
 * for `<Editor>`, checked to agree: the toolbar names only tools in the
 * list and the editor's own entries, and no tool takes an id the editor
 * uses.
 */
export function editorTools<
	Tools extends ToolList & { [Id in TakenId]?: never },
>(config: {
	tools: Tools;
	toolbar: readonly ((keyof Tools & string) | OwnTool)[];
}): { tools: ToolList; toolbar: readonly string[] } {
	return config;
}
