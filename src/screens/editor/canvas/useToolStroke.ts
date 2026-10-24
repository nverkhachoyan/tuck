import { useCallback, useMemo, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { EditorDocument } from "@/model/document";
import type { Point, Rect, Size } from "@/model/geometry";
import type { Layer } from "@/model/layers/layer";
import type { ShapePlacement } from "@/model/layers/shape";
import { type CanvasTool, canAddTo } from "./canvasInput";
import { findLayerAt, type LayerTarget } from "./hitTest";
import type { LiveStroke } from "./LiveStrokeOverlay";
import { strokeIntent } from "./strokeIntent";
import type { CanvasLookups } from "./useCanvasTap";
import { usePaintGesture } from "./usePaintGesture";
import type { DocumentViewport } from "./viewport";

/**
 * A tool's stroke: the points drawn live, the gesture that gathers them, and
 * what a finished stroke asks the editor to do. With a tool, one gesture
 * paints into the selected layer if the tool can add to it, or drags out a
 * shape or a redaction's box. Picking a color, where the finger lifts is the
 * point.
 *
 * The last stroke handed to the document changes in the same render as the
 * document, or the one after, so the scene stops drawing the stroke live
 * only once it draws it from the document.
 */
export function useToolStroke({
	tool,
	viewport,
	scale,
	documentSize,
	document,
	targets,
	selectedLayer,
	lookups,
	standsAside,
	onPaintStroke,
	onDrawBox,
	onDrawShape,
	onPickPoint,
	onSelectLayer,
	onToolInteractionEnd,
}: {
	tool: CanvasTool | null;
	viewport: DocumentViewport;
	scale: number;
	documentSize: Size;
	document: EditorDocument;
	targets: readonly LayerTarget[];
	selectedLayer: Layer | undefined;
	lookups: CanvasLookups;
	standsAside?: ((screenX: number, screenY: number) => boolean) | null;
	onPaintStroke?: (points: number[]) => void;
	onDrawBox?: (rect: Rect) => void;
	onDrawShape?: (placement: ShapePlacement) => void;
	onPickPoint?: (point: Point) => void;
	onSelectLayer?: (id: string | null) => void;
	onToolInteractionEnd?: () => void;
}) {
	const strokePoints = useSharedValue<number[]>([]);
	const strokeId = useSharedValue(0);
	const [landedStrokeId, setLandedStrokeId] = useState(0);
	const handleStroke = useCallback(
		(points: number[], id: number) => {
			if (!tool || points.length < 2) return;
			setLandedStrokeId(id);
			onToolInteractionEnd?.();
			const intent = strokeIntent(tool, points, scale, documentSize);
			switch (intent.type) {
				case "pick":
					onPickPoint?.(intent.point);
					break;
				case "tapAway":
					lookups.tapAway(intent.point);
					break;
				case "paint":
					onPaintStroke?.(points);
					break;
				case "box":
					onDrawBox?.(intent.rect);
					break;
				case "shape":
					onDrawShape?.(intent.placement);
					break;
				case "select": {
					const hit = findLayerAt(targets, intent.point);
					const tapped = document.layers.find((layer) => layer.id === hit?.id);
					onSelectLayer?.(tapped?.type === intent.kind ? tapped.id : null);
					break;
				}
				case "none":
					break;
			}
		},
		[
			tool,
			onPaintStroke,
			onDrawBox,
			onDrawShape,
			onPickPoint,
			onToolInteractionEnd,
			onSelectLayer,
			lookups,
			documentSize,
			scale,
			targets,
			document,
		],
	);
	const paintGesture = usePaintGesture({
		viewport,
		points: strokePoints,
		strokeId,
		onStroke: handleStroke,
		standsAside,
	});
	const liveStroke = useMemo<LiveStroke | null>(
		() =>
			tool && {
				tool,
				points: strokePoints,
				id: strokeId,
				landedId: landedStrokeId,
				targetId:
					tool.type === "cutBrush"
						? tool.layerId
						: selectedLayer && canAddTo(tool, selectedLayer)
							? selectedLayer.id
							: null,
			},
		[tool, strokePoints, strokeId, landedStrokeId, selectedLayer],
	);
	return { paintGesture, liveStroke };
}
