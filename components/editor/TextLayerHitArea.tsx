import { Pressable } from "react-native";
import type { TextLayer } from "../../lib/editor-document";
import { measureTextLayer } from "./textLayerMetrics";

/**
 * Invisible tap target sized and positioned to match TextLayerNode's
 * on-screen bounds, so tapping the rendered text selects its layer.
 */
export function TextLayerHitArea({
	layer,
	scale,
	offsetX,
	offsetY,
	onPress,
}: {
	layer: TextLayer;
	scale: number;
	offsetX: number;
	offsetY: number;
	onPress: () => void;
}) {
	const { boxX, boxY, boxWidth, boxHeight } = measureTextLayer(
		layer,
		scale,
		offsetX,
		offsetY,
	);
	return (
		<Pressable
			onPress={onPress}
			style={{
				position: "absolute",
				left: boxX,
				top: boxY,
				width: boxWidth,
				height: boxHeight,
			}}
		/>
	);
}
