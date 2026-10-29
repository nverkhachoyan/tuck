import { type Point, toLayerSpace } from "../../document/geometry.ts";
import type { CutStroke, ImageLayer } from "./image.ts";

// Finer than a hundredth of a pixel is invisible, and would only make saved
// projects bigger. Adding 0 turns a flipped -0 into 0.
const roundPixel = (value: number) => Math.round(value * 100) / 100 + 0;

/** Whether some of `layer` is cut away: by a mask, or by hand. */
export function isCutOut(layer: ImageLayer): boolean {
	return layer.mask !== undefined || layer.maskStrokes !== undefined;
}

/**
 * `layer` shown through `mask` (see `ImageLayer`), or whole again when it's
 * null, or `layer` itself when that's how it's shown already. Strokes that
 * refined the cut before go with it, since they were painted against the
 * old one, unless `keepStrokes`: a mask grown or shrunk from the old one
 * (by a subject added to it or taken out) keeps them.
 */
export function withMask(
	layer: ImageLayer,
	mask: string | null,
	{ keepStrokes = false } = {},
): ImageLayer {
	const strokes = keepStrokes ? layer.maskStrokes : undefined;
	if ((layer.mask ?? null) === mask && layer.maskStrokes === strokes) {
		return layer;
	}
	const { mask: _, maskStrokes: __, ...rest } = layer;
	const shown = mask === null ? rest : { ...rest, mask };
	return strokes ? { ...shown, maskStrokes: strokes } : shown;
}

/**
 * `layer` with its cut inverted, showing what it hid and hiding what it
 * showed: `mask` is the inverse of its mask (or a black one, without one),
 * and every stroke paints the other way, so the strokes stay editable. A
 * stroke paints white or black over what's under it, and the inverse of
 * that is the other color over the inverse.
 */
export function withInvertedCut(layer: ImageLayer, mask: string): ImageLayer {
	const inverted = { ...layer, mask };
	if (!layer.maskStrokes) return inverted;
	return {
		...inverted,
		maskStrokes: layer.maskStrokes.map((stroke) => ({
			...stroke,
			type: stroke.type === "pen" ? "eraser" : "pen",
		})),
	};
}

/**
 * `layer` with a stroke painted in document space added to its cut, taken
 * into the image's own pixels, however the layer has been moved, scaled,
 * turned, or flipped since. Its width and feather scale with the layer's
 * average scale: a stretched image stretches the brush too.
 */
export function addMaskStroke(
	layer: ImageLayer,
	stroke: CutStroke,
): ImageLayer {
	const { transform } = layer;
	const points: number[] = [];
	for (let i = 0; i < stroke.points.length; i += 2) {
		const local = toLayerSpace(transform, {
			x: stroke.points[i],
			y: stroke.points[i + 1],
		});
		points.push(roundPixel(layer.flipped ? -local.x : local.x));
		points.push(roundPixel(local.y));
	}
	const scale = Math.sqrt(Math.abs(transform.scaleX * transform.scaleY));
	return {
		...layer,
		maskStrokes: [
			...(layer.maskStrokes ?? []),
			{
				type: stroke.type,
				width: roundPixel(stroke.width / scale),
				...(stroke.feather === undefined
					? {}
					: { feather: roundPixel(stroke.feather / scale) }),
				points,
			},
		],
	};
}

/**
 * Where a point in document space falls on `layer`'s image, as fractions of
 * its width and height from its top left, however the layer is placed or
 * flipped, or null when it's off the image.
 */
export function imagePointAt(
	layer: ImageLayer,
	point: Point,
): { x: number; y: number } | null {
	const local = toLayerSpace(layer.transform, point);
	const x = (layer.flipped ? -local.x : local.x) / layer.width + 0.5;
	const y = local.y / layer.height + 0.5;
	return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
