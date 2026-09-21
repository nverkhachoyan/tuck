import { matchFont, type SkFont } from "@shopify/react-native-skia";
import type { TextLayer } from "@/model/document";

export type TextLayerMetrics = {
	font: SkFont;
	width: number;
	height: number;
	// Draw origin in the layer's local space (origin = text center).
	drawX: number;
	baselineY: number;
};

export function selectionPadding(layer: TextLayer): number {
	return layer.fontSize * 0.2;
}

/**
 * Measures a TextLayer in document space, ignoring its transform. Shared by
 * the renderer and hit-testing so both agree on the text's bounds.
 */
export function measureTextLayer(layer: TextLayer): TextLayerMetrics {
	const font = matchFont({
		fontFamily: "System",
		fontWeight: "bold",
		fontSize: layer.fontSize,
	});
	const width = font.measureText(layer.text || " ").width;
	return {
		font,
		width,
		height: layer.fontSize,
		drawX: -width / 2,
		baselineY: layer.fontSize * 0.35,
	};
}
