import { useCallback, useMemo, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { EditorDocument } from "../document/document";
import type { Size } from "../document/geometry";
import type { Layer } from "../layers/layer";
import {
	type CanvasLookups,
	type CanvasTool,
	canAddTo,
	type ToolStroke,
} from "./canvasTool";
import { findLayerAt, type LayerTarget } from "./hitTest";
import { type LiveStroke, strokeKindOf } from "./SceneLayer";
import { strokeIntent } from "./strokeIntent";
import { type CanvasHover, useEraseTracking } from "./strokes/useEraseTracking";
import { usePaintGesture } from "./usePaintGesture";
import { useShiftHeld } from "./useShiftHeld";
import type { DocumentViewport } from "./viewport";

export type { CanvasHover };

/**
 * A tool's stroke: the points drawn live, the gesture that gathers them, and
 * what a finished stroke asks the editor to do. With a tool, one gesture
 * paints into the selected layer if the tool can add to it, or drags out a
 * shape or a redaction's box. Picking a color, where the finger lifts is the
 * point. The Eraser's UI-thread tracking lives in `useEraseTracking`.
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
		(points: number[], id: number, startedAt: number, endedAt: number) => {
			if (!tool || points.length < 2) return;
			setLandedStrokeId(id);
			onToolInteractionEnd?.();
			const intent = strokeIntent(tool, points, scale, documentSize, {
				startedAt,
				endedAt,
			});
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
	const { onSegment, fields: eraseFields } = useEraseTracking({
		tool,
		viewport,
		scale,
		document,
		targets,
		strokePoints,
		strokeId,
		landedStrokeId,
		hover,
	});
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
	const liveStroke = useMemo<LiveStroke | null>(() => {
		if (!tool) return null;
		const selectedId =
			selectedLayer && canAddTo(tool, selectedLayer) ? selectedLayer.id : null;
		const kind = strokeKindOf(tool);
		return {
			tool,
			points: strokePoints,
			id: strokeId,
			landedId: landedStrokeId,
			reaches: (layer: Layer) => kind.reaches(tool, layer, selectedId),
			startsLayer: kind.startsLayer(selectedId),
			...eraseFields,
		};
	}, [
		tool,
		strokePoints,
		strokeId,
		landedStrokeId,
		selectedLayer,
		eraseFields,
	]);
	return { paintGesture, liveStroke };
}
