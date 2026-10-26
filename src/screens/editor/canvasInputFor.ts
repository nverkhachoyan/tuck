import type { Size } from "../../model/geometry.ts";
import type { CanvasInput, CanvasTool } from "./canvas/canvasInput.ts";
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
