import {
	PaintStyle,
	Skia,
	type SkPaint,
	type SkParagraph,
	type SkPath,
	TextAlign as SkTextAlign,
	StrokeJoin,
} from "@shopify/react-native-skia";
import type { TextAlign, TextLayer } from "@/model/document";
import type { Box } from "@/model/geometry";
import { getFontProvider, TEXT_FONTS } from "./fonts";

export type TextLayerLayout = {
	// Drawn first, behind the text: a box around each line; null when disabled.
	background: SkPath | null;
	// Drawn next, so the outline sits behind the fill; null when disabled.
	outline: SkParagraph | null;
	fill: SkParagraph;
	// The laid-out text block in the layer's local space, centered on the origin.
	width: number;
	height: number;
};

// In font sizes: how far a background box reaches past each line's text,
// how round its corners are, and the gap from what's drawn to the selection.
const BOX_PADDING = { x: 0.3, y: 0.08 };
const BOX_RADIUS = 0.2;
const SELECTION_GAP = 0.2;

const skTextAlign: Record<TextAlign, SkTextAlign> = {
	left: SkTextAlign.Left,
	center: SkTextAlign.Center,
	right: SkTextAlign.Right,
};

// Layers are immutable, so a layer object always lays out the same way. The
// renderer and hit-testing ask for the same layer's layout on every frame and
// tap; the WeakMap lets replaced layers (and their paragraphs) be collected.
const layouts = new WeakMap<TextLayer, TextLayerLayout>();

/**
 * Wraps, aligns, and measures a TextLayer in document space, ignoring its
 * transform. Shared by the renderer and hit-testing so both agree on the
 * text's bounds.
 */
export function layoutTextLayer(layer: TextLayer): TextLayerLayout {
	const cached = layouts.get(layer);
	if (cached) return cached;

	const fill = buildParagraph(layer);
	const outline =
		layer.outlineColor === null
			? null
			: buildParagraph(layer, outlinePaint(layer, layer.outlineColor));

	// Wrap at maxWidth, then shrink the box to the longest line so the block's
	// center is the text's center (alignment then applies between lines).
	// `ceil` keeps the re-layout from wrapping a line that exactly fit.
	fill.layout(layer.maxWidth);
	const width = Math.min(Math.ceil(fill.getLongestLine()), layer.maxWidth);
	fill.layout(width);
	outline?.layout(width);
	const height = fill.getHeight();
	const background =
		layer.backgroundColor === null
			? null
			: lineBoxes(layer, fill, width, height);

	const layout = { background, outline, fill, width, height };
	layouts.set(layer, layout);
	return layout;
}

/** A text layer's laid-out text, and box if any, plus padding; see `layerBounds`. */
export function textLayerBounds(layer: TextLayer, minPadding = 0): Box {
	const { width, height } = layoutTextLayer(layer);
	const box = layer.backgroundColor === null ? { x: 0, y: 0 } : BOX_PADDING;
	const padX = Math.max((box.x + SELECTION_GAP) * layer.fontSize, minPadding);
	const padY = Math.max((box.y + SELECTION_GAP) * layer.fontSize, minPadding);
	return { halfWidth: width / 2 + padX, halfHeight: height / 2 + padY };
}

/**
 * One rounded box per line, hugging that line's text, as a single path so
 * the overlap between neighboring lines' boxes fills once. Blank lines get
 * no box. Centered on the origin, like the text.
 */
function lineBoxes(
	layer: TextLayer,
	paragraph: SkParagraph,
	width: number,
	height: number,
): SkPath {
	const padX = BOX_PADDING.x * layer.fontSize;
	const padY = BOX_PADDING.y * layer.fontSize;
	const radius = BOX_RADIUS * layer.fontSize;
	const builder = Skia.PathBuilder.Make();
	for (const line of paragraph.getLineMetrics()) {
		if (line.width < 1) continue;
		const rect = Skia.XYWHRect(
			line.left - padX - width / 2,
			line.baseline - line.ascent - padY - height / 2,
			line.width + padX * 2,
			line.ascent + line.descent + padY * 2,
		);
		builder.addRRect(Skia.RRectXY(rect, radius, radius));
	}
	return builder.build();
}

function outlinePaint(layer: TextLayer, color: string): SkPaint {
	const paint = Skia.Paint();
	paint.setAntiAlias(true);
	paint.setStyle(PaintStyle.Stroke);
	paint.setStrokeWidth(layer.fontSize * 0.12);
	paint.setStrokeJoin(StrokeJoin.Round);
	paint.setColor(Skia.Color(color));
	return paint;
}

function buildParagraph(layer: TextLayer, foreground?: SkPaint): SkParagraph {
	return (
		Skia.ParagraphBuilder.Make(
			{ textAlign: skTextAlign[layer.align] },
			getFontProvider(),
		)
			.pushStyle(
				{
					color: Skia.Color(layer.color),
					// Each font is registered in the one weight it's drawn in;
					// asking for bold would only get a synthesized, smeared copy.
					fontFamilies: [TEXT_FONTS[layer.font].family],
					fontSize: layer.fontSize,
				},
				foreground,
			)
			// An empty layer still needs a line's height to stay selectable.
			.addText(layer.text || " ")
			.build()
	);
}
