import {
	Group,
	Rect as SkiaRect,
	Text as SkiaText,
} from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import type { TextLayer } from "@/model/document";
import type { Transform } from "@/model/geometry";
import { colors } from "@/theme";
import { measureTextLayer, selectionPadding } from "./textLayerMetrics";

type Transforms = ReturnType<typeof toTransformList>;

/**
 * Skia's transform list for a layer's document-space transform. Marked as a
 * worklet because `LiveTextLayer` (in EditorScene) calls it from a `useDerivedValue`, which
 * re-runs on the UI thread and can't call plain JS functions.
 */
export function toTransformList(t: Transform) {
	"worklet";
	return [
		{ translateX: t.x },
		{ translateY: t.y },
		{ rotate: t.rotation },
		{ scaleX: t.scaleX },
		{ scaleY: t.scaleY },
	];
}

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
	transform: Transforms | SharedValue<Transforms>;
	selectionStroke?: number | SharedValue<number>;
}) {
	const { font, width, height, drawX, baselineY } = measureTextLayer(layer);
	const pad = selectionPadding(layer);
	const strokeWidth = layer.fontSize * 0.12;

	return (
		<Group transform={transform}>
			{selectionStroke !== undefined && (
				<SkiaRect
					x={-width / 2 - pad}
					y={-height / 2 - pad}
					width={width + pad * 2}
					height={height + pad * 2}
					color={colors.accent}
					style="stroke"
					strokeWidth={selectionStroke}
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
			<SkiaText
				x={drawX}
				y={baselineY}
				text={layer.text}
				font={font}
				color={layer.color}
			/>
		</Group>
	);
}
