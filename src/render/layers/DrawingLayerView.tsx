import {
	BlurMask,
	Group,
	Paint,
	Path,
	Skia,
	type SkPath,
} from "@shopify/react-native-skia";
import type { ComponentProps, ReactNode } from "react";
import { mixColors } from "@/model/color";
import {
	type Brush,
	type DrawingLayer,
	layerBlend,
} from "@/model/layers/drawing";
import type { MaskStroke } from "@/model/strokes";

// A marker's ink is see-through, so what it highlights shows through it.
const MARKER_OPACITY = 0.45;
// A neon stroke's parts, as shares of its width: a blurred glow, the tube
// over it, and the tube's bright core. The glow's sigma is a share too, so
// it scales with the stroke, and the glow fades out about where the width
// ends. The core is its color most of the way to white.
const NEON_GLOW = 0.55;
const NEON_GLOW_BLUR = 0.16;
const NEON_TUBE = 0.2;
const NEON_CORE = 0.08;
const NEON_CORE_WHITE = 0.75;

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
	const multiply = layerBlend(layer) === "multiply";
	return (
		<Group layer={multiply ? <Paint blendMode="multiply" /> : true}>
			{layer.strokes.map((stroke, index) => (
				<BrushStroke
					// biome-ignore lint/suspicious/noArrayIndexKey: strokes are only added or removed at the end
					key={index}
					path={pathFor(stroke)}
					brush={stroke}
					full={multiply}
				/>
			))}
			{children}
		</Group>
	);
}

/**
 * A stroke's line as its brush paints it: a pen with its tip, or an eraser,
 * which clears. `path` can be a shared value, for a stroke still growing.
 */
export function BrushStroke({
	path,
	brush,
	full = false,
}: {
	path: ComponentProps<typeof Path>["path"];
	brush: Brush;
	// Draw a highlighter at full strength. The layer around it multiplies.
	full?: boolean;
}) {
	if (brush.type === "pen" && brush.tip === "neon") {
		const { color, width } = brush;
		return (
			<>
				<Path
					path={path}
					{...ROUND_STROKE}
					strokeWidth={width * NEON_GLOW}
					color={color}
				>
					<BlurMask blur={width * NEON_GLOW_BLUR} style="normal" />
				</Path>
				<Path
					path={path}
					{...ROUND_STROKE}
					strokeWidth={width * NEON_TUBE}
					color={color}
				/>
				<Path
					path={path}
					{...ROUND_STROKE}
					strokeWidth={width * NEON_CORE}
					color={mixColors(color, "#FFFFFF", NEON_CORE_WHITE)}
				/>
			</>
		);
	}
	return <Path path={path} {...brushPaint(brush, full)} />;
}

const ROUND_STROKE = {
	style: "stroke",
	strokeCap: "round",
	strokeJoin: "round",
} as const;

// Round ends, but a marker's are square, like a highlighter's chisel tip.
// One path per stroke, so a marker crossing itself doesn't darken.
function brushPaint(brush: Brush, full: boolean) {
	if (brush.type === "eraser") {
		return {
			...ROUND_STROKE,
			strokeWidth: brush.width,
			color: "black",
			blendMode: "clear",
		} as const;
	}
	const marker = brush.tip === "marker" || brush.tip === "ink";
	return {
		...ROUND_STROKE,
		strokeWidth: brush.width,
		strokeCap: marker ? "square" : "round",
		color: brush.color,
		// A multiplying highlighter is see-through because of the blend.
		// The marker tip, and a highlighter saved before it multiplied, stay
		// at the ink's own opacity.
		opacity: marker && !(full && brush.tip === "marker") ? MARKER_OPACITY : 1,
	} as const;
}
