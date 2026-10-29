import {
	type CaretText,
	caretText,
	type TextSelection,
} from "@tuck/skia-text-input";
import {
	PaintStyle,
	Skia,
	type SkPaint,
	type SkParagraph,
	type SkPath,
	TextAlign as SkTextAlign,
	StrokeJoin,
} from "react-native-skia";
import type { Box, Point, Rect } from "@/model/geometry";
import type { TextAlign, TextFont, TextLayer } from "@/model/layers/text";
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

type CaretLayout = CaretText & { paragraph: SkParagraph };

// Like `layouts`, for editing: built only for the layer being edited.
const caretLayouts = new WeakMap<TextLayer, CaretLayout>();

/**
 * The text laid out as `caretText` has it, at the width the layer's own text
 * took, so its lines fall where the drawn text's do, empty ones included.
 */
function caretLayout(layer: TextLayer): CaretLayout {
	const cached = caretLayouts.get(layer);
	if (cached) return cached;
	const mapping = caretText(layer.text);
	const paragraph = buildParagraph(layer, undefined, mapping.caretText);
	paragraph.layout(layoutTextLayer(layer).width);
	const layout = { ...mapping, paragraph };
	caretLayouts.set(layer, layout);
	return layout;
}

// From the paragraph's top left, where Skia measures, to the layer's space.
function toLayerRect(layer: TextLayer, rect: Rect): Rect {
	const { width, height } = layoutTextLayer(layer);
	return {
		x: rect.x - width / 2,
		y: rect.y - height / 2,
		width: rect.width,
		height: rect.height,
	};
}

/**
 * Where a caret before index `index` of the layer's text stands, in the
 * layer's space: a zero-width rect as tall as the line's text.
 */
export function textCaretRect(layer: TextLayer, index: number): Rect {
	// Empty text is a line with no width, which Skia has nothing to measure in.
	if (layer.text === "") {
		const { height } = layoutTextLayer(layer);
		return { x: 0, y: -height / 2, width: 0, height };
	}
	const { paragraph, caretText: text, toCaret } = caretLayout(layer);
	const j = toCaret[Math.max(0, Math.min(index, layer.text.length))];
	// Before the character it's at, unless that ends the line: then after the
	// one before, which is never a line break (see `caretText`).
	const before = j < text.length && text[j] !== "\n";
	const rects = before
		? paragraph.getRectsForRange(j, j + 1)
		: paragraph.getRectsForRange(j - 1, j);
	const rect = before ? rects[0] : rects[rects.length - 1];
	if (!rect) {
		return toLayerRect(layer, { x: 0, y: 0, width: 0, height: layer.fontSize });
	}
	return toLayerRect(layer, {
		x: before ? rect.x : rect.x + rect.width,
		y: rect.y,
		width: 0,
		height: rect.height,
	});
}

/** The boxes a selection of the layer's text covers, in the layer's space. */
export function textSelectionRects(
	layer: TextLayer,
	{ start, end }: TextSelection,
): Rect[] {
	const { paragraph, toCaret } = caretLayout(layer);
	const clamp = (index: number) =>
		toCaret[Math.max(0, Math.min(index, layer.text.length))];
	return paragraph.getRectsForRange(clamp(start), clamp(end)).map((rect) =>
		toLayerRect(layer, {
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
		}),
	);
}

/** The index of the layer's text nearest a point in the layer's space. */
export function textIndexAt(layer: TextLayer, point: Point): number {
	const { paragraph, caretText: text, fromCaret } = caretLayout(layer);
	const { width, height } = layoutTextLayer(layer);
	const j = paragraph.getGlyphPositionAtCoordinate(
		point.x + width / 2,
		point.y + height / 2,
	);
	return fromCaret[Math.max(0, Math.min(j, text.length))];
}

// The outline's stroke, as a share of the font size. The fill covers its
// inner half, so a tenth of the size shows: enough to read on a busy photo,
// short of merging Anton's close-set letters. Playfair's hairlines and
// serifs clot at that, so Serif's is lighter.
const OUTLINE_WIDTH: Record<TextFont, number> = {
	classic: 0.2,
	modern: 0.2,
	serif: 0.14,
	marker: 0.2,
	typewriter: 0.2,
};

function outlinePaint(layer: TextLayer, color: string): SkPaint {
	const paint = Skia.Paint();
	paint.setAntiAlias(true);
	paint.setStyle(PaintStyle.Stroke);
	paint.setStrokeWidth(layer.fontSize * OUTLINE_WIDTH[layer.font]);
	paint.setStrokeJoin(StrokeJoin.Round);
	paint.setColor(Skia.Color(color));
	return paint;
}

function buildParagraph(
	layer: TextLayer,
	foreground?: SkPaint,
	text = layer.text,
): SkParagraph {
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
			.addText(text || " ")
			.build()
	);
}
