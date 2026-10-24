import { isFields, isPositive } from "../values.ts";
import { createLayerId, identityTransform, type LayerBase } from "./base.ts";

// Outlines the draw tool drags out. Named for how they look; `ShapeLayerView`
// draws each.
export const shapeKinds = ["rectangle", "ellipse", "line", "arrow"] as const;
export type ShapeKind = (typeof shapeKinds)[number];
export type LineShapeKind = "line" | "arrow";

type ShapeBase = LayerBase & {
	type: "shape";
	color: string;
	// The outline's or the line's thickness, in the layer's own units.
	strokeWidth: number;
};

/**
 * A rectangle or an ellipse outlined inside a box `width` by `height`,
 * centered on its origin, so its outer edge is where it was dragged to.
 */
export type BoxShape = ShapeBase & {
	shape: Exclude<ShapeKind, LineShapeKind>;
	width: number;
	height: number;
};

/**
 * A line `length` long, centered on its origin along its x axis, which its
 * transform turns. An arrow points to its end along +x.
 */
export type LineShape = ShapeBase & { shape: LineShapeKind; length: number };

export type ShapeLayer = BoxShape | LineShape;

export type ShapeStyle = Pick<ShapeLayer, "color" | "strokeWidth">;

/**
 * What restyling an existing shape can change. Its kind only changes to one
 * with the same geometry: a rectangle to an ellipse, or a line to an arrow.
 */
export type ShapeEdit = Partial<
	Pick<ShapeLayer, "shape" | "color" | "strokeWidth">
>;

/**
 * Where a new shape goes, in document space: its center, its angle, and its
 * box's size. A line's length is its width, and its height means nothing.
 */
export type ShapePlacement = {
	x: number;
	y: number;
	rotation: number;
	width: number;
	height: number;
};

export function isLineShape(shape: ShapeKind): shape is LineShapeKind {
	"worklet";
	return shape === "line" || shape === "arrow";
}

export function isLine(layer: ShapeLayer): layer is LineShape {
	"worklet";
	return isLineShape(layer.shape);
}

export function createShapeLayer(
	shape: ShapeKind,
	placement: ShapePlacement,
	style: ShapeStyle,
): ShapeLayer {
	const { x, y, rotation, width, height } = placement;
	const base = {
		type: "shape",
		id: createLayerId("shape"),
		...style,
		transform: { ...identityTransform, x, y, rotation },
		hidden: false,
		locked: false,
	} as const;
	return isLineShape(shape)
		? { ...base, shape, length: width }
		: { ...base, shape, width, height };
}

/**
 * `layer` restyled by `edit`, or `layer` itself when nothing would change.
 * A kind with other geometry than the layer's is ignored (see `ShapeEdit`).
 */
export function restyleShape(layer: ShapeLayer, edit: ShapeEdit): ShapeLayer {
	const { shape = layer.shape, color = layer.color } = edit;
	const strokeWidth = edit.strokeWidth ?? layer.strokeWidth;
	const kind = isLineShape(shape) === isLine(layer) ? shape : layer.shape;
	if (
		kind === layer.shape &&
		color === layer.color &&
		strokeWidth === layer.strokeWidth
	) {
		return layer;
	}
	return { ...layer, shape: kind, color, strokeWidth } as ShapeLayer;
}

export function isShapeLayer(value: unknown): boolean {
	if (!isFields(value) || value.type !== "shape") return false;
	const shape = shapeKinds.find((kind) => kind === value.shape);
	return (
		shape !== undefined &&
		typeof value.color === "string" &&
		isPositive(value.strokeWidth) &&
		(isLineShape(shape)
			? isPositive(value.length)
			: isPositive(value.width) && isPositive(value.height))
	);
}
