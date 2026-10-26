import { useMemo } from "react";
import type { EditorDocument } from "@/model/document";
import type { Point, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import { sampleColor } from "@/render/renderDocument";
import type { EditorStoreActions } from "@/store/editorSlice";
import type { ToolStroke } from "./canvas/canvasTool";
import { canvasInputFor, canvasToolFor } from "./canvasInputFor";
import type { EditorModeAction, EditorTool, Eyedropper } from "./editorMode";
import { isCustomColor } from "./shell/ColorSwatches";
import type { DialDrag } from "./shell/dialDrag";
import {
	ADJUST_DIAL_MAX,
	ADJUST_DIAL_SCALE,
	type useAdjustTool,
} from "./tools/adjust/useAdjustTool";
import type { CutOutSettings, CutOutTool } from "./tools/cutout/cutOutSettings";
import type { BrushSettings } from "./tools/draw/brushSettings";
import type { RedactSettings } from "./tools/redact/redactSettings";

/**
 * What input on the canvas does for the editor's state (see `canvasToolFor`
 * and `canvasInputFor`), and where what it makes goes: strokes, boxes, and
 * shapes into the document, a picked color to the eyedropper's target, and
 * a tap on the image being cut out to Cut out. Spread onto `EditorCanvas`.
 */
export function useCanvasInput({
	document,
	size,
	tool,
	eyedropper,
	editingText,
	draw,
	redact,
	cut,
	findImageId,
	onFindToggle,
	adjustController,
	actions,
	dispatchMode,
	onCustomColor,
}: {
	document: EditorDocument;
	size: Size;
	tool: EditorTool | null;
	eyedropper: Eyedropper | null;
	editingText: boolean;
	draw: BrushSettings;
	redact: RedactSettings;
	cut: {
		layer: ImageLayer | undefined;
		settings: CutOutSettings;
		tool: CutOutTool;
		pickSubject: (point: Point) => void;
	};
	findImageId: string | null;
	onFindToggle: (sourceIndex: number) => void;
	adjustController: ReturnType<typeof useAdjustTool>;
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
	const picking = eyedropper !== null;
	const cutLayerId = cut.layer?.id ?? null;
	const { settings: cutSettings, tool: cutTool } = cut;
	const canvasTool = useMemo(
		() =>
			canvasToolFor({
				eyedropper: picking,
				tool,
				cut:
					cutLayerId === null
						? null
						: { layerId: cutLayerId, settings: cutSettings, tool: cutTool },
				draw,
				redact,
				size,
			}),
		[picking, tool, cutLayerId, cutSettings, cutTool, draw, redact, size],
	);
	// A sideways drag over the photo turns Adjust's dial, as the dial does.
	const { dialValue, begin, change, end } = adjustController;
	const adjustDrag = useMemo(
		(): DialDrag => ({
			value: dialValue,
			scale: ADJUST_DIAL_SCALE,
			max: ADJUST_DIAL_MAX,
			onBegin: begin,
			onChange: change,
			onEnd: end,
		}),
		[dialValue, begin, change, end],
	);
	const input = useMemo(
		() =>
			canvasInputFor({
				canvasTool,
				tool,
				find:
					findImageId === null
						? null
						: { imageId: findImageId, onToggle: onFindToggle },
				adjustDrag,
				editingText,
			}),
		[canvasTool, tool, findImageId, onFindToggle, adjustDrag, editingText],
	);

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
				cut.pickSubject(stroke.point);
				break;
		}
	};

	return { input, onToolStroke: finishStroke };
}
