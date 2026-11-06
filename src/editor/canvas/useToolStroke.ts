import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import {
	type SharedValue,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/platform/haptics";
import type { EditorDocument } from "../document/document";
import type { Point, Size } from "../document/geometry";
import { strokePath } from "../layers/drawing/DrawingLayerView";
import type { Layer } from "../layers/layer";
import { hitTestDrawing, segmentsNear, strokesHitBy } from "../layers/strokes";
import {
	type CanvasLookups,
	type CanvasTool,
	canAddTo,
	strokeReaches,
	type ToolStroke,
} from "./canvasTool";
import { findLayerAt, HIT_PADDING_PX, type LayerTarget } from "./hitTest";
import type { HoveredStroke, LiveStroke } from "./LiveStrokeOverlay";
import { strokeIntent } from "./strokeIntent";
import { usePaintGesture } from "./usePaintGesture";
import { useShiftHeld } from "./useShiftHeld";
import { type DocumentViewport, viewPointToDocument } from "./viewport";

/** Where a mouse hovers over the canvas, in view points, while `shown`. */
export type CanvasHover = {
	x: SharedValue<number>;
	y: SharedValue<number>;
	shown: SharedValue<boolean>;
};

const tick = Platform.OS !== "web";

/**
 * A tool's stroke: the points drawn live, the gesture that gathers them, and
 * what a finished stroke asks the editor to do. With a tool, one gesture
 * paints into the selected layer if the tool can add to it, or drags out a
 * shape or a redaction's box. Picking a color, where the finger lifts is the
 * point. The Eraser reaches every drawing it can change at once, and notes
 * each shape it crosses as it goes (`crossed`), on the UI thread. The
 * Stroke eraser notes each stroke it touches the same way
 * (`crossedStrokes`), with a haptic tick off web, and on web the stroke
 * under a `hover` before any button is down (`hoveredStroke`).
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
	hover = null,
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
	hover?: CanvasHover | null;
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
	const erasing = tool?.type === "erase" && tool.mode === "eraser";
	const strokeErasing = tool?.type === "erase" && tool.mode === "stroke";
	const crossed = useSharedValue<string[]>([]);
	const crossedStrokes = useSharedValue<Record<string, number[]>>({});
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
	// The drawings whose strokes the Stroke eraser takes (a locked layer's
	// target has no strokes).
	const strokeTargets = useMemo(
		() =>
			tool?.type === "erase" && tool.mode === "stroke"
				? targets.flatMap((target) => {
						const layer = document.layers.find((each) => each.id === target.id);
						return layer && strokeReaches(tool, layer) && target.strokes
							? [{ ...target, strokes: target.strokes }]
							: [];
					})
				: [],
		[tool, targets, document],
	);
	// How far a touch reaches, in document units, for the Stroke eraser.
	const touchReach = scale > 0 ? HIT_PADDING_PX / scale : 0;
	const eraserWidth =
		tool?.type === "erase"
			? tool.mode === "stroke"
				? touchReach * 2
				: tool.width
			: 0;
	// The same tests as `erasesShape` and `eraseWholeStrokes`, on each piece
	// of line as it's added.
	const onSegment = useMemo(() => {
		if (crossable.length === 0 && strokeTargets.length === 0) return null;
		return (points: number[]) => {
			"worklet";
			if (points.length === 0) {
				crossed.value = [];
				crossedStrokes.value = {};
				return;
			}
			let touched = false;
			const next = { ...crossedStrokes.value };
			for (const target of strokeTargets) {
				const before = next[target.id] ?? [];
				const fresh = strokesHitBy(
					target.strokes,
					target.transform,
					points,
					touchReach,
				).filter((index) => !before.includes(index));
				if (fresh.length > 0) {
					next[target.id] = [...before, ...fresh];
					touched = true;
				}
			}
			if (touched) {
				crossedStrokes.value = next;
				if (tick) scheduleOnRN(hapticTick);
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
	}, [
		crossable,
		crossed,
		eraserWidth,
		strokeTargets,
		crossedStrokes,
		touchReach,
	]);
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
	// On web, the topmost stroke a click would take, while nothing's down.
	const hoverX = hover?.x ?? null;
	const hoverY = hover?.y ?? null;
	const hoverShown = hover?.shown ?? null;
	const hoveredStroke = useDerivedValue((): HoveredStroke | null => {
		if (!strokeErasing || !hoverX || !hoverY || !hoverShown?.value) {
			return null;
		}
		if (strokeId.value > landedStrokeId && strokePoints.value.length > 0) {
			return null;
		}
		const point = viewPointToDocument(viewport, {
			x: hoverX.value,
			y: hoverY.value,
		});
		for (let i = strokeTargets.length - 1; i >= 0; i--) {
			const target = strokeTargets[i];
			const hits = strokesHitBy(
				target.strokes,
				target.transform,
				[point.x, point.y],
				touchReach,
			);
			if (hits.length > 0) {
				return { id: target.id, index: hits[hits.length - 1] };
			}
		}
		return null;
	}, [
		strokeErasing,
		hoverX,
		hoverY,
		hoverShown,
		landedStrokeId,
		viewport,
		strokeTargets,
		touchReach,
	]);
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
			erasePath:
				tool.type === "erase" && tool.mode === "eraser" ? erasePath : null,
			crossed: tool.type === "erase" ? crossed : null,
			crossedStrokes:
				tool.type === "erase" && tool.mode === "stroke" ? crossedStrokes : null,
			hoveredStroke:
				tool.type === "erase" && tool.mode === "stroke" ? hoveredStroke : null,
		};
	}, [
		tool,
		strokePoints,
		strokeId,
		landedStrokeId,
		selectedLayer,
		erasePath,
		crossed,
		crossedStrokes,
		hoveredStroke,
	]);
	return { paintGesture, liveStroke };
}
