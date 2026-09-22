import {
	PaintStyle,
	Skia,
	type SkPaint,
	type SkParagraph,
	TextAlign as SkTextAlign,
	StrokeJoin,
} from "@shopify/react-native-skia";
import type { TextAlign, TextLayer } from "@/model/document";
import type { Box } from "@/model/geometry";
import { getFontProvider, TEXT_FONT_FAMILY } from "./fonts";

export type TextLayerLayout = {
	// Drawn first, so the outline sits behind the fill; null when disabled.
	outline: SkParagraph | null;
	fill: SkParagraph;
	// The laid-out text block in the layer's local space, centered on the origin.
	width: number;
	height: number;
};

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

	const layout = { outline, fill, width, height: fill.getHeight() };
	layouts.set(layer, layout);
	return layout;
}

/**
 * The selection box around a text layer: its laid-out text plus padding, in
 * local units. The outline, the handles, and hit-testing all use it, so they
 * agree on where the layer is. `minPadding` widens the padding, never
 * narrows it (hit-testing uses it to keep small text tappable).
 */
export function selectionBox(layer: TextLayer, minPadding = 0): Box {
	const { width, height } = layoutTextLayer(layer);
	const pad = Math.max(layer.fontSize * 0.2, minPadding);
	return { halfWidth: width / 2 + pad, halfHeight: height / 2 + pad };
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
					// Anton has a single, already-heavy weight; asking for bold
					// would only get a synthesized, smeared version of it.
					fontFamilies: [TEXT_FONT_FAMILY],
					fontSize: layer.fontSize,
				},
				foreground,
			)
			// An empty layer still needs a line's height to stay selectable.
			.addText(layer.text || " ")
			.build()
	);
}
