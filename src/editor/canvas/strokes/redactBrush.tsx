import { useDerivedValue } from "react-native-reanimated";
import { Picture } from "react-native-skia";
import { identityTransform } from "../../layers/base";
import { strokePath } from "../../layers/drawing/DrawingLayerView";
import {
	maskMarks,
	recordRedactionStrokes,
} from "../../layers/redaction/RedactionLayerView";
import type { RedactionStrokes } from "../../layers/redaction/redaction";
import type { CanvasTool } from "../canvasTool";
import { type LiveStroke, type StrokeKind, unlanded } from "./strokeTypes";

type RedactBrushTool = Extract<CanvasTool, { type: "redactBrush" }>;

/**
 * A redaction's strokes with one still being painted, in the layer's own
 * space, or on its own in document space when it will start a new one
 * (`layer` is null). Recorded again as the stroke grows.
 */
function LiveRedactionStrokes({
	layer,
	stroke,
	tool,
}: {
	layer: RedactionStrokes | null;
	stroke: LiveStroke;
	tool: RedactBrushTool;
}) {
	const { brush } = tool;
	const effect = layer?.effect ?? tool.effect;
	const transform = layer?.transform ?? null;
	const marks = layer ? maskMarks(layer.strokes) : [];
	const picture = useDerivedValue(() => {
		const points = unlanded(stroke);
		return recordRedactionStrokes(
			effect,
			transform ?? identityTransform,
			marks,
			points.length === 0
				? null
				: {
						mark: {
							path: strokePath(points),
							width: brush.width,
							eraser: brush.type === "eraser",
						},
						layerTransform: transform,
					},
			null,
		);
	}, [effect, transform, marks, brush, stroke]);
	return <Picture picture={picture} />;
}

export const redactBrushStrokeKind: StrokeKind<RedactBrushTool> = {
	reaches: (_tool, layer, selectedId) => layer.id === selectedId,
	startsLayer: (selectedId) => selectedId === null,
	renderInLayer: ({ layer, stroke, tool }) =>
		layer.type === "redaction" && layer.shape === "strokes" ? (
			<LiveRedactionStrokes layer={layer} stroke={stroke} tool={tool} />
		) : null,
	renderNewLayer: (stroke, tool) =>
		tool.brush.type === "pen" ? (
			<LiveRedactionStrokes layer={null} stroke={stroke} tool={tool} />
		) : null,
};
