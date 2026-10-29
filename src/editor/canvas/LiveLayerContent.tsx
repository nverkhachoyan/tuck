import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import {
	BackdropFilter,
	ImageFilter,
	Path,
	Picture,
	Rect,
	rect,
	type SkImage,
	type SkRect,
} from "react-native-skia";
import { transformsEqual } from "../document/geometry";
import {
	type FilterEffect,
	maskedRedactionPicture,
	maskMarks,
	RedactionLayerView,
	recordLayerStrokes,
	recordMaskedRedaction,
	redactionFilter,
	strokesPicture,
} from "../layers/redaction/RedactionLayerView";
import type {
	RedactionBox,
	RedactionLayer,
	RedactionMask,
	RedactionStrokes,
} from "../layers/redaction/redaction";
import { shapePath } from "../layers/shape/ShapeLayerView";
import type { ShapeLayer } from "../layers/shape/shape";
import { shapeBox } from "../layers/shape/shapeGeometry";
import { drawingBox } from "../layers/strokes";
import { useDecodedImage } from "../render/useDecodedImage";
import {
	type LiveTransform,
	liveBoxOf,
	liveTransformOf,
} from "./liveTransform";

/**
 * A redaction that follows the live values while it's selected, as
 * `LiveLayer` places it: a box's size as its sides are dragged, and a blur
 * or pixelation that holds in document pixels while a gesture moves or
 * scales the layer, rather than moving and growing with it until the
 * gesture commits.
 */
export function LiveRedaction({
	layer,
	live,
	onImageError,
}: {
	layer: RedactionLayer;
	live: LiveTransform;
	onImageError: (error: unknown) => void;
}) {
	if (layer.shape === "box") {
		return <LiveRedactionBox layer={layer} live={live} />;
	}
	if (layer.shape === "mask") {
		return (
			<LiveMaskedRedaction
				layer={layer}
				live={live}
				onImageError={onImageError}
			/>
		);
	}
	if (layer.effect.type !== "solid") {
		return (
			<LiveFilteredStrokes layer={layer} effect={layer.effect} live={live} />
		);
	}
	return <RedactionLayerView layer={layer} />;
}

function LiveRedactionBox({
	layer,
	live,
}: {
	layer: RedactionBox;
	live: LiveTransform;
}) {
	const { id, width, height, effect } = layer;
	const box = useDerivedValue<SkRect>(() => {
		const { halfWidth: w, halfHeight: h } = liveBoxOf(live, id, {
			halfWidth: width / 2,
			halfHeight: height / 2,
		});
		return rect(-w, -h, w * 2, h * 2);
	}, [id, width, height]);
	return effect.type === "solid" ? (
		<Rect rect={box} color={effect.color} />
	) : (
		<LiveFilteredBox layer={layer} effect={effect} box={box} live={live} />
	);
}

function LiveFilteredBox({
	layer,
	effect,
	box,
	live,
}: {
	layer: RedactionBox;
	effect: FilterEffect;
	box: DerivedValue<SkRect>;
	live: LiveTransform;
}) {
	const { id, transform } = layer;
	const filter = useDerivedValue(
		() => redactionFilter(effect, liveTransformOf(live, id, transform)),
		[id, effect, transform],
	);
	return <BackdropFilter clip={box} filter={<ImageFilter filter={filter} />} />;
}

/**
 * A shape that follows the live values while it's selected, as `LiveLayer`
 * places it: its box's size as its sides are dragged, or its length as an
 * end is.
 */
export function LiveShape({
	layer,
	live,
}: {
	layer: ShapeLayer;
	live: LiveTransform;
}) {
	const { id, shape, strokeWidth } = layer;
	const { halfWidth, halfHeight } = shapeBox(layer);
	const path = useDerivedValue(() => {
		const box = liveBoxOf(live, id, { halfWidth, halfHeight });
		return shapePath(shape, box.halfWidth, box.halfHeight, strokeWidth);
	}, [id, shape, halfWidth, halfHeight, strokeWidth]);
	return <Path path={path} color={layer.color} />;
}

/**
 * Blurred or pixelated strokes, recorded again for the live transform while
 * it's off the document's. Otherwise they're the picture export draws.
 */
function LiveFilteredStrokes({
	layer,
	effect,
	live,
}: {
	layer: RedactionStrokes;
	effect: FilterEffect;
	live: LiveTransform;
}) {
	const { id, transform } = layer;
	const committed = strokesPicture(layer);
	const marks = maskMarks(layer.strokes);
	const box = drawingBox(layer);
	const picture = useDerivedValue(() => {
		const current = liveTransformOf(live, id, transform);
		return transformsEqual(current, transform)
			? committed
			: recordLayerStrokes(effect, marks, box, current);
	}, [layer]);
	return <Picture picture={picture} />;
}

/**
 * A masked redaction, once its mask has decoded. A blurred or pixelated one
 * is recorded again for the live transform while it's off the document's,
 * like `LiveFilteredStrokes`.
 */
function LiveMaskedRedaction({
	layer,
	live,
	onImageError,
}: {
	layer: RedactionMask;
	live: LiveTransform;
	onImageError: (error: unknown) => void;
}) {
	const mask = useDecodedImage(layer.mask, onImageError);
	if (!mask) return null;
	if (layer.effect.type === "solid") {
		return <RedactionLayerView layer={layer} mask={mask} />;
	}
	return <LiveMaskedPicture layer={layer} mask={mask} live={live} />;
}

function LiveMaskedPicture({
	layer,
	mask,
	live,
}: {
	layer: RedactionMask;
	mask: SkImage;
	live: LiveTransform;
}) {
	const { id, effect, width, height, transform } = layer;
	const committed = maskedRedactionPicture(layer, mask);
	const picture = useDerivedValue(() => {
		const current = liveTransformOf(live, id, transform);
		return transformsEqual(current, transform)
			? committed
			: recordMaskedRedaction(effect, mask, width, height, current);
	}, [layer, mask]);
	return <Picture picture={picture} />;
}
