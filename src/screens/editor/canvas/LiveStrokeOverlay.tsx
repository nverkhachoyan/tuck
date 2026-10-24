import {
	BackdropFilter,
	Group,
	ImageFilter,
	Path,
	Picture,
	Rect,
	rect,
	Skia,
} from "@shopify/react-native-skia";
import {
	type DerivedValue,
	type SharedValue,
	useDerivedValue,
} from "react-native-reanimated";
import type { ColorMatrix } from "@/model/adjustments";
import { rectFromCorners } from "@/model/geometry";
import { identityTransform } from "@/model/layers/base";
import type { Brush } from "@/model/layers/drawing";
import type { CutStroke } from "@/model/layers/image";
import type { Layer } from "@/model/layers/layer";
import type {
	RedactionEffect,
	RedactionStrokes,
} from "@/model/layers/redaction";
import { isLineShape } from "@/model/layers/shape";
import { lineReach } from "@/model/shapes";
import { LayerContent } from "@/render/LayerContent";
import { BrushStroke, strokePath } from "@/render/layers/DrawingLayerView";
import { MaskStrokePath } from "@/render/layers/ImageLayerView";
import {
	maskMarks,
	recordRedactionStrokes,
	redactionFilter,
} from "@/render/layers/RedactionLayerView";
import { shapePath } from "@/render/layers/ShapeLayerView";
import {
	toInverseTransformList,
	toTransformList,
} from "@/render/layerTransform";
import { colors } from "@/ui/theme";
import type { CanvasTool } from "./canvasInput";
import { LiveRedaction, LiveShape } from "./LiveLayerContent";
import type { LiveTransform } from "./liveTransform";
import { SELECTION_STROKE_PX, useScreenPixels } from "./SelectionOverlay";
import { shapeFromDrag } from "./shapeDrag";

/**
 * A stroke being painted with a tool: its points so far in document space,
 * and its id. It's drawn into `targetId`'s layer, or over everything when
 * it will start a new one; a box runs from its first point to its last.
 * Once the document has it (`landedId`), the scene stops drawing it live in
 * the same update that draws it from the document. Clearing `points`
 * instead would blink: a shared value redraws the canvas before the
 * canvas's own renderer has the new document.
 */
export type LiveStroke = {
	tool: CanvasTool;
	points: SharedValue<number[]>;
	id: SharedValue<number>;
	landedId: number;
	targetId: string | null;
};

/**
 * A layer's content, with `stroke` joining it as it's painted when the
 * layer is its target. A redaction or a shape follows the live values while
 * selected.
 */
export function StrokeTarget({
	layer,
	stroke,
	live,
	matrix,
	showRemoved,
	onImageError,
}: {
	layer: Layer;
	stroke: LiveStroke | null;
	live: LiveTransform;
	matrix?: DerivedValue<ColorMatrix>;
	showRemoved: boolean;
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
	if (layer.type === "shape") return <LiveShape layer={layer} live={live} />;
	if (stroke && tool?.type === "cutBrush" && layer.type === "image") {
		return (
			<LayerContent
				layer={layer}
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
				showRemoved={showRemoved}
				onImageError={onImageError}
			/>
		);
	}
	return (
		<LayerContent
			layer={layer}
			stroke={
				stroke &&
				tool?.type === "draw" && (
					<Group transform={toInverseTransformList(layer.transform)}>
						<LivePath
							key={stroke.landedId}
							stroke={stroke}
							brush={tool.brush}
						/>
					</Group>
				)
			}
			matrix={matrix}
			showRemoved={showRemoved}
			onImageError={onImageError}
		/>
	);
}

/**
 * A stroke that will start a new layer, over everything as it's painted.
 * An eraser has nothing to erase until there's a layer.
 */
export function NewLayerStroke({
	stroke,
	viewScale,
}: {
	stroke: LiveStroke;
	viewScale: DerivedValue<number>;
}) {
	const { tool } = stroke;
	switch (tool.type) {
		case "draw":
			return tool.brush.type === "pen" ? (
				<LivePath stroke={stroke} brush={tool.brush} />
			) : null;
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
		// The cut's tools always have their image.
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

/**
 * A stroke as it's being painted, in document space. Keyed by `landedId`, so
 * a landed stroke gives way to the document's copy in one update.
 */
function LivePath({ stroke, brush }: { stroke: LiveStroke; brush: Brush }) {
	const path = useDerivedValue(() => strokePath(unlanded(stroke)));
	return <BrushStroke path={path} brush={brush} />;
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
		return shapeFromDrag(
			shape,
			{ x: points[0], y: points[1] },
			{ x: points[points.length - 2], y: points[points.length - 1] },
		);
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
		return rectFromCorners(
			{ x: points[0], y: points[1] },
			{ x: points[points.length - 2], y: points[points.length - 1] },
		);
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
