import { useCallback } from "react";
import type { EditorDocument } from "@/model/document";
import { hitTestBox, type Point, type Size } from "@/model/geometry";
import type { CanvasInput, CanvasLookups } from "./canvasInput";
import { detectionAt, findLayerAt, type LayerTarget } from "./hitTest";
import { layerBounds } from "./layerBounds";
import type { DetectionOverlayRegion } from "./SelectionOverlay";
import { insideDocument } from "./strokeIntent";
import { useCanvasTap } from "./useCanvasTap";

/**
 * A tap while finding. One on a found region toggles it. A miss on the
 * searched image, as by a face, keeps finding, and a second one zooms (see
 * `tapOnNothing`). Where the image is locked, it has no hit box, and shows
 * only inside the document. A tap off the image puts the tool down.
 */
export function useFindTap({
	input,
	scale,
	lookups,
	detections,
	targets,
	document,
	documentSize,
	tapOnNothing,
}: {
	input: CanvasInput;
	scale: number;
	lookups: CanvasLookups;
	detections: readonly DetectionOverlayRegion[];
	targets: readonly LayerTarget[];
	document: EditorDocument;
	documentSize: Size;
	tapOnNothing: (point: Point | null) => void;
}) {
	const handleDetectionTap = useCallback(
		(screenX: number, screenY: number) => {
			if (input.type !== "find" || scale === 0) return;
			const point = lookups.toDocument(screenX, screenY);
			const hit = detectionAt(detections, point, 10 / scale);
			if (hit) {
				tapOnNothing(null);
				input.onToggle(hit.sourceIndex);
				return;
			}
			const under = findLayerAt(targets, point)?.id ?? null;
			const image = document.layers.find((layer) => layer.id === input.imageId);
			const onImage =
				under === null
					? image !== undefined &&
						insideDocument(documentSize, point) &&
						hitTestBox(image.transform, layerBounds(image), point)
					: under === input.imageId;
			if (onImage) tapOnNothing({ x: screenX, y: screenY });
			else lookups.tapAway(point);
		},
		[
			input,
			detections,
			scale,
			lookups,
			targets,
			document,
			documentSize,
			tapOnNothing,
		],
	);
	return useCanvasTap(handleDetectionTap);
}
