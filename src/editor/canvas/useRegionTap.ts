import { useCallback } from "react";
import type { EditorDocument } from "../document/document";
import { hitTestBox, type Point, type Size } from "../document/geometry";
import type { CanvasLookups } from "./canvasTool";
import { findLayerAt, type LayerTarget, regionAt } from "./hitTest";
import { layerBounds } from "./layerBounds";
import type { CanvasRegion } from "./RegionOutline";
import { insideDocument } from "./strokeIntent";
import { useCanvasTap } from "./useCanvasTap";

/**
 * A tap with a `regions` input, as while finding. One on a region toggles
 * it. A miss on the regions' image, as by a face, keeps the input, and a
 * second one zooms (see `tapOnNothing`). Where the image is locked, it has
 * no hit box, and shows only inside the document. A tap off the image puts
 * the tool down.
 */
export function useRegionTap({
	input,
	scale,
	lookups,
	targets,
	document,
	documentSize,
	tapOnNothing,
	enabled = true,
}: {
	input: {
		imageId: string;
		regions: readonly CanvasRegion[];
		onToggle: (sourceIndex: number) => void;
	} | null;
	scale: number;
	lookups: CanvasLookups;
	targets: readonly LayerTarget[];
	document: EditorDocument;
	documentSize: Size;
	tapOnNothing: (point: Point | null) => void;
	enabled?: boolean;
}) {
	const handleRegionTap = useCallback(
		(screenX: number, screenY: number) => {
			if (!input || scale === 0) return;
			const point = lookups.toDocument(screenX, screenY);
			const hit = regionAt(input.regions, point, 10 / scale);
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
		[input, scale, lookups, targets, document, documentSize, tapOnNothing],
	);
	return useCanvasTap(handleRegionTap, enabled && Boolean(input));
}
