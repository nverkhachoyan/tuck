import { type ReactNode, useState } from "react";
import {
	type DerivedValue,
	type SharedValue,
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import {
	BackdropFilter,
	Group,
	ImageFilter,
	Paint,
	Path,
	Picture,
	Rect,
	rect,
	Skia,
	type SkPath,
} from "react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@/ui/theme";
import { type Point, rectFromCorners } from "../document/geometry";
import { identityTransform } from "../layers/base";
import { BrushStroke, strokePath } from "../layers/drawing/DrawingLayerView";
import type { DrawingLayer, PenBrush } from "../layers/drawing/drawing";
import type { ColorMatrix } from "../layers/image/adjustments";
import { MaskStrokePath } from "../layers/image/ImageLayerView";
import type { CutStroke } from "../layers/image/image";
import { LayerContent } from "../layers/LayerContent";
import type { Layer } from "../layers/layer";
import {
	toInverseTransformList,
	toTransformList,
} from "../layers/layerTransform";
import {
	maskMarks,
	recordRedactionStrokes,
	redactionFilter,
} from "../layers/redaction/RedactionLayerView";
import type {
	RedactionEffect,
	RedactionStrokes,
} from "../layers/redaction/redaction";
import { shapePath } from "../layers/shape/ShapeLayerView";
import { isLineShape, type ShapeLayer } from "../layers/shape/shape";
import { lineReach } from "../layers/shape/shapeGeometry";
import type { CanvasTool } from "./canvasTool";
import { LiveRedaction, LiveShape } from "./LiveLayerContent";
import type { LiveTransform } from "./liveTransform";
import { SELECTION_STROKE_PX, useScreenPixels } from "./SelectionOverlay";
import { shapeFromDrag } from "./shapeDrag";

/**
 * A stroke being painted with a tool, drawn live until the document has it:
 * - `points` so far in document space, and its `id`; a box runs from its
 *   first point to its last.
 * - `landedId`: once the document has the stroke, the scene stops drawing
 *   it live in the same update that draws it from the document. Clearing
 *   `points` instead would blink: a shared value redraws the canvas before
 *   the canvas's own renderer has the new document.
 * - `reaches`: the layers it's drawn into as it's painted.
 * - `startsLayer`: drawn over everything instead, as it will start a layer.
 * - `erasePath`: the Eraser's line, built once for every drawing it reaches.
 * - `nearDrawings`: the drawings the Eraser's line has come near, by id,
 *   which it joins as it's painted; the rest stay without a saved layer.
 * - `crossed`: the shapes the Eraser has crossed, dimmed until it lifts.
 * - `crossedStrokes`: the Stroke eraser's strokes touched so far, by
 *   drawing id, dimmed until it lifts.
 * - `hoveredStroke`: on web, the stroke a Stroke eraser click would take.
 */
export type LiveStroke = {
	tool: CanvasTool;
	points: SharedValue<number[]>;
	id: SharedValue<number>;
	landedId: number;
	reaches: (layer: Layer) => boolean;
	startsLayer: boolean;
	erasePath: DerivedValue<SkPath> | null;
	nearDrawings: SharedValue<Record<string, boolean>> | null;
	crossed: SharedValue<string[]> | null;
	crossedStrokes: SharedValue<Record<string, number[]>> | null;
	hoveredStroke: DerivedValue<HoveredStroke | null> | null;
};

/** A drawing's stroke, by its index in the drawing's strokes. */
export type HoveredStroke = { id: string; index: number };

/**
 * How far a mark out of reach fades: a shape the Eraser crosses, before it
 * goes, and every other drawing and shape while the Eraser keeps to one.
 */
const DIMMED_OPACITY = 0.33;

/**
 * A layer's content, with `stroke` joining it as it's painted when it
 * reaches the layer. A redaction or a shape follows the live values while
 * selected, and a shape the Eraser crosses dims. `dimmed` fades a drawing
 * or shape out of reach.
 */
export function StrokeTarget({
	layer,
	uri,
	stroke,
	live,
	matrix,
	selectionColor,
	dimmed = false,
	onImageError,
}: {
	layer: Layer;
	uri?: string;
	stroke: LiveStroke | null;
	live: LiveTransform;
	matrix?: DerivedValue<ColorMatrix>;
	selectionColor: string | undefined;
	dimmed?: boolean;
	onImageError: (error: unknown) => void;
}) {
	const tool = stroke?.tool;
	if (
		stroke &&
		tool?.type === "redactBrush" &&
		layer.type === "redaction" &&
		layer.shape === "strokes"
	) {
		return <LiveRedactionStrokes layer={layer} stroke={stroke} tool={tool} />;
	}
	if (layer.type === "redaction") {
		return (
			<LiveRedaction layer={layer} live={live} onImageError={onImageError} />
		);
	}
	if (layer.type === "shape") {
		// A dimmed shape is out of the Eraser's reach, so it never crosses.
		if (dimmed) {
			return <LiveShape layer={layer} live={live} opacity={DIMMED_OPACITY} />;
		}
		return stroke?.crossed ? (
			<CrossedShape layer={layer} live={live} stroke={stroke} />
		) : (
			<LiveShape layer={layer} live={live} />
		);
	}
	if (stroke?.crossedStrokes && layer.type === "drawing") {
		return (
			<StrokeErasedDrawing
				layer={layer}
				stroke={stroke}
				opacity={dimmed ? DIMMED_OPACITY : undefined}
				onImageError={onImageError}
			/>
		);
	}
	if (stroke && tool?.type === "cutBrush" && layer.type === "image") {
		return (
			<LayerContent
				layer={layer}
				uri={uri}
				// Into the image's own pixels: out of the layer's space, then
				// unflipped, as `ImageLayerView` flips its cut with it.
				stroke={
					<Group
						transform={[
							...(layer.flipped ? [{ scaleX: -1 }] : []),
							...toInverseTransformList(layer.transform),
						]}
					>
						<LiveCutPath
							key={stroke.landedId}
							stroke={stroke}
							brush={tool.brush}
						/>
					</Group>
				}
				matrix={matrix}
				selectionColor={selectionColor}
				onImageError={onImageError}
			/>
		);
	}
	if (stroke?.nearDrawings && layer.type === "drawing") {
		return (
			<ErasedDrawing
				layer={layer}
				stroke={stroke}
				opacity={dimmed ? DIMMED_OPACITY : undefined}
				onImageError={onImageError}
			/>
		);
	}
	return (
		<LayerContent
			layer={layer}
			uri={uri}
			stroke={
				stroke &&
				tool?.type === "draw" && (
					<Group transform={toInverseTransformList(layer.transform)}>
						<LivePath
							key={stroke.landedId}
							stroke={stroke}
							brush={tool.brush}
							full={tool.brush.tip === "marker"}
						/>
					</Group>
				)
			}
			matrix={matrix}
			selectionColor={selectionColor}
			opacity={dimmed ? DIMMED_OPACITY : undefined}
			onImageError={onImageError}
		/>
	);
}

/**
 * A drawing the Eraser can reach, which its live line joins once it has
 * come near (`nearDrawings`), and leaves once the stroke lands: until then
 * the drawing keeps drawing without a saved layer, if it needs none.
 */
function ErasedDrawing({
	layer,
	stroke,
	opacity,
	onImageError,
}: {
	layer: DrawingLayer;
	stroke: LiveStroke;
	opacity: number | undefined;
	onImageError: (error: unknown) => void;
}) {
	const [near, setNear] = useState(false);
	const { id } = layer;
	const { nearDrawings, erasePath, tool } = stroke;
	useAnimatedReaction(
		() => stroke.id.value > stroke.landedId && nearDrawings?.value[id] === true,
		(now, before) => {
			if (now !== before) scheduleOnRN(setNear, now);
		},
		[id, stroke],
	);
	return (
		<LayerContent
			layer={layer}
			liveInside
			stroke={
				near &&
				erasePath &&
				tool.type === "erase" && (
					<Group transform={toInverseTransformList(layer.transform)}>
						<BrushStroke
							path={erasePath}
							brush={{ type: "eraser", width: tool.width }}
						/>
					</Group>
				)
			}
			opacity={opacity}
			onImageError={onImageError}
		/>
	);
}

/**
 * A drawing the Stroke eraser reaches, each stroke it has touched, or a
 * click would take, at a third of its strength.
 */
function StrokeErasedDrawing({
	layer,
	stroke,
	opacity,
	onImageError,
}: {
	layer: DrawingLayer;
	stroke: LiveStroke;
	opacity: number | undefined;
	onImageError: (error: unknown) => void;
}) {
	const { id } = layer;
	const count = layer.strokes.length;
	const { crossedStrokes, hoveredStroke } = stroke;
	// Written only when what's dimmed changes, since every stroke reads it.
	const dimmedStrokes = useSharedValue<readonly number[]>(NO_STROKES);
	useAnimatedReaction(
		(): readonly number[] => {
			const touched =
				stroke.id.value > stroke.landedId
					? (crossedStrokes?.value[id] ?? NO_STROKES)
					: NO_STROKES;
			const hovered = hoveredStroke?.value;
			return hovered && hovered.id === id && hovered.index < count
				? [...touched, hovered.index]
				: touched;
		},
		(now) => {
			const before = dimmedStrokes.value;
			if (
				now.length !== before.length ||
				now.some((index, i) => index !== before[i])
			) {
				dimmedStrokes.value = now;
			}
		},
		[id, count, stroke],
	);
	return (
		<LayerContent
			layer={layer}
			opacity={opacity}
			wrapStroke={(index, drawn) => (
				<DimmedStroke index={index} dimmed={dimmedStrokes}>
					{drawn}
				</DimmedStroke>
			)}
			onImageError={onImageError}
		/>
	);
}

const NO_STROKES: readonly number[] = [];

// A stroke at a third of its strength while `dimmed` lists its index.
function DimmedStroke({
	index,
	dimmed,
	children,
}: {
	index: number;
	dimmed: DerivedValue<readonly number[]>;
	children: ReactNode;
}) {
	const opacity = useDerivedValue<number>(
		() => (dimmed.value.includes(index) ? DIMMED_OPACITY : 1),
		[index],
	);
	return <Group opacity={opacity}>{children}</Group>;
}

/** A shape at a third of its strength while the Eraser has crossed it. */
function CrossedShape({
	layer,
	live,
	stroke,
}: {
	layer: ShapeLayer;
	live: LiveTransform;
	stroke: LiveStroke;
}) {
	const { id } = layer;
	const { crossed } = stroke;
	const opacity = useDerivedValue<number>(
		() =>
			stroke.id.value > stroke.landedId && crossed?.value.includes(id)
				? DIMMED_OPACITY
				: 1,
		[id, stroke],
	);
	return <LiveShape layer={layer} live={live} opacity={opacity} />;
}

/** A stroke that will start a new layer, over everything as it's painted. */
export function NewLayerStroke({
	stroke,
	viewScale,
}: {
	stroke: LiveStroke;
	viewScale: DerivedValue<number>;
}) {
	const { tool } = stroke;
	switch (tool.type) {
		case "draw": {
			const path = (
				<LivePath
					stroke={stroke}
					brush={tool.brush}
					full={tool.brush.tip === "marker"}
				/>
			);
			// A new highlighter multiplies as it's drawn. It lands as its own
			// layer, which multiplies the same way.
			return tool.brush.tip === "marker" ? (
				<Group layer={<Paint blendMode="multiply" />}>{path}</Group>
			) : (
				path
			);
		}
		case "redactBrush":
			return tool.brush.type === "pen" ? (
				<LiveRedactionStrokes layer={null} stroke={stroke} tool={tool} />
			) : null;
		case "redactBox":
			return (
				<LiveBox stroke={stroke} effect={tool.effect} viewScale={viewScale} />
			);
		case "drawShape":
			return <LiveNewShape stroke={stroke} tool={tool} />;
		// The cut's tools always have their image, and the Eraser has nothing
		// to erase until there's a layer.
		case "erase":
		case "pickColor":
		case "cutBrush":
		case "pickSubject":
			return null;
	}
}

// Whatever of a stroke is still to land in the document (see `LiveStroke`).
// A worklet, as the live views below read it as the stroke grows.
function unlanded(stroke: LiveStroke): number[] {
	"worklet";
	return stroke.id.value > stroke.landedId ? stroke.points.value : [];
}

// Where a drag's points began and where they are now.
function dragEnds(points: number[]): [Point, Point] {
	"worklet";
	return [
		{ x: points[0], y: points[1] },
		{ x: points[points.length - 2], y: points[points.length - 1] },
	];
}

/**
 * A stroke as it's being painted, in document space. Keyed by `landedId`, so
 * a landed stroke gives way to the document's copy in one update.
 */
function LivePath({
	stroke,
	brush,
	full = false,
}: {
	stroke: LiveStroke;
	brush: PenBrush;
	full?: boolean;
}) {
	const path = useDerivedValue(() => strokePath(unlanded(stroke)));
	return <BrushStroke path={path} brush={brush} full={full} />;
}

/** A stroke on an image's cut as it's being painted, in document space. */
function LiveCutPath({
	stroke,
	brush,
}: {
	stroke: LiveStroke;
	brush: Omit<CutStroke, "points">;
}) {
	const path = useDerivedValue(() => strokePath(unlanded(stroke)));
	return <MaskStrokePath path={path} stroke={brush} />;
}

/**
 * A redaction's strokes with one still being painted, in the layer's own
 * space, or on its own in document space when it will start a new one
 * (`layer` is null). Recorded again as the stroke grows.
 */
function LiveRedactionStrokes({
	layer,
	stroke,
	tool,
}: {
	layer: RedactionStrokes | null;
	stroke: LiveStroke;
	tool: Extract<CanvasTool, { type: "redactBrush" }>;
}) {
	const { brush } = tool;
	const effect = layer?.effect ?? tool.effect;
	const transform = layer?.transform ?? null;
	const marks = layer ? maskMarks(layer.strokes) : [];
	const picture = useDerivedValue(() => {
		const points = unlanded(stroke);
		return recordRedactionStrokes(
			effect,
			transform ?? identityTransform,
			marks,
			points.length === 0
				? null
				: {
						mark: {
							path: strokePath(points),
							width: brush.width,
							eraser: brush.type === "eraser",
						},
						layerTransform: transform,
					},
			null,
		);
	}, [effect, transform, marks, brush, stroke]);
	return <Picture picture={picture} />;
}

/**
 * A shape as it's dragged out, from where the drag began to where it is, as
 * the document will have it: a box between them, or a line to it.
 */
function LiveNewShape({
	stroke,
	tool,
}: {
	stroke: LiveStroke;
	tool: Extract<CanvasTool, { type: "drawShape" }>;
}) {
	const { shape, style } = tool;
	const placement = useDerivedValue(() => {
		const points = unlanded(stroke);
		if (points.length === 0) return null;
		const [from, to] = dragEnds(points);
		return shapeFromDrag(shape, from, to);
	});
	const transform = useDerivedValue(() => {
		const { x = 0, y = 0, rotation = 0 } = placement.value ?? {};
		return toTransformList({ ...identityTransform, x, y, rotation });
	});
	const path = useDerivedValue(() => {
		const shown = placement.value;
		if (!shown || shown.width === 0) return Skia.PathBuilder.Make().build();
		return shapePath(
			shape,
			shown.width / 2,
			isLineShape(shape)
				? lineReach(shape, style.strokeWidth)
				: shown.height / 2,
			style.strokeWidth,
		);
	});
	return (
		<Group transform={transform}>
			<Path path={path} color={style.color} />
		</Group>
	);
}

/**
 * A redaction's box as it's dragged out, in document space, outlined so a
 * blur or pixelation over a plain area still shows where it goes.
 */
function LiveBox({
	stroke,
	effect,
	viewScale,
}: {
	stroke: LiveStroke;
	effect: RedactionEffect;
	viewScale: DerivedValue<number>;
}) {
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const box = useDerivedValue(() => {
		const points = unlanded(stroke);
		if (points.length === 0) return rect(0, 0, 0, 0);
		const [from, to] = dragEnds(points);
		return rectFromCorners(from, to);
	});
	return (
		<Group>
			{effect.type === "solid" ? (
				<Rect rect={box} color={effect.color} />
			) : (
				<BackdropFilter
					clip={box}
					filter={
						<ImageFilter filter={redactionFilter(effect, identityTransform)} />
					}
				/>
			)}
			<Rect
				rect={box}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
		</Group>
	);
}
