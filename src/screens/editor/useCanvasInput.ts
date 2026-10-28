import type { EditorDocument } from "@/model/document";
import type { Point } from "@/model/geometry";
import { sampleColor } from "@/render/renderDocument";
import type { EditorStoreActions } from "@/store/editorSlice";
import type { ToolStroke } from "./canvas/canvasTool";
import { canvasInputFor } from "./canvasInputFor";
import type { EditorModeAction, EditorTool, Eyedropper } from "./editorMode";
import { isCustomColor } from "./shell/ColorSwatches";
import { toolWithController } from "./toolDefinitions";
import type { EditorTools } from "./useEditorTools";

/**
 * What input on the canvas does for the editor's state (see
 * `canvasInputFor`), with the open `tool`'s input from its definition, and
 * where what it makes goes: strokes, boxes, and shapes into the document, a
 * picked color to the eyedropper's target, and a tap on the image being cut
 * out to Cut out. Spread onto `EditorCanvas`.
 */
export function useCanvasInput({
	document,
	tool,
	tools,
	eyedropper,
	editingText,
	actions,
	dispatchMode,
	onCustomColor,
}: {
	document: EditorDocument;
	tool: EditorTool | null;
	tools: EditorTools;
	eyedropper: Eyedropper | null;
	editingText: boolean;
	actions: Pick<
		EditorStoreActions,
		| "drawStroke"
		| "paintRedaction"
		| "paintMask"
		| "addRedactionBox"
		| "addShape"
	>;
	dispatchMode: (action: EditorModeAction) => void;
	onCustomColor: (color: string) => void;
}) {
	const open = tool && toolWithController(tool, tools);
	// Each tool memoizes its own input, so this one changes only with it.
	const input = canvasInputFor({
		eyedropper: eyedropper !== null,
		toolInput: open?.definition.canvasInput?.(open.controller) ?? null,
		editingText,
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
	const finishStroke = (stroke: ToolStroke) => {
		switch (stroke.type) {
			case "draw":
				actions.drawStroke({ ...stroke.brush, points: stroke.points });
				break;
			case "redactBrush":
				actions.paintRedaction(
					{ ...stroke.brush, points: stroke.points },
					stroke.effect,
				);
				break;
			case "cutBrush":
				actions.paintMask(stroke.layerId, {
					...stroke.brush,
					points: stroke.points,
				});
				break;
			case "redactBox":
				actions.addRedactionBox(stroke.rect, stroke.effect);
				break;
			case "drawShape":
				actions.addShape(stroke.shape, stroke.placement, stroke.style);
				break;
			case "pickColor":
				void pickColor(stroke.point);
				break;
			case "pickSubject":
				tools.cutOut.pickSubject(stroke.point);
				break;
		}
	};

	return { input, onToolStroke: finishStroke };
}
