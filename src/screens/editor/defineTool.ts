import type { ComponentType, ReactNode } from "react";
import type { ToolStroke } from "./canvas/canvasTool";
import type { CanvasInput } from "./canvasInputFor";
import type { ToolSpec } from "./toolSpec";

type ToolView<C> = ComponentType<{ controller: C }>;

/**
 * One of the editor's tools, as its own folder describes it, given its
 * controller `C` (what its hook returns). The editor reads it wherever it
 * shows or finishes the tool.
 * - `spec`: what the mode and the shortcuts know of it (see `ToolSpec`).
 * - `views.Dock`: the phone dock's panel.
 * - `views.Bar`: the wide header's options, inside the shared `ContextBar`;
 *   without it, the bar has the title, ✕, and ✓ only.
 * - `views.Tray`: the phone's tray of options, while it's open.
 * - `views.Results`: what sits over the canvas while no tray is open and the
 *   eyedropper isn't running.
 * - `views.Inspector`: a section above the wide inspector's layers, given
 *   them as children. A tool with one opens the inspector.
 * - `canvasInput`: what input on the canvas does while it's open, or null
 *   to leave the canvas to typing or selecting.
 * - `finishStroke`: what a stroke made with its canvas input does, once the
 *   finger lifts.
 * - `doneLabel`: what Done says, when it isn't "Done".
 * - `done`: what Done does before the tool closes.
 * - `deselectOnDone`: whether Done lets go of the selected layer, so a
 *   stray drag can't move what the tool just made.
 * - `stepSize`: steps its brush for `[` and `]`, exactly when its spec is
 *   `sized`.
 */
export type ToolDefinition<C> = {
	views: {
		Dock: ToolView<C>;
		Bar?: ToolView<C>;
		Tray?: ToolView<C>;
		Results?: ToolView<C>;
		Inspector?: ComponentType<{ controller: C; children: ReactNode }>;
	};
	canvasInput?: (controller: C) => CanvasInput | null;
	finishStroke?: (controller: C, stroke: ToolStroke) => void;
	doneLabel?: (controller: C) => string | undefined;
	done?: (controller: C) => void;
	deselectOnDone?: boolean;
} & (
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
