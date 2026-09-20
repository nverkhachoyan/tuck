import { Rect as SkiaRect, Text as SkiaText } from "@shopify/react-native-skia";
import type { TextLayer } from "../../lib/editor-document";
import { colors } from "../theme";
import { measureTextLayer } from "./textLayerMetrics";

export function TextLayerNode({
	layer,
	scale,
	offsetX,
	offsetY,
	selected,
}: {
	layer: TextLayer;
	scale: number;
	offsetX: number;
	offsetY: number;
	selected: boolean;
}) {
	const { font, fontSize, drawX, baselineY, boxX, boxY, boxWidth, boxHeight } =
		measureTextLayer(layer, scale, offsetX, offsetY);
	if (!font) return null;

	const strokeWidth = Math.max(2, fontSize * 0.12);

	return (
		<>
			{selected && (
				<SkiaRect
					x={boxX}
					y={boxY}
					width={boxWidth}
					height={boxHeight}
					color={colors.accent}
					style="stroke"
					strokeWidth={1.5}
				/>
			)}
			<SkiaText
				x={drawX}
				y={baselineY}
				text={layer.text}
				font={font}
				color={layer.outlineColor}
				style="stroke"
				strokeWidth={strokeWidth}
				strokeJoin="round"
			/>
			<SkiaText x={drawX} y={baselineY} text={layer.text} font={font} color={layer.color} />
		</>
	);
}
