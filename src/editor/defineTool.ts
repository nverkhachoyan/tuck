import type { ComponentType } from "react";
import type { DerivedValue } from "react-native-reanimated";
import type { ToolStroke } from "./canvas/canvasTool";
import type { CanvasInput } from "./canvasInputFor";
import type { EditorDocument } from "./document/document";
import type { Point, Rect, Size } from "./document/geometry";
import type { EditorHost, PickedImage } from "./editorHost";
import type { ImageLayer } from "./layers/image/image";
import type { Layer } from "./layers/layer";
import type { LayerAction } from "./shell/LayerActionsPanel";
import type { OwnTool } from "./shell/toolList";
import type { ToolId, ToolSpec } from "./toolSpec";

type ToolView<C> = ComponentType<{ controller: C }>;

type ToolViews<C> = {
	Dock?: ToolView<C>;
	Bar?: ToolView<C>;
	Tray?: ToolView<C>;
	Results?: ToolView<C>;
	Card?: ToolView<C>;
	Controls?: ToolView<C>;
	Sheet?: ToolView<C>;
	Input?: ToolView<C>;
	Draft?: ComponentType<{ controller: C; viewScale: DerivedValue<number> }>;
};

/**
 * What the editor gives a tool's hook, which runs in the editor's body,
 * above the context its views read.
 * - `open`: whether the tool is open.
 * - `image`: what its spec's target gives: the target photo for "photo",
 *   the image it started on while it's open for "image", and null for
 *   "none".
 * - `close`: puts the tool down, keeping its changes.
 * - `notify`: shows `message` in the edit notice, with Undo, and `action`
 *   beside it when given.
 * - `view`: zooms the canvas to an area of the document, or back to the
 *   fit, and gives the part of the document in view.
 * - `addImage`: keeps an image the tool made, as the host does.
 * - `addLayerImage`: adds the image `load` gives as a photo or a sticker,
 *   placed in view; one image is added at a time, Add photo's included, and
 *   an alert shows if it fails. Null from `load` adds nothing.
 * - `pickPhoto`, `importPhoto`: read a photo as the host does.
 * - `startTool`: opens `tool` on `image`, finishing any other open tool.
 */
export type ToolEnv = {
	document: EditorDocument;
	documentSize: Size;
	open: boolean;
	image: ImageLayer | null;
	close: () => void;
	notify: (message: string, action?: NoticeAction) => void;
	view: {
		zoomToArea: (area: Rect) => void;
		fit: () => void;
		visibleArea: () => Rect | undefined;
	};
	addImage: EditorHost["addImage"];
	addLayerImage: (
		load: () => Promise<PickedImage | null>,
		kind: "image" | "sticker",
	) => void;
	pickPhoto: EditorHost["pickPhoto"];
	importPhoto: EditorHost["importPhoto"];
	startTool: (tool: ToolId, image: ImageLayer) => void;
};

/** A button the edit notice shows beside Undo. */
export type NoticeAction = { label: string; onPress: () => void };

/**
 * One of the editor's tools, as its own folder describes it, given its
 * controller `C` (what its hook returns). The editor reads it wherever it
 * shows or finishes the tool.
 * - `spec`: what the mode, the chrome, and the shortcuts know of it (see
 *   `ToolSpec`).
 * - `useController`: its hook, given what the editor gives it (`ToolEnv`).
 * - `views.Dock`: the phone dock's panel; without it, the dock holds only
 *   the title, ✕, and ✓.
 * - `views.Bar`: the wide header's options, inside the shared `ContextBar`;
 *   without it, the bar has the title, ✕, and ✓ only.
 * - `views.Tray`: the phone's tray of options, while it's open.
 * - `views.Results`: what sits over the canvas while its panel shows, no
 *   tray is open, and the eyedropper isn't running.
 * - `views.Card`: a card along the bottom of a wide canvas while it's open,
 *   which the canvas fits above. It leaves the canvas's gestures alone, so
 *   it suits what a tool reports or turns while the photo stays in reach.
 * - `views.Stage`: drawn in the canvas's place, opaque over it, while it's
 *   open. A tool with one has no `canvasInput` or `finishStroke`.
 * - `views.Controls`: a strip under the canvas while it's open, above the
 *   phone's dock or along the bottom of a wide stage.
 * - `views.Sheet`: shown while it's open, in a bottom sheet on a phone and
 *   in a popover beside its rail button on a wide window. Dismissing it
 *   closes the tool.
 * - `views.Input`: mounted out of sight behind the header while it's open,
 *   for a hidden input that takes the keyboard, only when its spec's
 *   `takesKeys` is "typing".
 * - `views.Draft`: drawn in the scene in place of `draft`'s layer, or on top
 *   of the layers when it's new, given the view's scale.
 * - `sheetTitle`: what its sheet is called, when that isn't its label.
 * - `sheetDismissed`: what it does once its sheet has finished closing.
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
 * - `layerAction`: a button it adds to the selected `layer`'s actions, or
 *   null.
 * - `draft`: the layer it's editing in place while it's open, as placed and
 *   outlined, and whether it's new, or null; `views.Draft` draws it.
 * - `edit`: editing a layer it `owns` in place. A tap on a selected layer
 *   it owns, the selection bar's Edit, and Enter call `start` with that
 *   layer and where the tap landed in its space (null for the end), then
 *   open the tool without `prepare`. While one it owns is selected and
 *   nothing is open, its `Dock`, `Bar`, and `Results` show, titled with its
 *   label, with no Cancel, and Done letting go of the layer.
 * - `stepSize`: steps its brush for `[` and `]`, exactly when its spec is
 *   `sized`.
 * - `run`: what pressing it does on its target image, exactly when its spec
 *   is an `action`. Such a tool has no views and no canvas input.
 * - `busy`: whether its button spins, while what it runs is working.
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
	busy?: (controller: C) => boolean;
	sheetTitle?: string;
	sheetDismissed?: (controller: C) => void;
	layerAction?: (controller: C, layer: Layer) => LayerAction | null;
	draft?: (controller: C) => { layer: Layer; isNew: boolean } | null;
	edit?: {
		owns: (layer: Layer) => boolean;
		start: (controller: C, layer: Layer, point: Point | null) => void;
	};
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
	) &
	(
		| {
				spec: ToolSpec & { action: true };
				run: (controller: C, image: ImageLayer) => void;
		  }
		| { spec: ToolSpec & { action?: never }; run?: never }
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
