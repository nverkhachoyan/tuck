import { Group, Path, Skia, type SkPath } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import type { Brush, DrawingLayer, MaskStroke } from "@/model/document";

/**
 * A smooth line through flattened x, y pairs: curves through the midpoints
 * between them, so a finger's jitter doesn't show as corners. One point is
 * a dot. A worklet, so a stroke still being drawn can be built on the UI
 * thread.
 */
export function strokePath(points: number[]): SkPath {
	"worklet";
	const builder = Skia.PathBuilder.Make();
	const count = points.length / 2;
	if (count === 0) return builder.build();
	builder.moveTo(points[0], points[1]);
	for (let i = 1; i < count - 1; i++) {
		const x = points[i * 2];
		const y = points[i * 2 + 1];
		builder.quadTo(
			x,
			y,
			(x + points[i * 2 + 2]) / 2,
			(y + points[i * 2 + 3]) / 2,
		);
	}
	builder.lineTo(points[count * 2 - 2], points[count * 2 - 1]);
	return builder.build();
}

// A stroke's path never changes, and the editor and export draw the same
// stroke objects, so each is built once.
const paths = new WeakMap<MaskStroke, SkPath>();

export function pathFor(stroke: MaskStroke): SkPath {
	let path = paths.get(stroke);
	if (!path) {
		path = strokePath(stroke.points);
		paths.set(stroke, path);
	}
	return path;
}

/**
 * Draws a drawing layer in its own space. Its strokes share a layer of
 * their own, so an eraser clears only what they drew, not what's under
 * them. `children` joins that layer too: a stroke still being drawn.
 */
export function DrawingLayerView({
	layer,
	children,
}: {
	layer: DrawingLayer;
	children?: ReactNode;
}) {
	return (
		<Group layer>
			{layer.strokes.map((stroke, index) => (
				<Path
					// biome-ignore lint/suspicious/noArrayIndexKey: strokes are only added or removed at the end
					key={index}
					path={pathFor(stroke)}
					{...brushPaint(stroke)}
				/>
			))}
			{children}
		</Group>
	);
}

/** How a brush paints: round ends, and an eraser clears. */
export function brushPaint(brush: Brush) {
	return {
		style: "stroke",
		strokeWidth: brush.width,
		strokeCap: "round",
		strokeJoin: "round",
		color: brush.type === "pen" ? brush.color : "black",
		blendMode: brush.type === "eraser" ? "clear" : "srcOver",
	} as const;
}
