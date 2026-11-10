import type { ReactNode } from "react";
import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import { Group } from "react-native-skia";
import type { ColorMatrix } from "../layers/image/adjustments";
import { LayerContent } from "../layers/LayerContent";
import type { Layer } from "../layers/layer";
import { toTransformList } from "../layers/layerTransform";
import type { CanvasTool } from "./canvasTool";
import { LiveRedaction, LiveShape } from "./LiveLayerContent";
import type { LiveTransform } from "./liveTransform";
import { cutStrokeKind } from "./strokes/cut";
import { drawStrokeKind } from "./strokes/draw";
import { eraseStrokeKind } from "./strokes/erase";
import { redactBoxStrokeKind } from "./strokes/redactBox";
import { redactBrushStrokeKind } from "./strokes/redactBrush";
import { shapeStrokeKind } from "./strokes/shape";
import {
	DIMMED_OPACITY,
	type HoveredStroke,
	type LiveStroke,
	type StrokeKind,
} from "./strokes/strokeTypes";

export type { HoveredStroke, LiveStroke };

const NOOP_STROKE: StrokeKind = {
	reaches: () => false,
	startsLayer: () => false,
};

/** Each canvas tool kind's live stroke behavior, keyed by `tool.type`. */
export const STROKE_KINDS: {
	[K in CanvasTool["type"]]: StrokeKind<Extract<CanvasTool, { type: K }>>;
} = {
	draw: drawStrokeKind,
	erase: eraseStrokeKind,
	redactBrush: redactBrushStrokeKind,
	redactBox: redactBoxStrokeKind,
	drawShape: shapeStrokeKind,
	cutBrush: cutStrokeKind,
	pickColor: NOOP_STROKE,
	pickSubject: NOOP_STROKE,
};

export function strokeKindOf<T extends CanvasTool>(tool: T): StrokeKind<T> {
	return STROKE_KINDS[tool.type] as unknown as StrokeKind<T>;
}

/**
 * One layer in the scene, positioned by its transform (or the gesture's live
 * values while it's moving), showing `draft` while a tool edits it in place,
 * joined by `stroke` when the stroke reaches it, and otherwise drawn from
 * the document.
 */
export function SceneLayer({
	layer,
	uri,
	draft,
	stroke,
	live,
	matrix,
	selectionColor,
	dimmed = false,
	onImageError,
}: {
	layer: Layer;
	uri?: string;
	draft: ReactNode;
	stroke: LiveStroke | null;
	live: LiveTransform;
	matrix?: DerivedValue<ColorMatrix>;
	selectionColor: string | undefined;
	dimmed?: boolean;
	onImageError: (error: unknown) => void;
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

	const activeStroke =
		stroke &&
		(stroke.reaches(layer) || (layer.type === "shape" && stroke.crossed))
			? stroke
			: null;
	const inLayer =
		!draft &&
		activeStroke &&
		strokeKindOf(activeStroke.tool).renderInLayer?.({
			layer,
			uri,
			stroke: activeStroke,
			tool: activeStroke.tool,
			live,
			matrix,
			selectionColor,
			dimmed,
			onImageError,
		});

	return (
		<Group transform={transform}>
			{draft ??
				inLayer ??
				(layer.type === "redaction" ? (
					<LiveRedaction
						layer={layer}
						live={live}
						onImageError={onImageError}
					/>
				) : layer.type === "shape" ? (
					<LiveShape
						layer={layer}
						live={live}
						opacity={dimmed ? DIMMED_OPACITY : 1}
					/>
				) : (
					<LayerContent
						layer={layer}
						uri={uri}
						matrix={matrix}
						selectionColor={selectionColor}
						opacity={dimmed ? DIMMED_OPACITY : undefined}
						onImageError={onImageError}
					/>
				))}
		</Group>
	);
}

/** A stroke that will start a new layer, over everything as it's painted. */
export function NewLayerStroke({
	stroke,
	viewScale,
}: {
	stroke: LiveStroke;
	viewScale: DerivedValue<number>;
}) {
	return (
		strokeKindOf(stroke.tool).renderNewLayer?.(
			stroke,
			stroke.tool,
			viewScale,
		) ?? null
	);
}
