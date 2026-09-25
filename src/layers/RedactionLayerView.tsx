import {
	BackdropBlur,
	BlendMode,
	PaintStyle,
	Picture,
	Rect,
	rect,
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
	RedactionStrokes,
} from "@/model/document";
import { drawingBox } from "@/model/drawing";
import type { Transform } from "@/model/geometry";
import { pathFor } from "./DrawingLayerView";

// How far past its sigma a blur reads what's around it: beyond three sigmas,
// a Gaussian's weights round to nothing.
const BLUR_REACH = 3;
// Bounds for a recording whose layers take their size from the clip: past
// anything a canvas shows.
const UNBOUNDED = 1_000_000;

/** A redaction's stroke ready to draw, its path built once. */
export type MaskMark = { path: SkPath; width: number; eraser: boolean };

/**
 * Draws a redaction layer in its own space. It hides what's already drawn
 * under it: a box covers or blurs it; strokes do the same through a
 * picture, which Skia's declarative API can't express (see
 * `recordRedactionStrokes`).
 */
export function RedactionLayerView({ layer }: { layer: RedactionLayer }) {
	if (layer.shape === "strokes") {
		return <Picture picture={strokesPicture(layer)} />;
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
		<BackdropBlur
			clip={box}
			blur={layerBlur(layer.effect.radius, layer.transform.scaleX)}
		/>
	);
}

/**
 * A blur's sigma in a layer's own space, which its transform scales back
 * to `radius` document pixels. Skia maps a filter through the canvas's
 * transform, so the editor's zoom scales it just as it scales the layer.
 */
export function layerBlur(radius: number, scale: number): number {
	"worklet";
	return radius / scale;
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

function strokesPicture(layer: RedactionStrokes): SkPicture {
	let picture = pictures.get(layer);
	if (!picture) {
		const scale = layer.transform.scaleX;
		// A blur reads a little past the strokes, so bounds that stopped at
		// them would blur differently at their edges than the editor does
		// while painting, when nothing bounds it.
		const { halfWidth, halfHeight } = drawingBox(layer);
		const reach =
			layer.effect.type === "blur"
				? layerBlur(layer.effect.radius, scale) * BLUR_REACH
				: 0;
		picture = recordRedactionStrokes(
			layer.effect,
			scale,
			maskMarks(layer.strokes),
			null,
			rect(
				-halfWidth - reach,
				-halfHeight - reach,
				(halfWidth + reach) * 2,
				(halfHeight + reach) * 2,
			),
		);
		pictures.set(layer, picture);
	}
	return picture;
}

/**
 * Records a redaction's strokes over what's under them. Its effect fills a
 * layer of its own, which starts out as what's under it, blurred, when it
 * blurs, and its strokes then mask that layer: pens keep it, erasers clear
 * it. `live` is a stroke still being painted, drawn after them. It's in
 * document space, so the layer's transform is undone for it, if it has one.
 * `scale` is the layer's, and `bounds` limit the layers to what the strokes
 * reach, or null to leave them to the clip.
 *
 * A worklet, so the editor can record it again on the UI thread as a stroke
 * grows. Skia maps its blur through the canvas's transform when it plays
 * back, as `layerBlur` describes.
 */
export function recordRedactionStrokes(
	effect: RedactionEffect,
	scale: number,
	strokeMarks: MaskMark[],
	live: { mark: MaskMark; layerTransform: Transform | null } | null,
	bounds: SkRect | null,
): SkPicture {
	"worklet";
	const recorder = Skia.PictureRecorder();
	const canvas = recorder.beginRecording(
		bounds ??
			Skia.XYWHRect(-UNBOUNDED, -UNBOUNDED, UNBOUNDED * 2, UNBOUNDED * 2),
	);
	if (effect.type === "blur") {
		const sigma = layerBlur(effect.radius, scale);
		canvas.saveLayer(
			undefined,
			bounds,
			Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null),
		);
	} else {
		canvas.saveLayer(undefined, bounds);
		canvas.drawColor(Skia.Color(effect.color));
	}
	const mask = Skia.Paint();
	mask.setBlendMode(BlendMode.DstIn);
	canvas.saveLayer(mask, bounds);
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
	canvas.restore();
	canvas.restore();
	return recorder.finishRecordingAsPicture();
}
