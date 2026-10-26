import { useCallback } from "react";
import type { EditorDocument } from "@/model/document";
import { hitTestBox, type Point, type Size } from "@/model/geometry";
import type { CanvasLookups } from "../../canvas/canvasTool";
import { findLayerAt, type LayerTarget } from "../../canvas/hitTest";
import { layerBounds } from "../../canvas/layerBounds";
import { insideDocument } from "../../canvas/strokeIntent";
import { useCanvasTap } from "../../canvas/useCanvasTap";
import type { CanvasInput } from "../../canvasInputFor";
import { detectionAt } from "./findResults";

/**
 * A tap while finding. One on a found region toggles it. A miss on the
 * searched image, as by a face, keeps finding, and a second one zooms (see
 * `tapOnNothing`). Where the image is locked, it has no hit box, and shows
 * only inside the document. A tap off the image puts the tool down.
 */
export function useFindTap({
	find,
	scale,
	lookups,
	targets,
	document,
	documentSize,
	tapOnNothing,
}: {
	find: Extract<CanvasInput, { type: "find" }> | null;
	scale: number;
	lookups: CanvasLookups;
	targets: readonly LayerTarget[];
	document: EditorDocument;
	documentSize: Size;
	tapOnNothing: (point: Point | null) => void;
}) {
	const handleDetectionTap = useCallback(
		(screenX: number, screenY: number) => {
			if (!find || scale === 0) return;
			const point = lookups.toDocument(screenX, screenY);
			const hit = detectionAt(find.regions, point, 10 / scale);
			if (hit) {
				tapOnNothing(null);
				find.onToggle(hit.sourceIndex);
				return;
			}
			const under = findLayerAt(targets, point)?.id ?? null;
			const image = document.layers.find((layer) => layer.id === find.imageId);
			const onImage =
				under === null
					? image !== undefined &&
						insideDocument(documentSize, point) &&
						hitTestBox(image.transform, layerBounds(image), point)
					: under === find.imageId;
			if (onImage) tapOnNothing({ x: screenX, y: screenY });
			else lookups.tapAway(point);
		},
		[find, scale, lookups, targets, document, documentSize, tapOnNothing],
	);
	return useCanvasTap(handleDetectionTap);
}
