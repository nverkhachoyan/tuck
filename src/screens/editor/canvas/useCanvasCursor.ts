import { useCallback, useState } from "react";
import type { Layer } from "@/model/layers/layer";
import { type CanvasCursor, cursorForHandle } from "./canvasCursor";
import type { CanvasLookups } from "./canvasInput";
import { hitsLayer, type LayerTarget } from "./hitTest";
import type { ViewZoom } from "./viewport";

/**
 * What a press at the pointer would do: grab a handle, move a layer, move
 * the view, or nothing. The cursor changes only when that does, not on every
 * pointer move. With a mouse, it shows that on the canvas.
 */
export function useCanvasCursor({
	scale,
	lookups,
	selectedLayer,
	selectedLayerId,
	dragsSelection,
	targets,
	zoom,
}: {
	scale: number;
	lookups: CanvasLookups;
	selectedLayer: Layer | undefined;
	selectedLayerId: string | null;
	dragsSelection: boolean;
	targets: readonly LayerTarget[];
	zoom: ViewZoom | null;
}) {
	const [cursor, setCursor] = useState<CanvasCursor>("default");
	const handleHover = useCallback(
		(screenX: number, screenY: number) => {
			if (scale === 0) return;
			const handle = lookups.handleAt(screenX, screenY);
			if (handle && selectedLayer) {
				setCursor(cursorForHandle(handle, selectedLayer.transform.rotation));
				return;
			}
			if (dragsSelection) {
				const onSelection =
					selectedLayerId !== null &&
					lookups.layerAt(screenX, screenY) === selectedLayerId;
				setCursor(onSelection ? "move" : "crosshair");
				return;
			}
			if (zoom) {
				const point = lookups.toDocument(screenX, screenY);
				const onSelection =
					selectedLayerId !== null &&
					hitsLayer(targets, selectedLayerId, point);
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
			scale,
			selectedLayer,
			selectedLayerId,
			targets,
			zoom,
		],
	);
	const handleHoverEnd = useCallback(() => setCursor("default"), []);
	return { cursor, setCursor, handleHover, handleHoverEnd };
}
