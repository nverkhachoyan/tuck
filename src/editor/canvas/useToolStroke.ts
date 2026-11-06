import { useCallback, useMemo, useState } from "react";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import type { EditorDocument } from "../document/document";
import type { Point, Size } from "../document/geometry";
import { strokePath } from "../layers/drawing/DrawingLayerView";
import type { Layer } from "../layers/layer";
import { hitTestDrawing, segmentsNear } from "../layers/strokes";
import {
	type CanvasLookups,
	type CanvasTool,
	canAddTo,
	strokeReaches,
	type ToolStroke,
} from "./canvasTool";
import { findLayerAt, type LayerTarget } from "./hitTest";
import type { LiveStroke } from "./LiveStrokeOverlay";
import { strokeIntent } from "./strokeIntent";
import { usePaintGesture } from "./usePaintGesture";
import { useShiftHeld } from "./useShiftHeld";
import type { DocumentViewport } from "./viewport";

/**
 * A tool's stroke: the points drawn live, the gesture that gathers them, and
 * what a finished stroke asks the editor to do. With a tool, one gesture
 * paints into the selected layer if the tool can add to it, or drags out a
 * shape or a redaction's box. Picking a color, where the finger lifts is the
 * point. The Eraser reaches every drawing it can change at once, and notes
 * each shape it crosses as it goes (`crossed`), on the UI thread.
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
	onToolStroke,
	onSelectLayer,
	onToolInteractionEnd,
	enabled = true,
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
	onToolStroke?: (stroke: ToolStroke) => void;
	onSelectLayer?: (id: string | null) => void;
	onToolInteractionEnd?: () => void;
	enabled?: boolean;
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
				case "finish":
					onToolStroke?.(intent.stroke);
					break;
				case "tapAway":
					lookups.tapAway(intent.point);
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
			onToolStroke,
			onToolInteractionEnd,
			onSelectLayer,
			lookups,
			documentSize,
			scale,
			targets,
			document,
		],
	);
	const shiftHeld = useShiftHeld();
	const erasing = tool?.type === "erase";
	const crossed = useSharedValue<string[]>([]);
	// Shapes the Eraser removes: unlocked ones (a locked layer's target has
	// no strokes), and none when it's scoped to one drawing.
	const crossable = useMemo(
		() =>
			tool?.type === "erase" && tool.scope === null
				? targets.flatMap((target) => {
						const layer = document.layers.find((each) => each.id === target.id);
						return layer?.type === "shape" && target.strokes
							? [{ ...target, strokes: target.strokes }]
							: [];
					})
				: [],
		[tool, targets, document],
	);
	const eraserWidth = tool?.type === "erase" ? tool.width : 0;
	// The same test as `erasesShape`, on each piece of line as it's added.
	const onSegment = useMemo(() => {
		if (crossable.length === 0) return null;
		return (points: number[]) => {
			"worklet";
			if (points.length === 0) {
				crossed.value = [];
				return;
			}
			const hits: string[] = [];
			for (const target of crossable) {
				if (crossed.value.includes(target.id)) continue;
				const reach = eraserWidth / 2 / target.transform.scaleX;
				const outline = { strokes: target.strokes };
				const near = (point: Point) => {
					"worklet";
					return hitTestDrawing(outline, point, reach);
				};
				if (segmentsNear(points, target.transform, reach, near)) {
					hits.push(target.id);
				}
			}
			if (hits.length > 0) crossed.value = [...crossed.value, ...hits];
		};
	}, [crossable, crossed, eraserWidth]);
	const paintGesture = usePaintGesture({
		viewport,
		points: strokePoints,
		strokeId,
		onStroke: handleStroke,
		standsAside,
		straighten:
			tool?.type === "draw" &&
			tool.brush.type === "pen" &&
			tool.brush.tip === "marker",
		shiftHeld,
		onSegment,
		enabled: enabled && Boolean(tool),
	});
	// Built once a frame for every drawing the Eraser reaches.
	const erasePath = useDerivedValue(
		() =>
			strokePath(
				erasing && strokeId.value > landedStrokeId ? strokePoints.value : [],
			),
		[erasing, landedStrokeId],
	);
	const liveStroke = useMemo<LiveStroke | null>(() => {
		if (!tool) return null;
		const selectedId =
			selectedLayer && canAddTo(tool, selectedLayer) ? selectedLayer.id : null;
		const reaches =
			tool.type === "erase"
				? (layer: Layer) => strokeReaches(tool, layer)
				: tool.type === "cutBrush"
					? (layer: Layer) => layer.id === tool.layerId
					: (layer: Layer) => layer.id === selectedId;
		return {
			tool,
			points: strokePoints,
			id: strokeId,
			landedId: landedStrokeId,
			reaches,
			startsLayer:
				tool.type !== "erase" &&
				tool.type !== "cutBrush" &&
				selectedId === null,
			erasePath: tool.type === "erase" ? erasePath : null,
			crossed: tool.type === "erase" ? crossed : null,
		};
	}, [
		tool,
		strokePoints,
		strokeId,
		landedStrokeId,
		selectedLayer,
		erasePath,
		crossed,
	]);
	return { paintGesture, liveStroke };
}
