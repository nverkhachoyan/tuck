import { useDerivedValue } from "react-native-reanimated";
import { Group } from "react-native-skia";
import { strokePath } from "../../layers/drawing/DrawingLayerView";
import { MaskStrokePath } from "../../layers/image/ImageLayerView";
import type { CutStroke } from "../../layers/image/image";
import { LayerContent } from "../../layers/LayerContent";
import { toInverseTransformList } from "../../layers/layerTransform";
import type { CanvasTool } from "../canvasTool";
import { type LiveStroke, type StrokeKind, unlanded } from "./strokeTypes";

type CutBrushTool = Extract<CanvasTool, { type: "cutBrush" }>;

/** A stroke on an image's cut as it's being painted, in document space. */
function LiveCutPath({
	stroke,
	brush,
}: {
	stroke: LiveStroke;
	brush: Omit<CutStroke, "points">;
}) {
	const path = useDerivedValue(() => strokePath(unlanded(stroke)));
	return <MaskStrokePath path={path} stroke={brush} />;
}

export const cutStrokeKind: StrokeKind<CutBrushTool> = {
	reaches: (tool, layer) => layer.id === tool.layerId,
	startsLayer: () => false,
	renderInLayer: ({
		layer,
		uri,
		stroke,
		tool,
		matrix,
		selectionColor,
		onImageError,
	}) =>
		layer.type === "image" ? (
			<LayerContent
				layer={layer}
				uri={uri}
				// Into the image's own pixels: out of the layer's space, then
				// unflipped, as `ImageLayerView` flips its cut with it.
				stroke={
					<Group
						transform={[
							...(layer.flipped ? [{ scaleX: -1 }] : []),
							...toInverseTransformList(layer.transform),
						]}
					>
						<LiveCutPath
							key={stroke.landedId}
							stroke={stroke}
							brush={tool.brush}
						/>
					</Group>
				}
				matrix={matrix}
				selectionColor={selectionColor}
				onImageError={onImageError}
			/>
		) : null,
};
