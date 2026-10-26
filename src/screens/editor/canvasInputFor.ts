import type { Size } from "../../model/geometry.ts";
import type { Layer } from "../../model/layers/layer.ts";
import {
	type CanvasTool,
	cutImageId,
	drags,
	restyles,
} from "./canvas/canvasTool.ts";
import type { EditorTool } from "./editorMode.ts";
import type { DialDrag } from "./shell/dialDrag.ts";
import {
	type CutOutSettings,
	type CutOutTool,
	cutCanvasTool,
} from "./tools/cutout/cutOutSettings.ts";
import {
	type BrushSettings,
	drawCanvasTool,
} from "./tools/draw/brushSettings.ts";
import {
	type RedactSettings,
	redactCanvasTool,
} from "./tools/redact/redactSettings.ts";

/**
 * What input on the canvas does, one at a time: select and transform
 * layers; paint, drag out a box or a shape, or pick a color with a `tool`;
 * place the caret in, or select, the text being edited; toggle what Find
 * found in the image `imageId`; or, while adjusting, hold the layers still
 * and turn the dial with a sideways drag (`drag`).
 */
export type CanvasInput =
	| { type: "select" }
	| { type: "tool"; tool: CanvasTool }
	| { type: "editText" }
	| { type: "find"; imageId: string; onToggle: (sourceIndex: number) => void }
	| { type: "adjust"; drag: DialDrag };

export type InputRules = {
	// What the selection does: holds still, without handles; transforms with
	// any gesture; or, while dragging out boxes or shapes, moves and resizes
	// with one finger that lands on it or its handles, which the tool's
	// drags elsewhere leave be.
	selection: "still" | "transforms" | "drags";
	// Where one finger pans the view: anywhere, where taps don't drag; off
	// the selection and its handles, while zoomed in; or nowhere.
	oneFinger: "anywhere" | "offSelection" | null;
	// The pointer's cursor, or "hover" to leave it to what's under it.
	cursor: "pointer" | "crosshair" | "grab" | "ew-resize" | "default" | "hover";
};

/**
 * What `input` asks of the canvas's shared behavior, `zoomed` in or not,
 * with `selected` the selected layer.
 */
export function inputRules(
	input: CanvasInput,
	zoomed: boolean,
	selected?: Layer,
): InputRules {
	switch (input.type) {
		case "select":
			return {
				selection: "transforms",
				oneFinger: zoomed ? "offSelection" : null,
				cursor: "hover",
			};
		case "tool":
			return drags(input.tool, selected)
				? { selection: "drags", oneFinger: null, cursor: "hover" }
				: { selection: "still", oneFinger: null, cursor: "crosshair" };
		case "editText":
			return { selection: "still", oneFinger: null, cursor: "hover" };
		case "find":
			return { selection: "still", oneFinger: "anywhere", cursor: "pointer" };
		// One finger turns the dial, so two move the view.
		case "adjust":
			return { selection: "still", oneFinger: null, cursor: "ew-resize" };
	}
}

/**
 * What dragging on a canvas of `size` does, first match winning: the
 * eyedropper's pick, Cut out's brush or its tap that picks a subject in the
 * image `cut.layerId`, Draw's shape or brush, or Redact's brush or box. Null
 * when the canvas's drags are left to selecting, Find, Adjust, or typing.
 */
export function canvasToolFor({
	eyedropper,
	tool,
	cut,
	draw,
	redact,
	size,
}: {
	eyedropper: boolean;
	tool: EditorTool | null;
	cut: { layerId: string; settings: CutOutSettings; tool: CutOutTool } | null;
	draw: BrushSettings;
	redact: RedactSettings;
	size: Size;
}): CanvasTool | null {
	if (eyedropper) return { type: "pickColor" };
	if (cut) return cutCanvasTool(cut.layerId, cut.settings, cut.tool, size);
	if (tool === "draw") return drawCanvasTool(draw, size);
	if (tool === "redact") return redactCanvasTool(redact, size);
	return null;
}

/**
 * What input on the canvas does: the `canvasTool`'s drags, then Find's taps
 * on what it found, Adjust's dial (`adjustDrag`), typing, or else selecting.
 */
export function canvasInputFor({
	canvasTool,
	tool,
	find,
	adjustDrag,
	editingText,
}: {
	canvasTool: CanvasTool | null;
	tool: EditorTool | null;
	find: { imageId: string; onToggle: (sourceIndex: number) => void } | null;
	adjustDrag: DialDrag;
	editingText: boolean;
}): CanvasInput {
	if (canvasTool) return { type: "tool", tool: canvasTool };
	if (tool === "find" && find) return { type: "find", ...find };
	if (tool === "adjust") return { type: "adjust", drag: adjustDrag };
	if (editingText) return { type: "editText" };
	return { type: "select" };
}

/**
 * The layer outlined for `input`: the image being cut out or adjusted
 * (`adjustedId`) where it could be mistaken for another, the text being
 * edited, or a redaction or shape whose style the tool changes, unless its
 * handles already show it.
 */
export function outlinedLayerFor(
	input: CanvasInput,
	{
		layers,
		selectedLayer,
		editedLayer,
		adjustedId,
	}: {
		layers: readonly Layer[];
		selectedLayer: Layer | undefined;
		editedLayer: Layer | null;
		adjustedId: string | undefined;
	},
): Layer | null {
	switch (input.type) {
		case "tool": {
			const cutId = cutImageId(input.tool);
			if (cutId !== null) return outlinedImage(layers, cutId);
			return restyles(input.tool, selectedLayer) &&
				!drags(input.tool, selectedLayer)
				? selectedLayer
				: null;
		}
		case "editText":
			return editedLayer;
		case "adjust":
			return adjustedId === undefined
				? null
				: outlinedImage(layers, adjustedId);
		case "select":
		case "find":
			return null;
	}
}

/** The image `id`, only when there's another image it could be taken for. */
function outlinedImage(layers: readonly Layer[], id: string): Layer | null {
	const images = layers.filter((layer) => layer.type === "image");
	return images.length > 1
		? (images.find((layer) => layer.id === id) ?? null)
		: null;
}
