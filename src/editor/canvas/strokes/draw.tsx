import { useDerivedValue } from "react-native-reanimated";
import { Group, Paint } from "react-native-skia";
import { BrushStroke, strokePath } from "../../layers/drawing/DrawingLayerView";
import type { PenBrush } from "../../layers/drawing/drawing";
import { LayerContent } from "../../layers/LayerContent";
import { toInverseTransformList } from "../../layers/layerTransform";
import type { CanvasTool } from "../canvasTool";
import {
	DIMMED_OPACITY,
	type LiveStroke,
	type StrokeKind,
	unlanded,
} from "./strokeTypes";

type DrawTool = Extract<CanvasTool, { type: "draw" }>;

/**
 * A stroke as it's being painted, in document space. Keyed by `landedId`, so
 * a landed stroke gives way to the document's copy in one update.
 */
function LivePath({
	stroke,
	brush,
	full = false,
}: {
	stroke: LiveStroke;
	brush: PenBrush;
	full?: boolean;
}) {
	const path = useDerivedValue(() => strokePath(unlanded(stroke)));
	return <BrushStroke path={path} brush={brush} full={full} />;
}

export const drawStrokeKind: StrokeKind<DrawTool> = {
	reaches: (_tool, layer, selectedId) => layer.id === selectedId,
	startsLayer: (selectedId) => selectedId === null,
	renderInLayer: ({
		layer,
		uri,
		stroke,
		tool,
		matrix,
		selectionColor,
		dimmed,
		onImageError,
	}) => (
		<LayerContent
			layer={layer}
			uri={uri}
			stroke={
				<Group transform={toInverseTransformList(layer.transform)}>
					<LivePath
						key={stroke.landedId}
						stroke={stroke}
						brush={tool.brush}
						full={tool.brush.tip === "marker"}
					/>
				</Group>
			}
			matrix={matrix}
			selectionColor={selectionColor}
			opacity={dimmed ? DIMMED_OPACITY : undefined}
			onImageError={onImageError}
		/>
	),
	renderNewLayer: (stroke, tool) => {
		const path = (
			<LivePath
				stroke={stroke}
				brush={tool.brush}
				full={tool.brush.tip === "marker"}
			/>
		);
		// A new highlighter multiplies as it's drawn. It lands as its own
		// layer, which multiplies the same way.
		return tool.brush.tip === "marker" ? (
			<Group layer={<Paint blendMode="multiply" />}>{path}</Group>
		) : (
			path
		);
	},
};
