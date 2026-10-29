import { FillType, Path, Skia, type SkPath } from "react-native-skia";
import {
	isLineShape,
	type ShapeKind,
	type ShapeLayer,
} from "@/model/layers/shape";
import { arrowHead, outlineThickness, shapeBox } from "@/model/shapes";

// Captured by the worklet below as a plain number.
const EVEN_ODD = FillType.EvenOdd;

/**
 * A shape as one path to fill, in its own space, in a box `halfWidth` by
 * `halfHeight` either way from its origin. A rectangle or an ellipse is a
 * ring whose outer edge is the box's, so it covers exactly where it was
 * dragged out. A line is a capsule `halfWidth` either way along x, and an
 * arrow adds its head there; `halfHeight` means nothing to either. A
 * worklet, so a shape being dragged out or resized can be built on the UI
 * thread.
 */
export function shapePath(
	shape: ShapeKind,
	halfWidth: number,
	halfHeight: number,
	strokeWidth: number,
): SkPath {
	"worklet";
	const builder = Skia.PathBuilder.Make();
	if (isLineShape(shape)) {
		const reach = strokeWidth / 2;
		let end = halfWidth;
		if (shape === "arrow") {
			const head = arrowHead(strokeWidth, halfWidth * 2);
			const base = halfWidth - head.length;
			// Wound the same way as the line, so where they overlap stays filled.
			builder
				.moveTo(halfWidth, 0)
				.lineTo(base, head.halfWidth)
				.lineTo(base, -head.halfWidth)
				.close();
			// Into the head, so the line's round end doesn't show at its base.
			end = base + head.length / 2;
		}
		const length = Math.max(end + halfWidth, strokeWidth);
		builder.addRRect(
			Skia.RRectXY(
				Skia.XYWHRect(-halfWidth, -reach, length, reach * 2),
				reach,
				reach,
			),
		);
		return builder.build();
	}
	const inset = outlineThickness({ halfWidth, halfHeight }, strokeWidth);
	const outer = Skia.XYWHRect(
		-halfWidth,
		-halfHeight,
		halfWidth * 2,
		halfHeight * 2,
	);
	const inner = Skia.XYWHRect(
		-halfWidth + inset,
		-halfHeight + inset,
		(halfWidth - inset) * 2,
		(halfHeight - inset) * 2,
	);
	builder.setFillType(EVEN_ODD);
	if (shape === "rectangle") builder.addRect(outer).addRect(inner);
	else builder.addOval(outer).addOval(inner);
	return builder.build();
}

// A layer's path never changes in place, and the editor's crop preview and
// export draw the same layer objects.
const paths = new WeakMap<ShapeLayer, SkPath>();

/** Draws a shape layer in its own space. */
export function ShapeLayerView({ layer }: { layer: ShapeLayer }) {
	let path = paths.get(layer);
	if (!path) {
		const { halfWidth, halfHeight } = shapeBox(layer);
		path = shapePath(layer.shape, halfWidth, halfHeight, layer.strokeWidth);
		paths.set(layer, path);
	}
	return <Path path={path} color={layer.color} />;
}
