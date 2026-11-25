import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useHoverGesture } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { type CanvasCursor, cursorForHandle } from "./canvasCursor";
import type { CanvasLookups } from "./canvasTool";
import { hitsAnyLayer, type LayerTarget } from "./hitTest";
import type { ViewZoom } from "./viewport";

/**
 * What a press at the pointer would do: grab a handle, move a layer, move
 * the view, or nothing. The cursor changes only when that does, not on every
 * pointer move. With a mouse, it shows that on the canvas.
 * `movesSelectionAt`, when given, says where a drag moves the selection:
 * where a drag would otherwise draw a box or a stroke, or move the view or
 * another layer.
 */
export function useCanvasCursor({
	scale,
	lookups,
	selectionRotation,
	selectedLayerIds,
	dragsSelection,
	movesSelectionAt,
	targets,
	zoom,
}: {
	scale: number;
	lookups: CanvasLookups;
	selectionRotation: number | null;
	selectedLayerIds: readonly string[];
	dragsSelection: boolean;
	movesSelectionAt: ((screenX: number, screenY: number) => boolean) | null;
	targets: readonly LayerTarget[];
	zoom: ViewZoom | null;
}) {
	const [cursor, setCursor] = useState<CanvasCursor>("default");
	const handleHover = useCallback(
		(screenX: number, screenY: number) => {
			if (scale === 0) return;
			const handle = lookups.handleAt(screenX, screenY);
			if (handle && selectionRotation !== null) {
				setCursor(cursorForHandle(handle, selectionRotation));
				return;
			}
			if (dragsSelection) {
				let onSelection: boolean;
				if (movesSelectionAt) {
					onSelection = movesSelectionAt(screenX, screenY);
				} else {
					const hit = lookups.layerAt(screenX, screenY);
					onSelection = hit !== null && selectedLayerIds.includes(hit);
				}
				setCursor(onSelection ? "move" : "crosshair");
				return;
			}
			if (movesSelectionAt?.(screenX, screenY)) {
				setCursor("move");
				return;
			}
			if (zoom) {
				const point = lookups.toDocument(screenX, screenY);
				const onSelection =
					selectedLayerIds.length > 0 &&
					hitsAnyLayer(targets, selectedLayerIds, point);
				setCursor(onSelection ? "move" : "grab");
				return;
			}
			setCursor(
				lookups.layerAt(screenX, screenY) === null ? "default" : "move",
			);
		},
		[
			dragsSelection,
			lookups,
			movesSelectionAt,
			scale,
			selectedLayerIds,
			selectionRotation,
			targets,
			zoom,
		],
	);
	const handleHoverEnd = useCallback(() => setCursor("default"), []);
	return { cursor, setCursor, handleHover, handleHoverEnd };
}

/**
 * Where a brush's size ring is drawn on web: the pointer over the canvas, in
 * the canvas view's pixels, while a mouse hovers there (`shown`). It follows
 * the pointer whatever the tool, since a hover begins only as the pointer
 * enters: the Eraser opened from its key, over the canvas, still shows its
 * ring. The canvas draws it only for the Eraser and Pen, and hides it
 * during a drag.
 */
export function useBrushRing() {
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const shown = useSharedValue(false);
	const hover = useHoverGesture({
		enabled: Platform.OS === "web",
		onBegin: (event) => {
			x.value = event.x;
			y.value = event.y;
			shown.value = true;
		},
		onUpdate: (event) => {
			x.value = event.x;
			y.value = event.y;
			shown.value = true;
		},
		onFinalize: () => {
			shown.value = false;
		},
	});
	return { hover, x, y, shown };
}
