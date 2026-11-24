import {
	type ComponentProps,
	Fragment,
	type ReactNode,
	useLayoutEffect,
} from "react";
import {
	BlendMode,
	BlurMask,
	BlurStyle,
	CornerPathEffect,
	Group,
	Paint,
	PaintStyle,
	Path,
	Picture,
	type SkCanvas,
	Skia,
	type SkPath,
	type SkPicture,
	type SkRect,
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
	type PenBrush,
	ROUNDED_END,
	type Stroke,
	strokeEnds,
	strokeOpacity,
	visibleReach,
} from "./drawing";
import { createPictureCache } from "./drawingPictures";

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

/**
 * The outline a square-ended line of `width` covers, to fill with a corner
 * effect that rounds its ends' corners (`ROUNDED_END`): Skia's strokes end
 * only butt, round, or square. Null if Skia can't stroke it. A worklet, for
 * a stroke still being drawn.
 */
export function roundedEndsOutline(path: SkPath, width: number): SkPath | null {
	"worklet";
	return Skia.Path.Stroke(path, {
		width,
		cap: StrokeCap.Square,
		join: StrokeJoin.Round,
	});
}

/**
 * The box `path`'s ink fills, reaching `reach` past its line, to bound a
 * layer saved around one stroke: unbounded, it's the whole canvas, every
 * frame. A worklet, for a stroke still being drawn.
 */
export function inkBounds(path: SkPath, reach: number): SkRect {
	"worklet";
	const box = path.computeTightBounds();
	return Skia.XYWHRect(
		box.x - reach,
		box.y - reach,
		box.width + reach * 2,
		box.height + reach * 2,
	);
}

// A settled stroke's outline, built once, as its path is.
const outlines = new WeakMap<
	SkPath,
	{ width: number; outline: SkPath | null }
>();

function outlineFor(path: SkPath, width: number): SkPath | null {
	const cached = outlines.get(path);
	if (cached?.width === width) return cached.outline;
	const outline = roundedEndsOutline(path, width);
	outlines.set(path, { width, outline });
	return outline;
}

// What a pen stroke's paint fades to: a highlighter that multiplies draws
// at full strength, since the blend shows what's under it.
function inkOpacity(brush: PenBrush, full: boolean): number {
	return full && brush.tip === "marker" ? 1 : strokeOpacity(brush);
}

function drawStroke(canvas: SkCanvas, stroke: Stroke, full: boolean) {
	const path = pathFor(stroke);
	if (stroke.type === "pen" && stroke.tip === "neon") {
		const { color, width } = stroke;
		const opacity = strokeOpacity(stroke);
		const fade = opacity < 1 ? Skia.Paint() : null;
		const glowPaint = Skia.Paint();
		const tubePaint = Skia.Paint();
		const corePaint = Skia.Paint();
		// drawPath copies the paint. CanvasKit has no finalizer, so the
		// temporaries are deleted or the web heap grows with every stroke.
		const glow = Skia.MaskFilter.MakeBlur(
			BlurStyle.Normal,
			width * NEON_GLOW_BLUR,
			true,
		);
		try {
			// Faded as a whole, so the glow doesn't show through the tube.
			if (fade) {
				fade.setAlphaf(opacity);
				canvas.saveLayer(fade, inkBounds(path, visibleReach(stroke)));
			}
			glowPaint.setAntiAlias(true);
			glowPaint.setStyle(PaintStyle.Stroke);
			glowPaint.setStrokeCap(StrokeCap.Round);
			glowPaint.setStrokeJoin(StrokeJoin.Round);
			glowPaint.setStrokeWidth(width * NEON_GLOW);
			glowPaint.setColor(Skia.Color(color));
			glowPaint.setMaskFilter(glow);
			canvas.drawPath(path, glowPaint);

			tubePaint.setAntiAlias(true);
			tubePaint.setStyle(PaintStyle.Stroke);
			tubePaint.setStrokeCap(StrokeCap.Round);
			tubePaint.setStrokeJoin(StrokeJoin.Round);
			tubePaint.setStrokeWidth(width * NEON_TUBE);
			tubePaint.setColor(Skia.Color(color));
			canvas.drawPath(path, tubePaint);

			corePaint.setAntiAlias(true);
			corePaint.setStyle(PaintStyle.Stroke);
			corePaint.setStrokeCap(StrokeCap.Round);
			corePaint.setStrokeJoin(StrokeJoin.Round);
			corePaint.setStrokeWidth(width * NEON_CORE);
			corePaint.setColor(
				Skia.Color(mixColors(color, "#FFFFFF", NEON_CORE_WHITE)),
			);
			canvas.drawPath(path, corePaint);
			if (fade) canvas.restore();
		} finally {
			fade?.dispose();
			glowPaint.dispose();
			tubePaint.dispose();
			corePaint.dispose();
			glow.dispose();
		}
		return;
	}

	const paint = Skia.Paint();
	const ends = stroke.type === "pen" ? strokeEnds(stroke) : "round";
	const outline = ends === "rounded" ? outlineFor(path, stroke.width) : null;
	const corner = outline
		? Skia.PathEffect.MakeCorner(stroke.width * ROUNDED_END)
		: null;
	try {
		paint.setAntiAlias(true);
		paint.setStyle(PaintStyle.Stroke);
		paint.setStrokeJoin(StrokeJoin.Round);
		if (stroke.type === "eraser") {
			paint.setStrokeCap(StrokeCap.Round);
			paint.setStrokeWidth(stroke.width);
			paint.setColor(Skia.Color("black"));
			paint.setBlendMode(BlendMode.Clear);
		} else {
			paint.setStrokeCap(ends === "round" ? StrokeCap.Round : StrokeCap.Square);
			paint.setStrokeWidth(stroke.width);
			paint.setColor(Skia.Color(stroke.color));
			paint.setAlphaf(inkOpacity(stroke, full));
		}
		if (outline && corner) {
			paint.setStyle(PaintStyle.Fill);
			paint.setPathEffect(corner);
			canvas.drawPath(outline, paint);
		} else {
			canvas.drawPath(path, paint);
		}
	} finally {
		paint.dispose();
		corner?.dispose();
	}
}

// Two frames, as `decodedImages` waits: the canvas replays the recording from
// before an update for a frame, and a timer can fire before that frame.
function afterSkiaDraws(free: () => void) {
	requestAnimationFrame(() => requestAnimationFrame(free));
}

const drawingPictures = createPictureCache<SkPicture>(afterSkiaDraws);

/**
 * Marks an offscreen draw as using the cache until the returned function
 * runs. Pictures that draw recorded stay alive until then, including one a
 * newer recording of the same layer has since replaced.
 */
export function retainDrawingPictures(): () => void {
	return drawingPictures.beginDraw();
}

/**
 * Records a drawing layer's settled strokes into an SkPicture bounded by
 * inkRect. Erasers clear inside a layer the picture saves itself: Skia's
 * recording drops a paintless saved layer around a single draw, which a
 * picture drawn alone would be, and its erasers would clear what's under
 * the drawing.
 */
export function drawingPicture(
	layer: DrawingLayer,
	multiply: boolean,
): SkPicture {
	return drawingPictures.pictureFor(
		layer.id,
		{ strokes: layer.strokes, multiply },
		() => {
			const bounds = inkRect(layer);
			const rect = Skia.XYWHRect(
				bounds.x,
				bounds.y,
				bounds.width,
				bounds.height,
			);
			const recorder = Skia.PictureRecorder();
			try {
				const canvas = recorder.beginRecording(rect);
				const erases = layer.strokes.some((stroke) => stroke.type === "eraser");
				if (erases) canvas.saveLayer(undefined, rect);
				for (const stroke of layer.strokes) {
					drawStroke(canvas, stroke, multiply);
				}
				if (erases) canvas.restore();
				return recorder.finishRecordingAsPicture();
			} finally {
				// The recorder owns its canvas. finishRecording copies the
				// commands into the picture and does not delete the recorder.
				recorder.dispose();
			}
		},
	);
}

/**
 * Draws a drawing layer in its own space.
 * - Its strokes share a saved layer only when it needs one
 *   (`needsOwnLayer`: an eraser clears only what they drew, and a highlight
 *   multiplies as a whole), or while dimmed or joined by a live stroke.
 *   Settled strokes drawn as one picture keep their erasers in the
 *   picture's own layer (`drawingPicture`).
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
	// The picture this commit draws. The effect holds that object, not the
	// layer id: a thumbnail of an older strokes array re-records the same id.
	const recorded = wrapStroke ? null : drawingPicture(layer, multiply);
	useLayoutEffect(
		() => (recorded ? drawingPictures.hold(recorded) : undefined),
		[recorded],
	);
	const live =
		children !== undefined && children !== null && children !== false;

	const content = recorded ? (
		<Picture picture={recorded} />
	) : (
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
			return stroke.type === "pen" && wrapStroke ? (
				// biome-ignore lint/suspicious/noArrayIndexKey: as above
				<Fragment key={index}>{wrapStroke(index, drawn)}</Fragment>
			) : (
				drawn
			);
		})
	);

	// A recorded picture keeps its erasers in a layer of its own.
	const ownLayer = recorded ? multiply : needsOwnLayer(layer);
	if (!ownLayer && opacity === 1 && !live) {
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

type PathProp = ComponentProps<typeof Path>["path"];

/**
 * A stroke's line as its brush paints it: a pen with its tip, ends, and
 * opacity, or an eraser, which clears.
 * - `path` can be a shared value, for a stroke still growing.
 * - `outline` is that stroke's `roundedEndsOutline`, for rounded ends,
 *   built where the shared value is (this file can't use Reanimated: the
 *   docs draw it without). A settled `path`'s is built here.
 * - `bounds` is that stroke's `inkBounds`, for a faded neon stroke's
 *   layer, built likewise. A settled `path`'s is built here.
 */
export function BrushStroke({
	path,
	outline,
	bounds,
	brush,
	full = false,
}: {
	path: PathProp;
	outline?: PathProp;
	bounds?: ComponentProps<typeof Group>["clip"];
	brush: Brush;
	// Draw a highlighter at full strength. The layer around it multiplies.
	full?: boolean;
}) {
	if (brush.type === "pen" && brush.tip === "neon") {
		const { color, width } = brush;
		const opacity = strokeOpacity(brush);
		const tube = (
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
		// Faded as a whole, so the glow doesn't show through the tube. The
		// clip around it bounds the layer it saves.
		return opacity < 1 ? (
			<Group clip={bounds ?? inkBounds(path as SkPath, visibleReach(brush))}>
				<Group layer={<Paint opacity={opacity} />}>{tube}</Group>
			</Group>
		) : (
			tube
		);
	}
	if (brush.type === "pen" && strokeEnds(brush) === "rounded") {
		return (
			<RoundedEnds
				outline={outline ?? outlineFor(path as SkPath, brush.width)}
				brush={brush}
				full={full}
			/>
		);
	}
	return <Path path={path} {...brushPaint(brush, full)} />;
}

function RoundedEnds({
	outline,
	brush,
	full,
}: {
	outline: PathProp | null;
	brush: PenBrush;
	full: boolean;
}) {
	if (outline === null) return null;
	return (
		<Path
			path={outline}
			style="fill"
			color={brush.color}
			opacity={inkOpacity(brush, full)}
		>
			<CornerPathEffect r={brush.width * ROUNDED_END} />
		</Path>
	);
}

const ROUND_STROKE = {
	style: "stroke",
	strokeCap: "round",
	strokeJoin: "round",
} as const;

// Round ends, but a marker's are square unless chosen otherwise, like a
// highlighter's chisel tip. One path per stroke, so ink crossing itself
// doesn't darken.
function brushPaint(brush: Brush, full: boolean) {
	if (brush.type === "eraser") {
		return {
			...ROUND_STROKE,
			strokeWidth: brush.width,
			color: "black",
			blendMode: "clear",
		} as const;
	}
	return {
		...ROUND_STROKE,
		strokeWidth: brush.width,
		strokeCap: strokeEnds(brush) === "square" ? "square" : "round",
		color: brush.color,
		// A multiplying highlighter is see-through because of the blend.
		// Other ink, and a highlighter saved before it multiplied, keep their
		// own opacity.
		opacity: inkOpacity(brush, full),
	} as const;
}
