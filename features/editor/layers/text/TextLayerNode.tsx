import {
	Group,
	Rect as SkiaRect,
	Text as SkiaText,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { colors } from "../../../../theme";
import type { LiveTransform } from "../../canvas/gestures/useLayerTransformGesture";
import type { TextLayer } from "../../model/document";
import { measureTextLayer, selectionPadding } from "./textLayerMetrics";

const SELECTION_STROKE_PX = 1.5;

/**
 * Draws a text layer in document space, centered on its transform origin.
 * The screen fit is applied by a parent group, so this component (and the
 * future export renderer) never deals with screen coordinates.
 */
export function TextLayerNode({
	layer,
	viewScale,
	live,
	selected,
}: {
	layer: TextLayer;
	viewScale: number;
	live: LiveTransform;
	selected: boolean;
}) {
	const { font, width, height, drawX, baselineY } = measureTextLayer(layer);

	// While selected, the gesture-driven shared values win over the document.
	const transform = useDerivedValue(() => {
		const active = live.activeId.value === layer.id;
		const t = layer.transform;
		return [
			{ translateX: active ? live.x.value : t.x },
			{ translateY: active ? live.y.value : t.y },
			{ rotate: active ? live.rotation.value : t.rotation },
			{ scaleX: active ? live.scale.value : t.scaleX },
			{ scaleY: active ? live.scale.value : t.scaleY },
		];
	}, [layer.id, layer.transform]);

	// Keep the selection outline a constant on-screen thickness at any scale.
	const selectionStroke = useDerivedValue(() => {
		const scale =
			live.activeId.value === layer.id
				? live.scale.value
				: layer.transform.scaleX;
		return SELECTION_STROKE_PX / (viewScale * scale);
	}, [layer.id, layer.transform, viewScale]);

	const pad = selectionPadding(layer);
	const strokeWidth = layer.fontSize * 0.12;

	return (
		<Group transform={transform}>
			{selected && (
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
