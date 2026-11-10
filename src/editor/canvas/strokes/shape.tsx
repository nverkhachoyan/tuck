import { useDerivedValue } from "react-native-reanimated";
import { Group, Path, Skia } from "react-native-skia";
import { identityTransform } from "../../layers/base";
import { toTransformList } from "../../layers/layerTransform";
import { shapePath } from "../../layers/shape/ShapeLayerView";
import { isLineShape } from "../../layers/shape/shape";
import { lineReach } from "../../layers/shape/shapeGeometry";
import type { CanvasTool } from "../canvasTool";
import { shapeFromDrag } from "../shapeDrag";
import {
	dragEnds,
	type LiveStroke,
	type StrokeKind,
	unlanded,
} from "./strokeTypes";

type DrawShapeTool = Extract<CanvasTool, { type: "drawShape" }>;

/**
 * A shape as it's dragged out, from where the drag began to where it is, as
 * the document will have it: a box between them, or a line to it.
 */
function LiveNewShape({
	stroke,
	tool,
}: {
	stroke: LiveStroke;
	tool: DrawShapeTool;
}) {
	const { shape, style } = tool;
	const placement = useDerivedValue(() => {
		const points = unlanded(stroke);
		if (points.length === 0) return null;
		const [from, to] = dragEnds(points);
		return shapeFromDrag(shape, from, to);
	});
	const transform = useDerivedValue(() => {
		const { x = 0, y = 0, rotation = 0 } = placement.value ?? {};
		return toTransformList({ ...identityTransform, x, y, rotation });
	});
	const path = useDerivedValue(() => {
		const shown = placement.value;
		if (!shown || shown.width === 0) return Skia.PathBuilder.Make().build();
		return shapePath(
			shape,
			shown.width / 2,
			isLineShape(shape)
				? lineReach(shape, style.strokeWidth)
				: shown.height / 2,
			style.strokeWidth,
		);
	});
	return (
		<Group transform={transform}>
			<Path path={path} color={style.color} />
		</Group>
	);
}

export const shapeStrokeKind: StrokeKind<DrawShapeTool> = {
	reaches: () => false,
	startsLayer: () => true,
	renderNewLayer: (stroke, tool) => (
		<LiveNewShape stroke={stroke} tool={tool} />
	),
};
