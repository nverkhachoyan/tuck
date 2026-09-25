import {
	BackdropBlur,
	Fill,
	Group,
	Path,
	Picture,
	Rect,
	rect,
	Shadow,
	Skia,
} from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { brushPaint, strokePath } from "@/layers/DrawingLayerView";
import { layerBounds } from "@/layers/layerBounds";
import {
	toInverseTransformList,
	toTransformList,
} from "@/layers/layerTransform";
import {
	layerBlur,
	maskMarks,
	RedactionLayerView,
	recordLayerStrokes,
	recordRedactionStrokes,
	strokesPicture,
} from "@/layers/RedactionLayerView";
import type {
	Brush,
	EditorDocument,
	Layer,
	MaskStroke,
	RedactionBox,
	RedactionEffect,
	RedactionLayer,
	RedactionStrokes,
} from "@/model/document";
import { drawingBox } from "@/model/drawing";
import { rectFromCorners } from "@/model/geometry";
import { colors } from "@/theme";
import { CanvasBackground, LayerContent } from "../EditorSceneParts";
import { handleSides } from "../handles/handleGeometry";
import { handleMetrics, shownHandles } from "../handles/handleMetrics";
import type { LiveTransform } from "./liveTransform";

const SELECTION_STROKE_PX = 1.5;
// Under the selection's lines, so they read on light photos as on dark ones.
const SELECTION_HALO_PX = 3.5;
const SELECTION_HALO = "rgba(0, 0, 0, 0.22)";
// The canvas's shadow on the well around it, and the hairline at its edge
// that keeps a black canvas visible, in screen pixels.
const SHADOW_OFFSET_PX = 6;
const SHADOW_BLUR_PX = 18;
const EDGE_PX = 1;

/**
 * What dragging on the canvas does in place of moving layers: draws with a
 * brush, drags out a redaction's box, or paints a redaction's strokes.
 */
export type CanvasTool =
	| { type: "draw"; brush: Brush }
	| { type: "redactBox"; effect: RedactionEffect }
	| {
			type: "redactBrush";
			brush: Omit<MaskStroke, "points">;
			effect: RedactionEffect;
	  };

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

type EditorSceneProps = {
	document: EditorDocument;
	selectedLayerId: string | null;
	hiddenLayerId: string | null;
	// Screen pixels per document unit.
	viewScale: number;
	live: LiveTransform;
	stroke: LiveStroke | null;
	// Outlined without handles, as a tool's target: it holds still.
	outlinedLayer: Layer | null;
	// An image layer's file couldn't be read or decoded. Must be stable.
	onImageError: (error: unknown) => void;
};

/**
 * The editor's counterpart to `DocumentRenderScene`: draws every layer in document
 * space, but loads images asynchronously, lets the selected layer follow
 * the live gesture values, fades whatever export will crop, and draws the
 * selection above everything. A transparent canvas shows a checkerboard.
 *
 * A locked image is cut off at the canvas's edge, like a crop. Once unlocked
 * it moves like any layer, so it fades past the edge instead. The canvas
 * sits on the well like a print, with a shadow and an edge around it.
 */
export function EditorScene({
	document,
	selectedLayerId,
	hiddenLayerId,
	viewScale,
	live,
	stroke,
	outlinedLayer,
	onImageError,
}: EditorSceneProps) {
	const canvas = rect(0, 0, document.width, document.height);
	return (
		<Group>
			<CanvasBackground
				bounds={canvas}
				background={document.background}
				viewScale={viewScale}
			/>
			{document.layers.map((layer) =>
				layer.hidden || layer.id === hiddenLayerId ? null : (
					<Group
						key={layer.id}
						clip={layer.type === "image" && layer.locked ? canvas : undefined}
					>
						<LiveLayer layer={layer} live={live}>
							<StrokeTarget
								layer={layer}
								stroke={stroke?.targetId === layer.id ? stroke : null}
								live={live}
								onImageError={onImageError}
							/>
						</LiveLayer>
					</Group>
				),
			)}
			{stroke?.targetId === null && (
				<NewLayerStroke
					key={stroke.landedId}
					stroke={stroke}
					viewScale={viewScale}
				/>
			)}
			<Group clip={canvas} invertClip>
				<Fill color={colors.canvasWell} opacity={0.7} />
				<Rect rect={canvas} color="black">
					<Shadow
						dx={0}
						dy={SHADOW_OFFSET_PX / viewScale}
						blur={SHADOW_BLUR_PX / viewScale}
						color="rgba(0, 0, 0, 0.6)"
						shadowOnly
					/>
				</Rect>
				{/* Doubled, as the canvas clips away its inner half. */}
				<Rect
					rect={canvas}
					style="stroke"
					strokeWidth={(EDGE_PX * 2) / viewScale}
					color={colors.hoverOverlay}
				/>
			</Group>
			<SnapGuides document={document} viewScale={viewScale} live={live} />
			{outlinedLayer && (
				<SelectionOutline layer={outlinedLayer} viewScale={viewScale} />
			)}
			{selectedLayerId !== null && selectedLayerId !== hiddenLayerId && (
				<SelectionHandles live={live} viewScale={viewScale} />
			)}
		</Group>
	);
}

/**
 * Positions a layer's content with its transform, except while a gesture is
 * moving it: then the gesture-driven values win over the document.
 */
function LiveLayer({
	layer,
	live,
	children,
}: {
	layer: Layer;
	live: LiveTransform;
	children: ReactNode;
}) {
	const transform = useDerivedValue(() => {
		const active = live.activeId.value === layer.id;
		const t = layer.transform;
		return toTransformList({
			x: active ? live.x.value : t.x,
			y: active ? live.y.value : t.y,
			rotation: active ? live.rotation.value : t.rotation,
			scaleX: active ? live.scaleX.value : t.scaleX,
			scaleY: active ? live.scaleY.value : t.scaleY,
		});
	}, [layer.id, layer.transform]);

	return <Group transform={transform}>{children}</Group>;
}

/**
 * A layer's content, with `stroke` joining it as it's painted when the
 * layer is its target. A redaction follows the live values while selected.
 */
function StrokeTarget({
	layer,
	stroke,
	live,
	onImageError,
}: {
	layer: Layer;
	stroke: LiveStroke | null;
	live: LiveTransform;
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
		return <LiveRedaction layer={layer} live={live} />;
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
			onImageError={onImageError}
		/>
	);
}

/**
 * A redaction that follows the live values while it's selected, as
 * `LiveLayer` places it: a box's size as its sides are dragged, and a blur
 * that holds its strength in document pixels while a pinch or a corner
 * scales the layer, rather than growing with it until the scale commits.
 */
function LiveRedaction({
	layer,
	live,
}: {
	layer: RedactionLayer;
	live: LiveTransform;
}) {
	if (layer.shape === "box") {
		return <LiveRedactionBox layer={layer} live={live} />;
	}
	if (layer.effect.type === "blur") {
		return <LiveBlurStrokes layer={layer} live={live} />;
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
	const { id, width, height, effect, transform } = layer;
	const box = useDerivedValue(() => {
		const active = live.activeId.value === id;
		const w = active ? live.halfWidth.value : width / 2;
		const h = active ? live.halfHeight.value : height / 2;
		return rect(-w, -h, w * 2, h * 2);
	}, [id, width, height]);
	const radius = effect.type === "blur" ? effect.radius : 0;
	const blur = useDerivedValue(() => {
		const active = live.activeId.value === id;
		return layerBlur(radius, active ? live.scaleX.value : transform.scaleX);
	}, [id, radius, transform.scaleX]);
	return effect.type === "solid" ? (
		<Rect rect={box} color={effect.color} />
	) : (
		<BackdropBlur clip={box} blur={blur} />
	);
}

/**
 * Blurred strokes, recorded again for the live scale while it's off the
 * document's. Otherwise they're the picture export draws.
 */
function LiveBlurStrokes({
	layer,
	live,
}: {
	layer: RedactionStrokes;
	live: LiveTransform;
}) {
	const { id, effect, transform } = layer;
	const committed = strokesPicture(layer);
	const marks = maskMarks(layer.strokes);
	const box = drawingBox(layer);
	const picture = useDerivedValue(() => {
		const scale =
			live.activeId.value === id ? live.scaleX.value : transform.scaleX;
		return scale === transform.scaleX
			? committed
			: recordLayerStrokes(effect, marks, box, scale);
	}, [layer]);
	return <Picture picture={picture} />;
}

/**
 * A stroke that will start a new layer, over everything as it's painted.
 * An eraser has nothing to erase until there's a layer.
 */
function NewLayerStroke({
	stroke,
	viewScale,
}: {
	stroke: LiveStroke;
	viewScale: number;
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
	return <Path path={path} {...brushPaint(brush)} />;
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
			transform?.scaleX ?? 1,
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
 * A redaction's box as it's dragged out, in document space, outlined so a
 * blur over a plain area still shows where it goes.
 */
function LiveBox({
	stroke,
	effect,
	viewScale,
}: {
	stroke: LiveStroke;
	effect: RedactionEffect;
	viewScale: number;
}) {
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
				<BackdropBlur clip={box} blur={effect.radius} />
			)}
			<Rect
				rect={box}
				color={colors.selection}
				style="stroke"
				strokeWidth={SELECTION_STROKE_PX / viewScale}
			/>
		</Group>
	);
}

/**
 * A layer's selection outline where the document has it, with no handles:
 * what a tool acts on, while gestures leave it be.
 */
function SelectionOutline({
	layer,
	viewScale,
}: {
	layer: Layer;
	viewScale: number;
}) {
	const { transform } = layer;
	const { halfWidth, halfHeight } = layerBounds(layer);
	const w = halfWidth * transform.scaleX;
	const h = halfHeight * transform.scaleY;
	const box = rect(-w, -h, w * 2, h * 2);
	return (
		<Group transform={toTransformList({ ...transform, scaleX: 1, scaleY: 1 })}>
			<Rect
				rect={box}
				color={SELECTION_HALO}
				style="stroke"
				strokeWidth={SELECTION_HALO_PX / viewScale}
			/>
			<Rect
				rect={box}
				color={colors.selection}
				style="stroke"
				strokeWidth={SELECTION_STROKE_PX / viewScale}
			/>
		</Group>
	);
}

/** The document's edge or center lines the dragged layer has snapped onto. */
function SnapGuides({
	document,
	viewScale,
	live,
}: {
	document: EditorDocument;
	viewScale: number;
	live: LiveTransform;
}) {
	const { width, height } = document;
	const path = useDerivedValue(() => {
		const builder = Skia.PathBuilder.Make();
		const x = live.guideX.value;
		const y = live.guideY.value;
		if (x !== null) {
			builder.moveTo(x, 0);
			builder.lineTo(x, height);
		}
		if (y !== null) {
			builder.moveTo(0, y);
			builder.lineTo(width, y);
		}
		return builder.build();
	}, [width, height]);

	return (
		<Path
			path={path}
			color={colors.accent}
			style="stroke"
			strokeWidth={SELECTION_STROKE_PX / viewScale}
		/>
	);
}

/**
 * The selected layer's outline and its corner (scale) and knob (rotate)
 * handles, and a box's side (resize) handles when it resizes freely, drawn
 * from the live values so they follow gestures. The group translates and
 * rotates with the layer but doesn't scale: the scale moves the corners
 * instead, so handles stay the same size on screen.
 */
function SelectionHandles({
	live,
	viewScale,
}: {
	live: LiveTransform;
	viewScale: number;
}) {
	const transform = useDerivedValue(() =>
		toTransformList({
			x: live.x.value,
			y: live.y.value,
			rotation: live.rotation.value,
			scaleX: 1,
			scaleY: 1,
		}),
	);

	// The outline and the stem up to the knob as one path, and the corner
	// dots, side pills, and knob as another.
	const shapes = useDerivedValue(() => {
		const lines = Skia.PathBuilder.Make();
		const handles = Skia.PathBuilder.Make();
		const box = {
			halfWidth: live.halfWidth.value,
			halfHeight: live.halfHeight.value,
		};
		const w = box.halfWidth * live.scaleX.value;
		const h = box.halfHeight * live.scaleY.value;
		lines.addRect(Skia.XYWHRect(-w, -h, w * 2, h * 2));
		const radius = (handleMetrics.size / viewScale) * 0.6;
		// Pills along the sides, so they read as pulling that side out.
		const long = radius * 3.2;
		const short = radius * 1.5;
		const shown = shownHandles(
			box,
			live.scaleX.value,
			live.scaleY.value,
			viewScale,
			live.resizeMode.value !== "none",
		);
		for (const handle of shown) {
			if (handle === "rotate") {
				const knobY = -h - handleMetrics.knobOffset / viewScale;
				handles.addCircle(0, knobY, radius);
				lines.moveTo(0, -h);
				lines.lineTo(0, knobY + radius);
				continue;
			}
			const sides = handleSides(handle);
			const x = sides.x * w;
			const y = sides.y * h;
			if (sides.x !== 0 && sides.y !== 0) {
				handles.addCircle(x, y, radius);
				continue;
			}
			const width = sides.x === 0 ? long : short;
			const height = sides.x === 0 ? short : long;
			handles.addRRect(
				Skia.RRectXY(
					Skia.XYWHRect(x - width / 2, y - height / 2, width, height),
					short / 2,
					short / 2,
				),
			);
		}
		return { lines: lines.build(), handles: handles.build() };
	}, [viewScale]);
	const lines = useDerivedValue(() => shapes.value.lines);
	const handles = useDerivedValue(() => shapes.value.handles);

	const strokeWidth = SELECTION_STROKE_PX / viewScale;
	return (
		<Group transform={transform}>
			<Path
				path={lines}
				color={SELECTION_HALO}
				style="stroke"
				strokeWidth={SELECTION_HALO_PX / viewScale}
			/>
			<Path
				path={lines}
				color={colors.selection}
				style="stroke"
				strokeWidth={strokeWidth}
			/>
			<Path path={handles} color="#FFFFFF">
				<Shadow
					dx={0}
					dy={1 / viewScale}
					blur={3 / viewScale}
					color="rgba(0, 0, 0, 0.4)"
				/>
			</Path>
			<Path
				path={handles}
				color={colors.selection}
				style="stroke"
				strokeWidth={strokeWidth}
			/>
		</Group>
	);
}
