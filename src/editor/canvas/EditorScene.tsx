import {
	Fill,
	Group,
	Path,
	Rect,
	rect,
	Shadow,
	Skia,
} from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { brushPaint, strokePath } from "@/layers/DrawingLayerView";
import {
	toInverseTransformList,
	toTransformList,
} from "@/layers/layerTransform";
import type { Brush, EditorDocument, Layer } from "@/model/document";
import { colors } from "@/theme";
import { handleMetrics, handlesVisible } from "../handleMetrics";
import { CanvasBackground, LayerContent } from "../SceneParts";
import type { LiveTransform } from "./liveTransform";

const SELECTION_STROKE_PX = 1.5;
// The canvas's shadow on the well around it, and the hairline at its edge
// that keeps a black canvas visible, in screen pixels.
const SHADOW_OFFSET_PX = 6;
const SHADOW_BLUR_PX = 18;
const EDGE_PX = 1;

/**
 * A stroke being painted: its brush, its points so far in document space,
 * and its id. It's drawn into `targetId`'s drawing, or over everything when
 * it will start a new one. Once the document has it (`landedId`), the scene
 * stops drawing it live in the same update that draws it from the document.
 * Clearing `points` instead would blink: a shared value redraws the canvas
 * before the canvas's own renderer has the new document.
 */
export type LiveStroke = {
	brush: Brush;
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
	// An image layer's file couldn't be read or decoded. Must be stable.
	onImageError: (error: unknown) => void;
};

/**
 * The editor's counterpart to `ExportScene`: draws every layer in document
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
							<LayerContent
								layer={layer}
								stroke={
									stroke?.targetId === layer.id && (
										<Group transform={toInverseTransformList(layer.transform)}>
											<LivePath key={stroke.landedId} stroke={stroke} />
										</Group>
									)
								}
								onImageError={onImageError}
							/>
						</LiveLayer>
					</Group>
				),
			)}
			{/* An eraser has nothing to erase until there's a drawing. */}
			{stroke?.targetId === null && stroke.brush.type === "pen" && (
				<LivePath key={stroke.landedId} stroke={stroke} />
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
			<CenterGuides document={document} viewScale={viewScale} live={live} />
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
			scaleX: active ? live.scale.value : t.scaleX,
			scaleY: active ? live.scale.value : t.scaleY,
		});
	}, [layer.id, layer.transform]);

	return <Group transform={transform}>{children}</Group>;
}

/**
 * A stroke as it's being painted, in document space. Keyed by `landedId`, so
 * a landed stroke gives way to the document's copy in one update.
 */
function LivePath({ stroke }: { stroke: LiveStroke }) {
	const { points, id, landedId } = stroke;
	const path = useDerivedValue(() =>
		strokePath(id.value > landedId ? points.value : []),
	);
	return <Path path={path} {...brushPaint(stroke.brush)} />;
}

/** The document's center lines that the dragged layer has snapped onto. */
function CenterGuides({
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
		if (live.centeredX.value) {
			builder.moveTo(width / 2, 0);
			builder.lineTo(width / 2, height);
		}
		if (live.centeredY.value) {
			builder.moveTo(0, height / 2);
			builder.lineTo(width, height / 2);
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
 * handles, drawn from the live values so they follow gestures. The group
 * translates and rotates with the layer but doesn't scale: the scale moves
 * the corners instead, so handles stay the same size on screen.
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
	// squares and knob as another.
	const shapes = useDerivedValue(() => {
		const lines = Skia.PathBuilder.Make();
		const handles = Skia.PathBuilder.Make();
		const box = {
			halfWidth: live.halfWidth.value,
			halfHeight: live.halfHeight.value,
		};
		const w = box.halfWidth * live.scale.value;
		const h = box.halfHeight * live.scale.value;
		lines.addRect(Skia.XYWHRect(-w, -h, w * 2, h * 2));
		if (!handlesVisible(box, live.scale.value, viewScale)) {
			return { lines: lines.build(), handles: handles.build() };
		}

		const size = handleMetrics.size / viewScale;
		const knobY = -h - handleMetrics.knobOffset / viewScale;
		const knobRadius = size * 0.6;
		for (const [x, y] of [
			[-w, -h],
			[w, -h],
			[w, h],
			[-w, h],
		]) {
			handles.addRect(Skia.XYWHRect(x - size / 2, y - size / 2, size, size));
		}
		handles.addCircle(0, knobY, knobRadius);
		lines.moveTo(0, -h);
		lines.lineTo(0, knobY + knobRadius);
		return { lines: lines.build(), handles: handles.build() };
	}, [viewScale]);
	const lines = useDerivedValue(() => shapes.value.lines);
	const handles = useDerivedValue(() => shapes.value.handles);

	const strokeWidth = SELECTION_STROKE_PX / viewScale;
	return (
		<Group transform={transform}>
			<Path
				path={lines}
				color={colors.accent}
				style="stroke"
				strokeWidth={strokeWidth}
			/>
			<Path path={handles} color="#FFFFFF" />
			<Path
				path={handles}
				color={colors.accent}
				style="stroke"
				strokeWidth={strokeWidth}
			/>
		</Group>
	);
}
