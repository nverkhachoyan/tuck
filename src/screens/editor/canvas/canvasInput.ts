import type { Brush } from "../../../model/layers/drawing.ts";
import type { CutStroke } from "../../../model/layers/image.ts";
import type { Layer } from "../../../model/layers/layer.ts";
import type { RedactionEffect } from "../../../model/layers/redaction.ts";
import type { ShapeKind, ShapeStyle } from "../../../model/layers/shape.ts";
import type { MaskStroke } from "../../../model/strokes.ts";
import type { DialDrag } from "../shell/dialDrag.ts";

/**
 * What dragging on the canvas does in place of moving layers: draws with a
 * brush, drags out a shape or a redaction's box, paints a redaction's
 * strokes, picks a color where the finger lifts, paints the cut of the image
 * `layerId`, or picks the subject to cut out of it with a tap.
 */
export type CanvasTool =
	| { type: "draw"; brush: Brush }
	| { type: "drawShape"; shape: ShapeKind; style: ShapeStyle }
	| { type: "pickColor" }
	| { type: "redactBox"; effect: RedactionEffect }
	| {
			type: "redactBrush";
			brush: Omit<MaskStroke, "points">;
			effect: RedactionEffect;
	  }
	| { type: "cutBrush"; layerId: string; brush: Omit<CutStroke, "points"> }
	| { type: "pickSubject"; layerId: string };

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
 * Whether `tool` moves `layer` when it's selected: one it drags out, a
 * redaction or a shape, and not locked.
 */
function drags(tool: CanvasTool, layer: Layer | undefined): boolean {
	if (!layer || layer.locked) return false;
	switch (tool.type) {
		case "redactBox":
			return layer.type === "redaction";
		case "drawShape":
			return layer.type === "shape";
		case "draw":
		case "redactBrush":
		case "pickColor":
		case "cutBrush":
		case "pickSubject":
			return false;
	}
}
