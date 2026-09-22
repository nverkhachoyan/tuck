import { Group, Paragraph, Rect as SkiaRect } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import type { TextLayer } from "@/model/document";
import { colors } from "@/theme";
import type { TransformList } from "./layerTransform";
import { layoutTextLayer, selectionBox } from "./textLayerLayout";

/**
 * Draws a text layer in document space, centered on its transform origin.
 * Purely presentational: `transform` and `selectionStroke` may be plain
 * values (export) or shared values (live editing), and passing no
 * `selectionStroke` draws no selection outline. The screen fit is applied by
 * a parent group, so this never deals with screen coordinates.
 */
export function TextLayerView({
	layer,
	transform,
	selectionStroke,
}: {
	layer: TextLayer;
	transform: TransformList | SharedValue<TransformList>;
	selectionStroke?: number | SharedValue<number>;
}) {
	const { outline, fill, width, height } = layoutTextLayer(layer);
	const box = selectionBox(layer);

	return (
		<Group transform={transform}>
			{selectionStroke !== undefined && (
				<SkiaRect
					x={-box.halfWidth}
					y={-box.halfHeight}
					width={box.halfWidth * 2}
					height={box.halfHeight * 2}
					color={colors.accent}
					style="stroke"
					strokeWidth={selectionStroke}
				/>
			)}
			{outline && (
				<Paragraph
					paragraph={outline}
					x={-width / 2}
					y={-height / 2}
					width={width}
				/>
			)}
			<Paragraph
				paragraph={fill}
				x={-width / 2}
				y={-height / 2}
				width={width}
			/>
		</Group>
	);
}
