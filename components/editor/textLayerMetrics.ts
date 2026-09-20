import { matchFont, type SkFont } from "@shopify/react-native-skia";
import type { TextLayer } from "../../lib/editor-document";

export const TEXT_HIT_PADDING = 14;

export type TextLayerMetrics = {
	font: SkFont;
	fontSize: number;
	drawX: number;
	baselineY: number;
	boxX: number;
	boxY: number;
	boxWidth: number;
	boxHeight: number;
};

/**
 * Maps a TextLayer's document-space center point and font size onto screen
 * space, and measures its rendered bounds. Shared by the visual renderer and
 * the tap-target overlay so both agree on exactly where the text sits.
 */
export function measureTextLayer(
	layer: TextLayer,
	scale: number,
	offsetX: number,
	offsetY: number,
): TextLayerMetrics {
	const fontSize = layer.fontSize * scale;
	const font = matchFont({ fontFamily: "System", fontWeight: "bold", fontSize });
	const bounds = font.measureText(layer.text || " ");
	const centerX = offsetX + layer.transform.x * scale;
	const centerY = offsetY + layer.transform.y * scale;
	const drawX = centerX - bounds.width / 2;
	const baselineY = centerY + fontSize * 0.35;

	return {
		font,
		fontSize,
		drawX,
		baselineY,
		boxX: drawX - TEXT_HIT_PADDING,
		boxY: centerY - fontSize / 2 - TEXT_HIT_PADDING,
		boxWidth: bounds.width + TEXT_HIT_PADDING * 2,
		boxHeight: fontSize + TEXT_HIT_PADDING * 2,
	};
}
