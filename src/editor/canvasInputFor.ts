import type { DerivedValue } from "react-native-reanimated";
import type { ColorMatrix } from "../model/adjustments.ts";
import type { Layer } from "../model/layers/layer.ts";
import {
	type CanvasTool,
	cutImageId,
	drags,
	restyles,
} from "./canvas/canvasTool.ts";
import type { CanvasRegion } from "./canvas/RegionOutline.tsx";
import type { DialDrag } from "./shell/dialDrag.ts";

/**
 * What input on the canvas does, one at a time: select and transform
 * layers; paint, drag out a box or a shape, or pick a color with a `tool`;
 * place the caret in, or select, the text being edited; toggle the
 * `regions` shown over the image `imageId` with taps, as Find does; or hold
 * the layers still and turn a dial with a sideways drag (`drag`), as Adjust
 * does, drawing the image it changes live (`adjusting`).
 */
export type CanvasInput =
	| { type: "select" }
	| { type: "tool"; tool: CanvasTool }
	| { type: "editText" }
	| {
			type: "regions";
			imageId: string;
			regions: readonly CanvasRegion[];
			onToggle: (sourceIndex: number) => void;
	  }
	| { type: "dial"; drag: DialDrag; adjusting: LiveAdjustment | null };

/**
 * An image layer whose adjustments a dial is changing: `matrix` colors it
 * meanwhile, following the dial without rendering React.
 */
export type LiveAdjustment = {
	layerId: string;
	matrix: DerivedValue<ColorMatrix>;
};

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
		case "regions":
			return { selection: "still", oneFinger: "anywhere", cursor: "pointer" };
		// One finger turns the dial, so two move the view.
		case "dial":
			return { selection: "still", oneFinger: null, cursor: "ew-resize" };
	}
}

const PICK_COLOR: CanvasInput = { type: "tool", tool: { type: "pickColor" } };
const EDIT_TEXT: CanvasInput = { type: "editText" };
const SELECT: CanvasInput = { type: "select" };

/**
 * What input on the canvas does, first match winning: the eyedropper's
 * pick, the open tool's input (`toolInput`), typing, or else selecting.
 */
export function canvasInputFor({
	eyedropper,
	toolInput,
	editingText,
}: {
	eyedropper: boolean;
	toolInput: CanvasInput | null;
	editingText: boolean;
}): CanvasInput {
	if (eyedropper) return PICK_COLOR;
	if (toolInput) return toolInput;
	if (editingText) return EDIT_TEXT;
	return SELECT;
}

/**
 * The layer outlined for `input`: the image being cut out or adjusted
 * where it could be mistaken for another, the text being
 * edited, or a redaction or shape whose style the tool changes, unless its
 * handles already show it.
 */
export function outlinedLayerFor(
	input: CanvasInput,
	{
		layers,
		selectedLayer,
		editedLayer,
	}: {
		layers: readonly Layer[];
		selectedLayer: Layer | undefined;
		editedLayer: Layer | null;
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
		case "dial":
			return input.adjusting && outlinedImage(layers, input.adjusting.layerId);
		case "select":
		case "regions":
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
