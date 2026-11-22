import {
	type Point,
	type Rect,
	type Size,
	toLayerSpace,
} from "../../document/geometry.ts";
import { isFields } from "../../document/values.ts";
import type { ColorMatrix } from "./adjustments.ts";
import type { CutStroke, ImageLayer } from "./image.ts";

// Finer than a hundredth of a pixel is invisible, and would only make saved
// projects bigger. Adding 0 turns a flipped -0 into 0.
const roundPixel = (value: number) => Math.round(value * 100) / 100 + 0;

/**
 * Non-destructive refinements to a cut's mask edge, all relative to the
 * image's shorter side so a value looks the same at any resolution:
 * - `smooth`: 0 to 1, blurs out jagged bumps and tightens around 0.5 to clear faint haze.
 * - `shift`: -1 to 1, erodes inward (< 0, eats halos/fringes) or dilates outward (> 0).
 * - `feather`: 0 to 1, softens the final mask transition.
 */
export type MaskEdge = {
	smooth: number;
	shift: number;
	feather: number;
};

export type MaskEdgeKey = keyof MaskEdge;

export const maskEdgeKeys = [
	"smooth",
	"shift",
	"feather",
] as const satisfies readonly MaskEdgeKey[];

export const neutralMaskEdge: MaskEdge = {
	smooth: 0,
	shift: 0,
	feather: 0,
};

// Maximum filter radii as shares of the image's shorter side.
const MAX_SMOOTH_SHARE = 0.015;
const MAX_SHIFT_SHARE = 0.02;
const MAX_FEATHER_SHARE = 0.025;
// Contrast ramp gain added per unit of smooth: keeps edge transitions around
// 2–3px on a 1000px image while clearing faint halo haze (< 0.4).
const SMOOTH_GAIN = 12;
const RAMP_PIVOT = 0.5;

export function isMaskEdge(value: unknown): value is MaskEdge {
	if (!isFields(value)) return false;
	const { smooth, shift, feather } = value;
	return (
		typeof smooth === "number" &&
		Number.isFinite(smooth) &&
		smooth >= 0 &&
		smooth <= 1 &&
		typeof shift === "number" &&
		Number.isFinite(shift) &&
		shift >= -1 &&
		shift <= 1 &&
		typeof feather === "number" &&
		Number.isFinite(feather) &&
		feather >= 0 &&
		feather <= 1
	);
}

export function isNeutralMaskEdge(edge: MaskEdge): boolean {
	return edge.smooth === 0 && edge.shift === 0 && edge.feather === 0;
}

export function maskEdgeEqual(left: MaskEdge, right: MaskEdge): boolean {
	return (
		left.smooth === right.smooth &&
		left.shift === right.shift &&
		left.feather === right.feather
	);
}

const clampRange = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0)) + 0;

export function clampMaskEdge(edge: MaskEdge): MaskEdge {
	return {
		smooth: clampRange(edge.smooth, 0, 1),
		shift: clampRange(edge.shift, -1, 1),
		feather: clampRange(edge.feather, 0, 1),
	};
}

/**
 * Filter parameters for `edge` on an image of `size`, applied in order
 * Shift → Smooth → Feather (so Smooth also rounds any boxiness from
 * morphology, and every stage commutes with mask inversion). Null when
 * `edge` changes nothing.
 */
export type MaskEdgeFilterSpec = {
	shift: { operator: "dilate" | "erode"; radius: number } | null;
	smooth: { sigma: number; matrix: ColorMatrix } | null;
	feather: { sigma: number } | null;
};

export function maskEdgeFilter(
	edge: MaskEdge | undefined,
	size: Size,
): MaskEdgeFilterSpec | null {
	if (!edge) return null;
	const clamped = clampMaskEdge(edge);
	if (isNeutralMaskEdge(clamped)) return null;
	const shortSide = Math.min(size.width, size.height);
	if (shortSide <= 0) return null;
	const shift =
		clamped.shift === 0
			? null
			: {
					operator: (clamped.shift > 0 ? "dilate" : "erode") as
						| "dilate"
						| "erode",
					radius: Math.abs(clamped.shift) * MAX_SHIFT_SHARE * shortSide,
				};
	const gain = 1 + SMOOTH_GAIN * clamped.smooth;
	const offset = RAMP_PIVOT * (1 - gain);
	// biome-ignore format: a matrix reads best in rows
	const ramp: ColorMatrix = [
		gain, 0, 0, 0, offset,
		0, gain, 0, 0, offset,
		0, 0, gain, 0, offset,
		0, 0, 0, 1, 0,
	];
	const smooth =
		clamped.smooth === 0
			? null
			: {
					sigma: clamped.smooth * MAX_SMOOTH_SHARE * shortSide,
					matrix: ramp,
				};
	const feather =
		clamped.feather === 0
			? null
			: { sigma: clamped.feather * MAX_FEATHER_SHARE * shortSide };
	return { shift, smooth, feather };
}

// How many sigmas past the edge a Gaussian blur still reads meaningful weight.
const FILTER_BLUR_REACH = 3;
// Inset on an uncut opaque photo when feathered, so opacity fades near zero
// (~1.4% at 2.2σ) right at the outer border instead of cutting off at 50%.
const OPAQUE_FEATHER_INSET = 2.2;

/**
 * Padding around an uncut opaque image's box needed so `spec`'s filters read
 * opaque black outside the border rather than clamping to the image's edges.
 */
export function maskEdgePad(spec: MaskEdgeFilterSpec): number {
	return Math.ceil(
		(spec.shift?.radius ?? 0) +
			FILTER_BLUR_REACH *
				((spec.smooth?.sigma ?? 0) + (spec.feather?.sigma ?? 0)) +
			4,
	);
}

/**
 * How far an uncut opaque image's white mask rectangle is inset when
 * feathered so the border fades cleanly to transparent before the box ends.
 */
export function maskEdgeBorderInset(
	spec: MaskEdgeFilterSpec,
	size: Size,
): number {
	if (!spec.feather) return 0;
	return Math.min(
		OPAQUE_FEATHER_INSET * spec.feather.sigma,
		Math.min(size.width, size.height) / 4,
	);
}

/**
 * Whether `layer`'s `maskEdge` introduces transparency on an otherwise opaque
 * image (rounded corners from Smooth, inset border from negative Shift, or
 * soft fade from Feather).
 */
export function hasEdgeTransparency(layer: ImageLayer): boolean {
	const edge = layer.maskEdge;
	return (
		edge !== undefined &&
		(edge.smooth > 0 || edge.shift < 0 || edge.feather > 0)
	);
}

/**
 * `layer` with `maskEdge`, left out when neutral, or `layer` itself when
 * unchanged.
 */
export function withMaskEdge(layer: ImageLayer, edge: MaskEdge): ImageLayer {
	const clamped = clampMaskEdge(edge);
	const current = layer.maskEdge;
	if (isNeutralMaskEdge(clamped)) {
		if (!current) return layer;
		const { maskEdge: _, ...rest } = layer;
		return rest;
	}
	return current && maskEdgeEqual(current, clamped)
		? layer
		: { ...layer, maskEdge: clamped };
}

/**
 * Whether `layer` can draw with the mask it was given: a cut-out never draws
 * without its mask, which would show what it cut away, unless its cut shows
 * as a selection, which hides nothing.
 */
export function canDrawCut(
	layer: ImageLayer,
	hasMask: boolean,
	asSelection: boolean,
): boolean {
	return layer.mask === undefined || hasMask || asSelection;
}

/** Whether some of `layer` is cut away: by a mask, or by hand. */
export function isCutOut(layer: ImageLayer): boolean {
	return layer.mask !== undefined || layer.maskStrokes !== undefined;
}

/**
 * Whether Cut's selection on `layer` selects nothing: the image isn't cut,
 * or its mask is `emptyMask`, the one that selects nothing, with nothing
 * painted back.
 */
export function selectsNothing(
	layer: ImageLayer,
	emptyMask: string | null,
): boolean {
	if (!isCutOut(layer)) return true;
	return (
		emptyMask !== null &&
		layer.mask === emptyMask &&
		!layer.maskStrokes?.some((stroke) => stroke.type === "pen")
	);
}

/**
 * What Cut's Remove does to an image that was `before` when Cut opened,
 * given its `selection`: the selection is taken out of the cut it had
 * (`from`), or out of the whole image (`from` null) when it had none, which
 * leaves the selection inverted. Null when nothing is selected, since
 * there's nothing to remove.
 */
export function removalOf(
	before: ImageLayer,
	selection: ImageLayer,
	emptyMask: string | null,
): { from: ImageLayer | null; selection: ImageLayer } | null {
	if (selectsNothing(selection, emptyMask)) return null;
	return { from: isCutOut(before) ? before : null, selection };
}

/**
 * `layer` shown through `mask` (see `ImageLayer`), or whole again when it's
 * null, or `layer` itself when that's how it's shown already. Strokes and
 * edge refinements from the old cut go with it unless `keepStrokes` is true
 * (a mask grown or shrunk from the old one keeps them, unless `mask` is null).
 */
export function withMask(
	layer: ImageLayer,
	mask: string | null,
	{ keepStrokes = false } = {},
): ImageLayer {
	const keep = keepStrokes && mask !== null;
	const strokes = keep ? layer.maskStrokes : undefined;
	const edge = keep ? layer.maskEdge : undefined;
	if (
		(layer.mask ?? null) === mask &&
		layer.maskStrokes === strokes &&
		layer.maskEdge === edge
	) {
		return layer;
	}
	const { mask: _, maskStrokes: __, maskEdge: ___, ...rest } = layer;
	const shown = mask === null ? rest : { ...rest, mask };
	const withStrokes = strokes ? { ...shown, maskStrokes: strokes } : shown;
	return edge ? { ...withStrokes, maskEdge: edge } : withStrokes;
}

/**
 * `layer` with its cut inverted, showing what it hid and hiding what it
 * showed: `mask` is the inverse of its mask (or a black one, without one),
 * every stroke paints the other way, and any edge shift negates (dilate
 * becomes erode), so both strokes and edge refinements stay editable and
 * inverting twice returns the original.
 */
export function withInvertedCut(layer: ImageLayer, mask: string): ImageLayer {
	const edge = layer.maskEdge
		? { ...layer.maskEdge, shift: -layer.maskEdge.shift + 0 }
		: undefined;
	const inverted: ImageLayer = {
		...layer,
		mask,
		...(edge ? { maskEdge: edge } : {}),
	};
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
	const { x, y } = imageFraction(layer, point);
	return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

/**
 * Where a box in document space falls on `layer`'s image, as fractions of
 * its width and height from its top left: the bounds of the box's corners
 * on the image, however the layer is placed or flipped, clipped to the
 * image, or null when none of it is on the image.
 */
export function imageRectAt(layer: ImageLayer, rect: Rect): Rect | null {
	const corners = [
		{ x: rect.x, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y },
		{ x: rect.x, y: rect.y + rect.height },
		{ x: rect.x + rect.width, y: rect.y + rect.height },
	].map((corner) => imageFraction(layer, corner));
	const xs = corners.map((corner) => corner.x);
	const ys = corners.map((corner) => corner.y);
	const left = Math.max(0, Math.min(...xs));
	const top = Math.max(0, Math.min(...ys));
	const right = Math.min(1, Math.max(...xs));
	const bottom = Math.min(1, Math.max(...ys));
	if (right <= left || bottom <= top) return null;
	return { x: left, y: top, width: right - left, height: bottom - top };
}

function imageFraction(layer: ImageLayer, point: Point): Point {
	const local = toLayerSpace(layer.transform, point);
	return {
		x: (layer.flipped ? -local.x : local.x) / layer.width + 0.5,
		y: local.y / layer.height + 0.5,
	};
}
