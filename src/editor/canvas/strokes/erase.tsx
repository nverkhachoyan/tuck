import { type ReactNode, useState } from "react";
import {
	type DerivedValue,
	type SharedValue,
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { Circle, Group } from "react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { BrushStroke } from "../../layers/drawing/DrawingLayerView";
import type { DrawingLayer } from "../../layers/drawing/drawing";
import { LayerContent } from "../../layers/LayerContent";
import { toInverseTransformList } from "../../layers/layerTransform";
import type { ShapeLayer } from "../../layers/shape/shape";
import { type CanvasTool, strokeReaches } from "../canvasTool";
import { LiveShape } from "../LiveLayerContent";
import type { LiveTransform } from "../liveTransform";
import {
	DIMMED_OPACITY,
	type LiveStroke,
	type StrokeKind,
} from "./strokeTypes";

type EraseTool = Extract<CanvasTool, { type: "erase" }>;

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

const ERASER_RING_PX = 1.5;

export function EraserRing({
	tool,
	ring,
	scale,
	stroke,
	color,
}: {
	tool: EraseTool;
	ring: {
		x: DerivedValue<number>;
		y: DerivedValue<number>;
		shown: SharedValue<boolean>;
	};
	scale: DerivedValue<number>;
	stroke: LiveStroke | null;
	color: string;
}) {
	const eraserRadius = tool.mode === "eraser" ? tool.width / 2 : 0;
	const ringRadius = useDerivedValue(
		() => eraserRadius * scale.value,
		[eraserRadius, scale],
	);
	const strokeId = stroke?.id ?? null;
	const strokePoints = stroke?.points ?? null;
	const landedId = stroke?.landedId ?? 0;
	const ringShown = ring.shown;
	const ringOpacity = useDerivedValue(() => {
		const dragging =
			strokeId !== null &&
			strokePoints !== null &&
			strokeId.value > landedId &&
			strokePoints.value.length > 0;
		return ringShown.value && !dragging && eraserRadius > 0 ? 1 : 0;
	}, [strokeId, strokePoints, landedId, eraserRadius, ringShown]);

	if (eraserRadius <= 0) return null;
	return (
		<Circle
			cx={ring.x}
			cy={ring.y}
			r={ringRadius}
			opacity={ringOpacity}
			style="stroke"
			strokeWidth={ERASER_RING_PX}
			color={color}
		/>
	);
}

export const eraseStrokeKind: StrokeKind<EraseTool> = {
	reaches: (tool, layer) => strokeReaches(tool, layer),
	startsLayer: () => false,
	renderOverlay: ({ tool, ring, scale, stroke, selectionColor }) => (
		<EraserRing
			tool={tool}
			ring={ring}
			scale={scale}
			stroke={stroke}
			color={selectionColor}
		/>
	),
	renderInLayer: ({ layer, stroke, live, dimmed, onImageError }) => {
		if (layer.type === "shape") {
			// A dimmed shape is out of the Eraser's reach, so it never crosses.
			if (dimmed) {
				return <LiveShape layer={layer} live={live} opacity={DIMMED_OPACITY} />;
			}
			return stroke.crossed ? (
				<CrossedShape layer={layer} live={live} stroke={stroke} />
			) : (
				<LiveShape layer={layer} live={live} />
			);
		}
		if (layer.type === "drawing" && stroke.crossedStrokes) {
			return (
				<StrokeErasedDrawing
					layer={layer}
					stroke={stroke}
					opacity={dimmed ? DIMMED_OPACITY : undefined}
					onImageError={onImageError}
				/>
			);
		}
		if (layer.type === "drawing" && stroke.nearDrawings) {
			return (
				<ErasedDrawing
					layer={layer}
					stroke={stroke}
					opacity={dimmed ? DIMMED_OPACITY : undefined}
					onImageError={onImageError}
				/>
			);
		}
		return null;
	},
};
