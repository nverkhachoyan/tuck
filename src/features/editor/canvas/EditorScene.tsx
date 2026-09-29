import {
	BackdropFilter,
	Fill,
	Group,
	ImageFilter,
	Path,
	Picture,
	Rect,
	rect,
	Shadow,
	Skia,
	type SkRect,
} from "@shopify/react-native-skia";
import { type ReactNode, useEffect } from "react";
import {
	cancelAnimation,
	type DerivedValue,
	type SharedValue,
	useDerivedValue,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import type { MappedDetectionRect } from "@/detection/mapDetectionRects";
import { BrushStroke, strokePath } from "@/layers/DrawingLayerView";
import { layerBounds } from "@/layers/layerBounds";
import {
	toInverseTransformList,
	toTransformList,
} from "@/layers/layerTransform";
import {
	type FilterEffect,
	maskMarks,
	RedactionLayerView,
	recordLayerStrokes,
	recordRedactionStrokes,
	redactionFilter,
	strokesPicture,
} from "@/layers/RedactionLayerView";
import { shapePath } from "@/layers/ShapeLayerView";
import { TextLayerView } from "@/layers/TextLayerView";
import { clampSelection, type TextSelection } from "@/layers/textEditing";
import { textCaretRect, textSelectionRects } from "@/layers/textLayerLayout";
import type { ColorMatrix } from "@/model/adjustments";
import {
	type Brush,
	type EditorDocument,
	identityTransform,
	isLineShape,
	type Layer,
	type MaskStroke,
	type RedactionBox,
	type RedactionEffect,
	type RedactionLayer,
	type RedactionStrokes,
	type ShapeKind,
	type ShapeLayer,
	type ShapeStyle,
	type TextLayer,
} from "@/model/document";
import { drawingBox } from "@/model/drawing";
import { rectFromCorners, transformsEqual } from "@/model/geometry";
import { lineReach, shapeBox } from "@/model/shapes";
import { colors } from "@/theme";
import { CanvasBackground, LayerContent } from "../EditorSceneParts";
import { handleSides } from "../handles/handleGeometry";
import { handleMetrics, shownHandles } from "../handles/handleMetrics";
import { type LiveTransform, readLiveTransform } from "./liveTransform";
import { shapeFromDrag } from "./shapeDrag";

const SELECTION_STROKE_PX = 1.5;
// Under the selection's lines, so they read on light photos as on dark ones.
const SELECTION_HALO_PX = 3.5;
const SELECTION_HALO = "rgba(0, 0, 0, 0.22)";
// The canvas's shadow on the stage around it, and the hairline at its edge
// that keeps a black canvas visible, in screen pixels.
const SHADOW_OFFSET_PX = 6;
const SHADOW_BLUR_PX = 18;
const EDGE_PX = 1;
// A caret's width, and its halo's on each side, in screen pixels, and how
// long it stays on, then off, as it blinks.
const CARET_PX = 2;
const CARET_HALO_PX = 1;
const CARET_BLINK_MS = 530;
// Over the text rather than under it, where a box would hide it.
const TEXT_SELECTION = "rgba(88, 166, 255, 0.4)";
// A detected region's check mark's radius, in screen pixels.
const MARKER_PX = 8;

/**
 * What dragging on the canvas does in place of moving layers: draws with a
 * brush, drags out a shape or a redaction's box, paints a redaction's
 * strokes, or picks a color where the finger lifts.
 */
export type CanvasTool =
	| { type: "draw"; brush: Brush }
	| { type: "drawShape"; shape: ShapeKind; style: ShapeStyle }
	| { type: "pickColor" }
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

/**
 * Text being edited in place: its layer as typed so far, which is drawn in
 * place of the document's (or on top when `isNew`: it's added once editing
 * ends), and its caret or selection. The caret shows while `focused`.
 */
export type TextEditState = {
	layer: TextLayer;
	isNew: boolean;
	selection: TextSelection;
	focused: boolean;
};

/**
 * An image layer whose adjustments a control is changing: `matrix` colors
 * it meanwhile, following the control without rendering React.
 */
export type LiveAdjustment = {
	layerId: string;
	matrix: DerivedValue<ColorMatrix>;
};

type EditorSceneProps = {
	document: EditorDocument;
	selectedLayerId: string | null;
	textEdit: TextEditState | null;
	// Screen pixels per document unit, as shown: it follows a zoom as it goes.
	viewScale: DerivedValue<number>;
	// The same once the view settles, for what's too costly to draw again on
	// every frame of a zoom (the checkerboard).
	settledScale: number;
	live: LiveTransform;
	stroke: LiveStroke | null;
	// Outlined without handles, as a tool's target: it holds still.
	outlinedLayer: Layer | null;
	adjusting: LiveAdjustment | null;
	detections: readonly DetectionOverlayRegion[];
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
 * sits on the stage like a print, with a shadow and an edge around it.
 *
 * What's sized in screen pixels (outlines, handles, the shadow) keeps its
 * size on screen at any zoom, following `viewScale` on the UI thread.
 */
export function EditorScene({
	document,
	selectedLayerId,
	textEdit,
	viewScale,
	settledScale,
	live,
	stroke,
	outlinedLayer,
	adjusting,
	detections,
	onImageError,
}: EditorSceneProps) {
	const editedId = textEdit && !textEdit.isNew ? textEdit.layer.id : null;
	const canvas = rect(0, 0, document.width, document.height);
	const shadowOffset = useScreenPixels(viewScale, SHADOW_OFFSET_PX);
	const shadowBlur = useScreenPixels(viewScale, SHADOW_BLUR_PX);
	// Doubled, as the canvas clips away its inner half.
	const edge = useScreenPixels(viewScale, EDGE_PX * 2);
	return (
		<Group>
			<CanvasBackground
				bounds={canvas}
				background={document.background}
				viewScale={settledScale}
			/>
			{document.layers.map((layer) =>
				layer.hidden ? null : (
					<Group
						key={layer.id}
						clip={layer.type === "image" && layer.locked ? canvas : undefined}
					>
						<LiveLayer layer={layer} live={live}>
							{textEdit && layer.id === editedId ? (
								<EditedText edit={textEdit} viewScale={viewScale} />
							) : (
								<StrokeTarget
									layer={layer}
									stroke={stroke?.targetId === layer.id ? stroke : null}
									live={live}
									matrix={
										adjusting?.layerId === layer.id
											? adjusting.matrix
											: undefined
									}
									onImageError={onImageError}
								/>
							)}
						</LiveLayer>
					</Group>
				),
			)}
			{textEdit?.isNew && (
				<Group transform={toTransformList(textEdit.layer.transform)}>
					<EditedText edit={textEdit} viewScale={viewScale} />
				</Group>
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
						dy={shadowOffset}
						blur={shadowBlur}
						color="rgba(0, 0, 0, 0.6)"
						shadowOnly
					/>
				</Rect>
				<Rect
					rect={canvas}
					style="stroke"
					strokeWidth={edge}
					color={colors.hoverOverlay}
				/>
			</Group>
			{detections.length > 0 && (
				<Group clip={canvas}>
					{detections.map((region) => (
						<DetectionOutline
							key={region.sourceIndex}
							region={region}
							viewScale={viewScale}
						/>
					))}
				</Group>
			)}
			<SnapGuides document={document} viewScale={viewScale} live={live} />
			{outlinedLayer && (
				<SelectionOutline layer={outlinedLayer} viewScale={viewScale} />
			)}
			{selectedLayerId !== null && (
				<SelectionHandles live={live} viewScale={viewScale} />
			)}
		</Group>
	);
}

export type DetectionOverlayRegion = MappedDetectionRect & {
	selected: boolean;
};

/**
 * `px` screen pixels in document units, following the view's scale as a
 * zoom changes it.
 */
function useScreenPixels(viewScale: DerivedValue<number>, px: number) {
	return useDerivedValue(() => px / viewScale.value, [viewScale, px]);
}

/**
 * A temporary detector proposal, outlined until the user applies it, with a
 * mark in its corner that's checked while it's chosen.
 */
function DetectionOutline({
	region,
	viewScale,
}: {
	region: DetectionOverlayRegion;
	viewScale: DerivedValue<number>;
}) {
	const { width, height, transform, selected } = region;
	const box = rect(-width / 2, -height / 2, width, height);
	const marker = useDerivedValue(() => {
		const radius = MARKER_PX / viewScale.value;
		const x = width / 2 - radius * 0.2;
		const y = -height / 2 + radius * 0.2;
		const disc = Skia.PathBuilder.Make();
		disc.addCircle(x, y, radius);
		const check = Skia.PathBuilder.Make();
		check.moveTo(x - radius * 0.42, y);
		check.lineTo(x - radius * 0.1, y + radius * 0.34);
		check.lineTo(x + radius * 0.48, y - radius * 0.34);
		return { disc: disc.build(), check: check.build() };
	}, [viewScale, width, height]);
	const disc = useDerivedValue(() => marker.value.disc);
	const check = useDerivedValue(() => marker.value.check);
	const outline = useScreenPixels(viewScale, selected ? 2 : 1.25);
	const ring = useScreenPixels(viewScale, 1.25);
	const tick = useScreenPixels(viewScale, 2);
	return (
		<Group transform={toTransformList(transform)}>
			<Rect
				rect={box}
				color={selected ? colors.accentSoft : "rgba(0, 0, 0, 0.18)"}
			/>
			<Rect
				rect={box}
				color={selected ? colors.accent : colors.textSecondary}
				style="stroke"
				strokeWidth={outline}
			/>
			<Path path={disc} color={selected ? colors.accent : colors.surface} />
			<Path
				path={disc}
				color={selected ? colors.accent : colors.textSecondary}
				style="stroke"
				strokeWidth={ring}
			/>
			{selected && (
				<Path
					path={check}
					color={colors.onAccent}
					style="stroke"
					strokeWidth={tick}
					strokeCap="round"
					strokeJoin="round"
				/>
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
 * layer is its target. A redaction or a shape follows the live values while
 * selected.
 */
function StrokeTarget({
	layer,
	stroke,
	live,
	matrix,
	onImageError,
}: {
	layer: Layer;
	stroke: LiveStroke | null;
	live: LiveTransform;
	matrix?: DerivedValue<ColorMatrix>;
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
	if (layer.type === "shape") return <LiveShape layer={layer} live={live} />;
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
			onImageError={onImageError}
		/>
	);
}

/**
 * Text being edited, in its layer's space: what's typed so far, with the
 * selection over it, or the caret, blinking while it holds still.
 */
function EditedText({
	edit,
	viewScale,
}: {
	edit: TextEditState;
	viewScale: DerivedValue<number>;
}) {
	const { layer, focused } = edit;
	const selection = clampSelection(edit.selection, layer.text.length);
	const collapsed = selection.start === selection.end;
	// One screen pixel, across the layer, in its own units.
	const { scaleX } = layer.transform;
	const pixel = useDerivedValue(
		() => 1 / (viewScale.value * scaleX),
		[viewScale, scaleX],
	);
	let highlight = null;
	if (!collapsed) {
		const builder = Skia.PathBuilder.Make();
		for (const box of textSelectionRects(layer, selection)) {
			builder.addRect(Skia.XYWHRect(box.x, box.y, box.width, box.height));
		}
		highlight = builder.build();
	}
	return (
		<>
			<TextLayerView layer={layer} />
			{highlight && <Path path={highlight} color={TEXT_SELECTION} />}
			{focused && collapsed && (
				<Caret
					layer={layer}
					index={selection.start}
					pixel={pixel}
					key={`${selection.start}:${layer.text}`}
				/>
			)}
		</>
	);
}

/**
 * A text caret before `index`, `pixel` being a screen pixel in the layer's
 * units. It blinks from the moment it mounts: keyed by where it is and the
 * text, so it holds still while it moves and while typing.
 */
function Caret({
	layer,
	index,
	pixel,
}: {
	layer: TextLayer;
	index: number;
	pixel: DerivedValue<number>;
}) {
	const { x, y, height } = textCaretRect(layer, index);
	const bar = useDerivedValue(() => {
		const width = CARET_PX * pixel.value;
		return rect(x - width / 2, y, width, height);
	}, [pixel, x, y, height]);
	const halo = useDerivedValue(() => {
		const margin = CARET_HALO_PX * pixel.value;
		const width = CARET_PX * pixel.value + margin * 2;
		return rect(x - width / 2, y - margin, width, height + margin * 2);
	}, [pixel, x, y, height]);
	const opacity = useSharedValue(1);
	useEffect(() => {
		opacity.value = withSequence(
			withTiming(1, { duration: 0 }),
			withRepeat(
				withSequence(
					withDelay(CARET_BLINK_MS, withTiming(0, { duration: 0 })),
					withDelay(CARET_BLINK_MS, withTiming(1, { duration: 0 })),
				),
				-1,
			),
		);
		return () => cancelAnimation(opacity);
	}, [opacity]);
	return (
		<Group opacity={opacity}>
			<Rect rect={halo} color={SELECTION_HALO} />
			<Rect rect={bar} color={colors.selection} />
		</Group>
	);
}

/**
 * A redaction that follows the live values while it's selected, as
 * `LiveLayer` places it: a box's size as its sides are dragged, and a blur
 * or pixelation that holds in document pixels while a gesture moves or
 * scales the layer, rather than moving and growing with it until the
 * gesture commits.
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
		const active = live.activeId.value === id;
		const w = active ? live.halfWidth.value : width / 2;
		const h = active ? live.halfHeight.value : height / 2;
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
		() =>
			redactionFilter(
				effect,
				live.activeId.value === id ? readLiveTransform(live) : transform,
			),
		[id, effect, transform],
	);
	return <BackdropFilter clip={box} filter={<ImageFilter filter={filter} />} />;
}

/**
 * A shape that follows the live values while it's selected, as `LiveLayer`
 * places it: its box's size as its sides are dragged, or its length as an
 * end is.
 */
function LiveShape({
	layer,
	live,
}: {
	layer: ShapeLayer;
	live: LiveTransform;
}) {
	const { id, shape, strokeWidth } = layer;
	const { halfWidth, halfHeight } = shapeBox(layer);
	const path = useDerivedValue(() => {
		const active = live.activeId.value === id;
		return shapePath(
			shape,
			active ? live.halfWidth.value : halfWidth,
			active ? live.halfHeight.value : halfHeight,
			strokeWidth,
		);
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
		const current =
			live.activeId.value === id ? readLiveTransform(live) : transform;
		return transformsEqual(current, transform)
			? committed
			: recordLayerStrokes(effect, marks, box, current);
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
		case "pickColor":
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

/**
 * A layer's selection outline where the document has it, with no handles:
 * what a tool acts on, while gestures leave it be.
 */
function SelectionOutline({
	layer,
	viewScale,
}: {
	layer: Layer;
	viewScale: DerivedValue<number>;
}) {
	const halo = useScreenPixels(viewScale, SELECTION_HALO_PX);
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
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
				strokeWidth={halo}
			/>
			<Rect
				rect={box}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
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
	viewScale: DerivedValue<number>;
	live: LiveTransform;
}) {
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
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
			strokeWidth={outline}
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
	viewScale: DerivedValue<number>;
}) {
	const halo = useScreenPixels(viewScale, SELECTION_HALO_PX);
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const shadowOffset = useScreenPixels(viewScale, 1);
	const shadowBlur = useScreenPixels(viewScale, 3);
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
		const scale = viewScale.value;
		const radius = (handleMetrics.size / scale) * 0.6;
		// Pills along the sides, so they read as pulling that side out.
		const long = radius * 3.2;
		const short = radius * 1.5;
		const shown = shownHandles(
			box,
			live.scaleX.value,
			live.scaleY.value,
			scale,
			live.resizeMode.value,
		);
		for (const handle of shown) {
			if (handle === "rotate") {
				const knobY = -h - handleMetrics.knobOffset / scale;
				handles.addCircle(0, knobY, radius);
				lines.moveTo(0, -h);
				lines.lineTo(0, knobY + radius);
				continue;
			}
			const sides = handleSides(handle);
			const x = sides.x * w;
			const y = sides.y * h;
			// A corner, or a line's end, which moves every way.
			if (
				(sides.x !== 0 && sides.y !== 0) ||
				live.resizeMode.value === "endpoints"
			) {
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

	return (
		<Group transform={transform}>
			<Path
				path={lines}
				color={SELECTION_HALO}
				style="stroke"
				strokeWidth={halo}
			/>
			<Path
				path={lines}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
			<Path path={handles} color="#FFFFFF">
				<Shadow
					dx={0}
					dy={shadowOffset}
					blur={shadowBlur}
					color="rgba(0, 0, 0, 0.4)"
				/>
			</Path>
			<Path
				path={handles}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
		</Group>
	);
}
