import { useMemo } from "react";
import { Platform } from "react-native";
import {
	type SharedValue,
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/platform/haptics";
import type { EditorDocument } from "../../document/document";
import type { Point } from "../../document/geometry";
import { strokePath } from "../../layers/drawing/DrawingLayerView";
import { visibleReach } from "../../layers/drawing/drawing";
import {
	hitTestDrawing,
	segmentsNear,
	strokeBoxes,
	strokesHitBy,
} from "../../layers/strokes";
import { type CanvasTool, strokeReaches } from "../canvasTool";
import { HIT_PADDING_PX, type LayerTarget } from "../hitTest";
import { type DocumentViewport, viewPointToDocument } from "../viewport";
import type { HoveredStroke, LiveStroke } from "./strokeTypes";

/** Where a mouse hovers over the canvas, in view points, while `shown`. */
export type CanvasHover = {
	x: SharedValue<number>;
	y: SharedValue<number>;
	shown: SharedValue<boolean>;
};

const tick = Platform.OS !== "web";

/**
 * The Eraser's UI-thread tracking while a stroke is painted or a mouse
 * hovers over the canvas:
 * - `nearDrawings`: drawings the Eraser's line has come near, so only those
 *   save a layer for the live erase path.
 * - `crossed`: shapes the Eraser has crossed, dimmed until it lifts.
 * - `crossedStrokes`: strokes the Stroke eraser has touched, with a haptic
 *   tick off web.
 * - `hoveredStroke`: on web, the stroke under `hover` before a press.
 * - `erasePath`: the Eraser's line, built once a frame for every drawing it
 *   reaches.
 */
export function useEraseTracking({
	tool,
	viewport,
	scale,
	document,
	targets,
	strokePoints,
	strokeId,
	landedStrokeId,
	hover,
}: {
	tool: CanvasTool | null;
	viewport: DocumentViewport;
	scale: number;
	document: EditorDocument;
	targets: readonly LayerTarget[];
	strokePoints: SharedValue<number[]>;
	strokeId: SharedValue<number>;
	landedStrokeId: number;
	hover: CanvasHover | null;
}) {
	const erasing = tool?.type === "erase" && tool.mode === "eraser";
	const strokeErasing = tool?.type === "erase" && tool.mode === "stroke";
	const crossed = useSharedValue<string[]>([]);
	const crossedStrokes = useSharedValue<Record<string, number[]>>({});
	const nearDrawings = useSharedValue<Record<string, boolean>>({});
	// The drawings the Eraser can join, with how far their ink reaches past
	// their box's middle, in their own units.
	const eraseTargets = useMemo(
		() =>
			tool?.type === "erase" && tool.mode === "eraser"
				? targets.flatMap((target) => {
						const layer = document.layers.find((each) => each.id === target.id);
						if (layer?.type !== "drawing" || !strokeReaches(tool, layer)) {
							return [];
						}
						let reach = 0;
						for (const stroke of layer.strokes) {
							if (stroke.type === "pen") {
								reach = Math.max(reach, visibleReach(stroke));
							}
						}
						return [
							{
								id: target.id,
								transform: target.transform,
								box: target.box,
								reach,
							},
						];
					})
				: [],
		[tool, targets, document],
	);
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
	// target has no strokes), with each stroke's box.
	const strokeTargets = useMemo(
		() =>
			tool?.type === "erase" && tool.mode === "stroke"
				? targets.flatMap((target) => {
						const layer = document.layers.find((each) => each.id === target.id);
						return layer && strokeReaches(tool, layer) && target.strokes
							? [
									{
										...target,
										strokes: target.strokes,
										boxes: strokeBoxes(target.strokes),
									},
								]
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
		if (
			crossable.length === 0 &&
			strokeTargets.length === 0 &&
			eraseTargets.length === 0
		) {
			return null;
		}
		return (points: number[]) => {
			"worklet";
			if (points.length === 0) {
				crossed.value = [];
				crossedStrokes.value = {};
				nearDrawings.value = {};
				return;
			}
			// A drawing joins the live eraser a width ahead of it, so it
			// clears from the first frame the line reaches ink.
			let near: Record<string, boolean> | null = null;
			for (const target of eraseTargets) {
				if (nearDrawings.value[target.id] || near?.[target.id]) continue;
				const ahead =
					(eraserWidth * 1.5) / target.transform.scaleX + target.reach;
				const { halfWidth, halfHeight } = target.box;
				const inside = (point: Point) => {
					"worklet";
					return (
						Math.abs(point.x) <= halfWidth + ahead &&
						Math.abs(point.y) <= halfHeight + ahead
					);
				};
				if (segmentsNear(points, target.transform, ahead, inside)) {
					near = { ...(near ?? {}), [target.id]: true };
				}
			}
			if (near) nearDrawings.value = { ...nearDrawings.value, ...near };
			let touched = false;
			const next = { ...crossedStrokes.value };
			for (const target of strokeTargets) {
				const before = next[target.id] ?? [];
				const fresh = strokesHitBy(
					target.strokes,
					target.transform,
					points,
					touchReach,
					target.boxes,
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
		eraseTargets,
		nearDrawings,
	]);
	// On web, the topmost stroke a click would take, while nothing's down.
	// Written only when that stroke changes, not on every mouse move, since
	// each of the drawing's strokes reads it to dim itself.
	const hoverX = hover?.x ?? null;
	const hoverY = hover?.y ?? null;
	const hoverShown = hover?.shown ?? null;
	const hoveredStroke = useSharedValue<HoveredStroke | null>(null);
	useAnimatedReaction(
		(): HoveredStroke | null => {
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
					target.boxes,
				);
				if (hits.length > 0) {
					return { id: target.id, index: hits[hits.length - 1] };
				}
			}
			return null;
		},
		(now) => {
			const before = hoveredStroke.value;
			if (now?.id !== before?.id || now?.index !== before?.index) {
				hoveredStroke.value = now;
			}
		},
		[
			strokeErasing,
			hoverX,
			hoverY,
			hoverShown,
			landedStrokeId,
			viewport,
			strokeTargets,
			touchReach,
		],
	);
	// Built once a frame for every drawing the Eraser reaches. It stays once
	// the stroke lands: emptying it would redraw the canvas before the canvas
	// has the document that erases the same ink, and each drawing drops the
	// line itself, in a render (`ErasedDrawing`).
	const erasePath = useDerivedValue(
		() => strokePath(erasing ? strokePoints.value : []),
		[erasing],
	);

	const fields = useMemo<
		Pick<
			LiveStroke,
			| "erasePath"
			| "nearDrawings"
			| "crossed"
			| "crossedStrokes"
			| "hoveredStroke"
		>
	>(
		() => ({
			erasePath: erasing ? erasePath : null,
			nearDrawings: erasing ? nearDrawings : null,
			crossed: tool?.type === "erase" ? crossed : null,
			crossedStrokes: strokeErasing ? crossedStrokes : null,
			hoveredStroke: strokeErasing ? hoveredStroke : null,
		}),
		[
			erasing,
			strokeErasing,
			tool?.type,
			erasePath,
			nearDrawings,
			crossed,
			crossedStrokes,
			hoveredStroke,
		],
	);

	return { onSegment, fields };
}
