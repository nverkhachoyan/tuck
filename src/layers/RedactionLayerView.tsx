import {
	BackdropFilter,
	BlendMode,
	ColorChannel,
	FilterMode,
	ImageFilter,
	MipmapMode,
	PaintStyle,
	Picture,
	Rect,
	rect,
	type SkCanvas,
	type SkImage,
	type SkImageFilter,
	Skia,
	type SkPath,
	type SkPicture,
	type SkRect,
	StrokeCap,
	StrokeJoin,
	TileMode,
} from "@shopify/react-native-skia";
import type {
	MaskStroke,
	RedactionEffect,
	RedactionLayer,
	RedactionMask,
	RedactionStrokes,
} from "@/model/document";
import { drawingBox } from "@/model/drawing";
import {
	type Box,
	type Point,
	type Transform,
	toLayerSpace,
} from "@/model/geometry";
import { pathFor } from "./DrawingLayerView";

// How far past its sigma a blur reads what's around it: beyond three sigmas,
// a Gaussian's weights round to nothing.
const BLUR_REACH = 3;
// A pixelation's blur, as a share of a pixel: about a pixel's average.
const PIXEL_BLUR = 1 / 3;
// Where in its pixel each of a pixelation's passes samples, as a share of
// the pixel's side (see `pixelateFilter`).
const PIXEL_SAMPLES = [1 / 2, 11 / 16];
// Bounds for a recording whose layers take their size from the clip: past
// anything a canvas shows.
const UNBOUNDED = 1_000_000;

/** A redaction's stroke ready to draw, its path built once. */
export type MaskMark = { path: SkPath; width: number; eraser: boolean };

/** An effect that changes what's under a redaction rather than covering it. */
export type FilterEffect = Exclude<RedactionEffect, { type: "solid" }>;

/**
 * Draws a redaction layer in its own space. It hides what's already drawn
 * under it: a box covers, blurs, or pixelates it; strokes and a mask do the
 * same through a picture, which Skia's declarative API can't express (see
 * `recordRedaction`). A masked one draws nothing until its decoded `mask`
 * is given.
 */
export function RedactionLayerView({
	layer,
	mask,
}: {
	layer: RedactionLayer;
	mask?: SkImage;
}) {
	if (layer.shape === "strokes") {
		return <Picture picture={strokesPicture(layer)} />;
	}
	if (layer.shape === "mask") {
		return mask ? (
			<Picture picture={maskedRedactionPicture(layer, mask)} />
		) : null;
	}
	const box = rect(
		-layer.width / 2,
		-layer.height / 2,
		layer.width,
		layer.height,
	);
	return layer.effect.type === "solid" ? (
		<Rect rect={box} color={layer.effect.color} />
	) : (
		<BackdropFilter
			clip={box}
			filter={
				<ImageFilter filter={redactionFilter(layer.effect, layer.transform)} />
			}
		/>
	);
}

/**
 * A blur's sigma in a layer's own space, which its transform scales back
 * to `radius` document pixels. Skia maps a filter through the canvas's
 * transform, so the editor's zoom scales it just as it scales the layer.
 */
function layerBlur(radius: number, scale: number): number {
	"worklet";
	return radius / scale;
}

/**
 * Moves each point in squares `width` by `height`, lined up with `origin`,
 * to sample `input` `share` of the way across and down its square. Each of
 * the two displacement maps, across and then down, is a gray ramp over a
 * square, repeated: gray stays the same on a Display P3 canvas, where a red
 * and a green ramp would bleed into each other's channels. The other
 * channel each reads is its alpha, a constant half, which moves nothing.
 * A ramp moves a point by at most `share` of a square, so `share` can't be
 * less than a half.
 */
function samplePixels(
	input: SkImageFilter,
	share: number,
	width: number,
	height: number,
	origin: Point,
): SkImageFilter {
	"worklet";
	// Displacement is `reach` times the side, times the gray less a half.
	const reach = share * 2;
	const end = 1 - 1 / reach;
	const ramp = (from: Point, to: Point) =>
		Skia.ImageFilter.MakeShader(
			Skia.Shader.MakeLinearGradient(
				from,
				to,
				[Skia.Color([1, 1, 1, 0.5]), Skia.Color([end, end, end, 0.5])],
				null,
				TileMode.Repeat,
			),
		);
	const across = Skia.ImageFilter.MakeDisplacementMap(
		ColorChannel.R,
		ColorChannel.A,
		width * reach,
		ramp({ x: origin.x, y: 0 }, { x: origin.x + width, y: 0 }),
		input,
	);
	return Skia.ImageFilter.MakeDisplacementMap(
		ColorChannel.A,
		ColorChannel.R,
		height * reach,
		ramp({ x: 0, y: origin.y }, { x: 0, y: origin.y + height }),
		across,
	);
}

/**
 * Pixelates what's under a layer placed by `transform`, in squares `size`
 * document pixels across. They line up with the document's origin, not the
 * layer's, so they hold still as the layer moves or resizes, and a box
 * that lands where it was dragged out keeps its pixels. A rotated layer
 * turns them with it.
 *
 * Skia has no pixelation, and on web no runtime or matrix image filters, so
 * it's built from filters every platform has: a blur averages each square,
 * then displacement maps sample it at the square's center (see
 * `samplePixels`). Their 8-bit ramps can miss that point by a little, so
 * where it falls on a screen pixel's edge, a square would split between
 * the pixels on either side. A second pass samples the first's squares
 * elsewhere in them, which evens the few that split, unless its point falls
 * on an edge as well.
 */
function pixelateFilter(size: number, transform: Transform): SkImageFilter {
	"worklet";
	const width = size / transform.scaleX;
	const height = size / transform.scaleY;
	const origin = toLayerSpace(transform, { x: 0, y: 0 });
	const sigma = size * PIXEL_BLUR;
	let filter = Skia.ImageFilter.MakeBlur(
		sigma / transform.scaleX,
		sigma / transform.scaleY,
		TileMode.Clamp,
		null,
	);
	for (const share of PIXEL_SAMPLES) {
		filter = samplePixels(filter, share, width, height, origin);
	}
	return filter;
}

/**
 * What a blur or pixelation does to what's under a layer placed by
 * `transform`, in the layer's own space. A worklet, so the editor can build
 * it from live values as a gesture moves the layer.
 */
export function redactionFilter(
	effect: FilterEffect,
	transform: Transform,
): SkImageFilter {
	"worklet";
	if (effect.type === "blur") {
		const sigma = layerBlur(effect.radius, transform.scaleX);
		return Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null);
	}
	return pixelateFilter(effect.size, transform);
}

/**
 * How far past a layer placed by `transform` its effect reads what's under
 * it, in the layer's own space.
 */
function filterReach(effect: RedactionEffect, transform: Transform): number {
	"worklet";
	switch (effect.type) {
		case "solid":
			return 0;
		case "blur":
			return layerBlur(effect.radius, transform.scaleX) * BLUR_REACH;
		case "pixelate":
			// Anywhere in its square, and the blur around that.
			return (
				(effect.size / Math.min(transform.scaleX, transform.scaleY)) *
				(1 + PIXEL_BLUR * BLUR_REACH)
			);
	}
}

const marks = new WeakMap<MaskStroke[], MaskMark[]>();

/** A redaction's strokes as marks, built once per set of strokes. */
export function maskMarks(strokes: MaskStroke[]): MaskMark[] {
	let result = marks.get(strokes);
	if (!result) {
		result = strokes.map((stroke) => ({
			path: pathFor(stroke),
			width: stroke.width,
			eraser: stroke.type === "eraser",
		}));
		marks.set(strokes, result);
	}
	return result;
}

// A layer's strokes and transform never change in place, so each version of
// a layer is recorded once, for the editor and export alike.
const pictures = new WeakMap<RedactionStrokes, SkPicture>();

/** A redaction's strokes, recorded for its own transform. */
export function strokesPicture(layer: RedactionStrokes): SkPicture {
	let picture = pictures.get(layer);
	if (!picture) {
		picture = recordLayerStrokes(
			layer.effect,
			maskMarks(layer.strokes),
			drawingBox(layer),
			layer.transform,
		);
		pictures.set(layer, picture);
	}
	return picture;
}

/** `box` grown by `reach` on every side. */
function withReach(box: SkRect, reach: number): SkRect {
	"worklet";
	return rect(
		box.x - reach,
		box.y - reach,
		box.width + reach * 2,
		box.height + reach * 2,
	);
}

/**
 * Records a redaction over what's under it. Its effect fills a layer of its
 * own, which starts out as what's under it, blurred or pixelated, when it
 * filters, and `drawShape` then masks that layer: what it draws keeps the
 * effect, and what it clears or leaves empty doesn't. `transform` places
 * the layer, and `bounds` limit the layers to what its shape reaches, or
 * null to leave them to the clip. A worklet, as are its callers.
 */
function recordRedaction(
	effect: RedactionEffect,
	transform: Transform,
	bounds: SkRect | null,
	drawShape: (canvas: SkCanvas) => void,
): SkPicture {
	"worklet";
	const recorder = Skia.PictureRecorder();
	const canvas = recorder.beginRecording(
		bounds ??
			Skia.XYWHRect(-UNBOUNDED, -UNBOUNDED, UNBOUNDED * 2, UNBOUNDED * 2),
	);
	if (effect.type === "solid") {
		canvas.saveLayer(undefined, bounds);
		canvas.drawColor(Skia.Color(effect.color));
	} else {
		canvas.saveLayer(undefined, bounds, redactionFilter(effect, transform));
	}
	const mask = Skia.Paint();
	mask.setBlendMode(BlendMode.DstIn);
	canvas.saveLayer(mask, bounds);
	drawShape(canvas);
	canvas.restore();
	canvas.restore();
	return recorder.finishRecordingAsPicture();
}

/**
 * Records a redaction's strokes over what's under them (see
 * `recordRedaction`): pens keep its effect, erasers clear it. `live` is a
 * stroke still being painted, drawn after them. It's in document space, so
 * the layer's transform is undone for it, if it has one. `transform` places
 * the layer (the identity for a stroke that will start one).
 *
 * A worklet, so the editor can record it again on the UI thread as a stroke
 * grows. Skia maps its filter through the canvas's transform when it plays
 * back, as `layerBlur` describes.
 */
export function recordRedactionStrokes(
	effect: RedactionEffect,
	transform: Transform,
	strokeMarks: MaskMark[],
	live: { mark: MaskMark; layerTransform: Transform | null } | null,
	bounds: SkRect | null,
): SkPicture {
	"worklet";
	return recordRedaction(effect, transform, bounds, (canvas) => {
		const pen = Skia.Paint();
		pen.setAntiAlias(true);
		pen.setStyle(PaintStyle.Stroke);
		pen.setStrokeCap(StrokeCap.Round);
		pen.setStrokeJoin(StrokeJoin.Round);
		const eraser = pen.copy();
		eraser.setBlendMode(BlendMode.Clear);
		const draw = (mark: MaskMark) => {
			const paint = mark.eraser ? eraser : pen;
			paint.setStrokeWidth(mark.width);
			canvas.drawPath(mark.path, paint);
		};
		for (const mark of strokeMarks) draw(mark);
		if (live) {
			const t = live.layerTransform;
			canvas.save();
			// `toInverseTransformList`, in the canvas's own calls.
			if (t) {
				canvas.scale(1 / t.scaleX, 1 / t.scaleY);
				canvas.rotate((-t.rotation * 180) / Math.PI, 0, 0);
				canvas.translate(-t.x, -t.y);
			}
			draw(live.mark);
			canvas.restore();
		}
	});
}

/**
 * A masked redaction (see `RedactionMask`) with its decoded `mask`,
 * recorded for a layer placed by `transform`. A worklet, so the editor can
 * record it again as a gesture moves it.
 */
export function recordMaskedRedaction(
	effect: RedactionEffect,
	mask: SkImage,
	width: number,
	height: number,
	transform: Transform,
): SkPicture {
	"worklet";
	const box = rect(-width / 2, -height / 2, width, height);
	return recordRedaction(
		effect,
		transform,
		withReach(box, filterReach(effect, transform)),
		(canvas) => {
			canvas.drawImageRectOptions(
				mask,
				rect(0, 0, mask.width(), mask.height()),
				box,
				FilterMode.Linear,
				MipmapMode.None,
			);
		},
	);
}

const maskPictures = new WeakMap<
	RedactionMask,
	{ mask: SkImage; picture: SkPicture }
>();

/** A masked redaction, recorded once per version of it and its mask. */
export function maskedRedactionPicture(
	layer: RedactionMask,
	mask: SkImage,
): SkPicture {
	const recorded = maskPictures.get(layer);
	if (recorded?.mask === mask) return recorded.picture;
	const picture = recordMaskedRedaction(
		layer.effect,
		mask,
		layer.width,
		layer.height,
		layer.transform,
	);
	maskPictures.set(layer, { mask, picture });
	return picture;
}

/**
 * A redaction's strokes, which fill `box`, recorded for a layer placed by
 * `transform`. A worklet, so the editor can record them again as a gesture
 * moves them.
 */
export function recordLayerStrokes(
	effect: RedactionEffect,
	strokeMarks: MaskMark[],
	box: Box,
	transform: Transform,
): SkPicture {
	"worklet";
	// A filter reads a little past the strokes, so bounds that stopped at
	// them would filter differently at their edges than the editor does while
	// painting, when nothing bounds it.
	const { halfWidth, halfHeight } = box;
	return recordRedactionStrokes(
		effect,
		transform,
		strokeMarks,
		null,
		withReach(
			rect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2),
			filterReach(effect, transform),
		),
	);
}
