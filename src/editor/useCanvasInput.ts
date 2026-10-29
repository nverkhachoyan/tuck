import type { EditorDocument } from "@/model/document";
import type { Point } from "@/model/geometry";
import type { ToolStroke } from "./canvas/canvasTool";
import { canvasInputFor } from "./canvasInputFor";
import type { ToolControllers } from "./defineTool";
import type { EditorModeAction, Eyedropper } from "./editorMode";
import { sampleColor } from "./render/renderDocument";
import { isCustomColor } from "./shell/ColorSwatches";
import type { ToolId } from "./toolSpec";

/**
 * What input on the canvas does for the editor's state (see
 * `canvasInputFor`), with the open `tool`'s input from its definition, and
 * where what it makes goes: a picked color to the eyedropper's target, and
 * the rest to the open tool. Spread onto `EditorCanvas`.
 */
export function useCanvasInput({
	document,
	tool,
	controllers,
	eyedropper,
	dispatchMode,
	onCustomColor,
}: {
	document: EditorDocument;
	tool: ToolId | null;
	controllers: ToolControllers;
	eyedropper: Eyedropper | null;
	dispatchMode: (action: EditorModeAction) => void;
	onCustomColor: (color: string) => void;
}) {
	const open = tool ? controllers[tool] : null;
	// Each tool memoizes its own input, so this one changes only with it.
	const input = canvasInputFor({
		eyedropper: eyedropper !== null,
		toolInput: open?.definition.canvasInput?.(open.controller) ?? null,
	});

	// A picked color becomes the custom color too, unless a swatch already
	// has it. Where the canvas shows nothing, it keeps waiting for a tap.
	const pickColor = async (point: Point) => {
		const target = eyedropper;
		if (!target) return;
		const color = await sampleColor(document, point).catch(() => null);
		if (!color) return;
		target.apply(color);
		if (isCustomColor(color)) onCustomColor(color);
		dispatchMode({ type: "stopEyedropper", eyedropper: target });
	};
	// The eyedropper's pick is the editor's; the rest are the open tool's.
	const finishStroke = (stroke: ToolStroke) => {
		if (stroke.type === "pickColor") void pickColor(stroke.point);
		else open?.definition.finishStroke?.(open.controller, stroke);
	};

	return { input, onToolStroke: finishStroke };
}
