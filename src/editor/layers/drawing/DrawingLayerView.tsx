import { type ComponentProps, Fragment, type ReactNode } from "react";
import {
	BlendMode,
	BlurMask,
	BlurStyle,
	Group,
	Paint,
	PaintStyle,
	Path,
	Picture,
	type SkCanvas,
	Skia,
	type SkPath,
	type SkPicture,
	StrokeCap,
	StrokeJoin,
} from "react-native-skia";
import { mixColors } from "@/ui/color";
import type { MaskStroke } from "../strokes";
import {
	type Brush,
	type DrawingLayer,
	inkRect,
	layerBlend,
	NEON_GLOW,
	NEON_GLOW_BLUR,
	needsOwnLayer,
	type Stroke,
} from "./drawing";

// A marker's ink is see-through, so what it highlights shows through it.
const MARKER_OPACITY = 0.45;
// A neon stroke's parts, as shares of its width: a blurred glow
// (`NEON_GLOW`, with `NEON_GLOW_BLUR` its sigma, so it scales with the
// stroke and fades out about where the width ends), the tube over it, and
// the tube's bright core. The core is its color most of the way to white.
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

function drawStroke(canvas: SkCanvas, stroke: Stroke, full: boolean) {
	"worklet";
	const path = pathFor(stroke);
	if (stroke.type === "pen" && stroke.tip === "neon") {
		const { color, width } = stroke;
		const glowPaint = Skia.Paint();
		glowPaint.setAntiAlias(true);
		glowPaint.setStyle(PaintStyle.Stroke);
		glowPaint.setStrokeCap(StrokeCap.Round);
		glowPaint.setStrokeJoin(StrokeJoin.Round);
		glowPaint.setStrokeWidth(width * NEON_GLOW);
		glowPaint.setColor(Skia.Color(color));
		glowPaint.setMaskFilter(
			Skia.MaskFilter.MakeBlur(BlurStyle.Normal, width * NEON_GLOW_BLUR, true),
		);
		canvas.drawPath(path, glowPaint);

		const tubePaint = Skia.Paint();
		tubePaint.setAntiAlias(true);
		tubePaint.setStyle(PaintStyle.Stroke);
		tubePaint.setStrokeCap(StrokeCap.Round);
		tubePaint.setStrokeJoin(StrokeJoin.Round);
		tubePaint.setStrokeWidth(width * NEON_TUBE);
		tubePaint.setColor(Skia.Color(color));
		canvas.drawPath(path, tubePaint);

		const corePaint = Skia.Paint();
		corePaint.setAntiAlias(true);
		corePaint.setStyle(PaintStyle.Stroke);
		corePaint.setStrokeCap(StrokeCap.Round);
		corePaint.setStrokeJoin(StrokeJoin.Round);
		corePaint.setStrokeWidth(width * NEON_CORE);
		corePaint.setColor(
			Skia.Color(mixColors(color, "#FFFFFF", NEON_CORE_WHITE)),
		);
		canvas.drawPath(path, corePaint);
		return;
	}

	const paint = Skia.Paint();
	paint.setAntiAlias(true);
	paint.setStyle(PaintStyle.Stroke);
	paint.setStrokeJoin(StrokeJoin.Round);
	if (stroke.type === "eraser") {
		paint.setStrokeCap(StrokeCap.Round);
		paint.setStrokeWidth(stroke.width);
		paint.setColor(Skia.Color("black"));
		paint.setBlendMode(BlendMode.Clear);
	} else {
		const marker = stroke.tip === "marker" || stroke.tip === "ink";
		paint.setStrokeCap(marker ? StrokeCap.Square : StrokeCap.Round);
		paint.setStrokeWidth(stroke.width);
		paint.setColor(Skia.Color(stroke.color));
		const opacity =
			marker && !(full && stroke.tip === "marker") ? MARKER_OPACITY : 1;
		paint.setAlphaf(opacity);
	}
	canvas.drawPath(path, paint);
}

// Cached by layer id, holding the last strokes array and recorded picture.
// Keyed by id rather than WeakMap by strokes array so undo history does not
// keep pictures alive.
const drawingPictures = new Map<
	string,
	{ strokes: readonly Stroke[]; multiply: boolean; picture: SkPicture }
>();

/** Records a drawing layer's settled strokes into an SkPicture bounded by inkRect. */
export function drawingPicture(
	layer: DrawingLayer,
	multiply: boolean,
): SkPicture {
	"worklet";
	const cached = drawingPictures.get(layer.id);
	if (
		cached &&
		cached.strokes === layer.strokes &&
		cached.multiply === multiply
	) {
		return cached.picture;
	}
	const bounds = inkRect(layer);
	const rect = Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height);
	const recorder = Skia.PictureRecorder();
	const canvas = recorder.beginRecording(rect);
	for (const stroke of layer.strokes) {
		drawStroke(canvas, stroke, multiply);
	}
	const picture = recorder.finishRecordingAsPicture();
	drawingPictures.set(layer.id, {
		strokes: layer.strokes,
		multiply,
		picture,
	});
	return picture;
}

/**
 * Draws a drawing layer in its own space.
 * - Its strokes share a saved layer only when it needs one
 *   (`needsOwnLayer`: an eraser clears only what they drew, and a highlight
 *   multiplies as a whole), or while dimmed or joined by a live stroke.
 * - That layer is clipped to its ink (`inkRect`), so it costs the
 *   drawing's size, not the canvas's; `liveInside` says `children` stay
 *   within it (a live eraser), and otherwise they may reach past it.
 * - `children` joins the layer: a stroke still being drawn.
 * - `opacity` fades the whole layer as it's laid down, so a dimmed
 *   highlight still multiplies onto what's under it.
 * - `wrapStroke` wraps each pen stroke, by its index, as the canvas does to
 *   dim strokes while keeping the layer's blend and its erasers.
 */
export function DrawingLayerView({
	layer,
	opacity = 1,
	wrapStroke,
	liveInside = false,
	children,
}: {
	layer: DrawingLayer;
	opacity?: number;
	wrapStroke?: (index: number, stroke: ReactNode) => ReactNode;
	liveInside?: boolean;
	children?: ReactNode;
}) {
	const multiply = layerBlend(layer) === "multiply";
	const live =
		children !== undefined && children !== null && children !== false;

	const content = wrapStroke ? (
		layer.strokes.map((stroke, index) => {
			const drawn = (
				<BrushStroke
					// biome-ignore lint/suspicious/noArrayIndexKey: strokes are only added or removed at the end
					key={index}
					path={pathFor(stroke)}
					brush={stroke}
					full={multiply}
				/>
			);
			return stroke.type === "pen" ? (
				// biome-ignore lint/suspicious/noArrayIndexKey: as above
				<Fragment key={index}>{wrapStroke(index, drawn)}</Fragment>
			) : (
				drawn
			);
		})
	) : (
		<Picture picture={drawingPicture(layer, multiply)} />
	);

	if (!needsOwnLayer(layer) && opacity === 1 && !live) {
		return <Group>{content}</Group>;
	}
	const layered = (
		<Group
			layer={
				multiply ? (
					<Paint blendMode="multiply" opacity={opacity} />
				) : opacity < 1 ? (
					<Paint opacity={opacity} />
				) : (
					true
				)
			}
		>
			{content}
			{children}
		</Group>
	);
	// The clip is outside the layer: a Group saves its layer before its own
	// clip, which wouldn't bound it.
	return live && !liveInside ? (
		layered
	) : (
		<Group clip={inkRect(layer)}>{layered}</Group>
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
