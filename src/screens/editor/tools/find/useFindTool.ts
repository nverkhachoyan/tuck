import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorDocument } from "@/model/document";
import { boundingBox, type Rect } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import type {
	RedactionBoxPlacement,
	RedactionEffect,
} from "@/model/layers/redaction";
import { useStore } from "@/store";
import type { CanvasInput } from "../../canvasInputFor";
import type { DetectionFeature } from "../../detection/imageDetection";
import { chosenBoxes, detectionTargetKey, readingOrder } from "./findResults";
import { mapDetectionRects } from "./mapDetectionRects";
import { type DetectionScope, useImageDetection } from "./useImageDetection";

/**
 * Reviewing what Find found, one region at a time, in reading order:
 * `current` is the region shown, or null before stepping; `step` moves on
 * or back (starting at either end), `toggle` includes or leaves out the
 * region shown, and `stop` ends the review.
 */
export type FindReview = {
	current: {
		sourceIndex: number;
		position: number;
		count: number;
		feature: DetectionFeature;
		included: boolean;
		// Where it is in the document, to zoom to.
		bounds: Rect;
	} | null;
	count: number;
	step: (delta: 1 | -1) => void;
	toggle: () => void;
	stop: () => void;
};

export type ReviewView = {
	zoomToArea: (rect: Rect) => void;
	fit: () => void;
};

export type FindController = ReturnType<typeof useFindTool>;

/**
 * Find: faces and text found in `image`, placed in the document, to choose
 * from and redact, and to review one at a time. What's found goes stale when
 * the image or the document changes shape. `canvasInput` toggles a region
 * tapped on the canvas, while there's an image to search.
 */
export function useFindTool({
	document,
	image,
	redactionEffect,
	onRedacted,
}: {
	document: EditorDocument;
	image: ImageLayer | null;
	redactionEffect: RedactionEffect;
	onRedacted: (count: number, feature: DetectionFeature | null) => void;
}) {
	const { addRedactionBoxes } = useStore((state) => state.actions);
	const detection = useImageDetection(detectionTargetKey(document, image));
	const documentSize = useMemo(
		() => ({ width: document.width, height: document.height }),
		[document.width, document.height],
	);
	const regions = useMemo(
		() =>
			image && detection.state.status === "found"
				? detection.state.regions.flatMap(
						({ feature, ...region }, sourceIndex) =>
							mapDetectionRects(image, [region], documentSize, feature).map(
								(mapped) => ({ ...mapped, sourceIndex, feature }),
							),
					)
				: [],
		[image, detection.state, documentSize],
	);
	const found = detection.state.status === "found" ? detection.state : null;
	const overlay = useMemo(
		() =>
			regions.map((region) => ({
				...region,
				selected: found?.selected.has(region.sourceIndex) ?? false,
			})),
		[regions, found],
	);
	const visibleIndices = useMemo(
		() => regions.map(({ sourceIndex }) => sourceIndex),
		[regions],
	);
	const selectedCount = found
		? visibleIndices.filter((index) => found.selected.has(index)).length
		: 0;
	// Picking what's already found keeps the regions chosen from it.
	const find = (scope: DetectionScope) => {
		const { state } = detection;
		if (state.status === "found" && state.scope === scope) return;
		setReviewed(null);
		if (image) detection.start(image.uri, scope);
	};

	// The region under review, by its source index.
	const [reviewed, setReviewed] = useState<number | null>(null);
	const order = useMemo(() => readingOrder(regions), [regions]);
	const position =
		reviewed === null
			? -1
			: order.findIndex((index) => regions[index].sourceIndex === reviewed);
	const shown = position < 0 ? null : regions[order[position]];
	const review: FindReview = {
		current: shown && {
			sourceIndex: shown.sourceIndex,
			position,
			count: order.length,
			feature: shown.feature,
			included: found?.selected.has(shown.sourceIndex) ?? false,
			bounds: regionBounds(shown),
		},
		count: order.length,
		step: (delta) => {
			if (order.length === 0) return;
			const next =
				position < 0
					? delta > 0
						? 0
						: order.length - 1
					: Math.min(order.length - 1, Math.max(0, position + delta));
			setReviewed(regions[order[next]].sourceIndex);
		},
		toggle: () => {
			if (shown) detection.toggle(shown.sourceIndex);
		},
		stop: () => setReviewed(null),
	};

	// A tap on a region toggles it, and moves a review there.
	const { toggle: toggleDetection } = detection;
	const toggle = useCallback(
		(index: number) => {
			toggleDetection(index);
			setReviewed((current) => (current === null ? null : index));
		},
		[toggleDetection],
	);
	const imageId = image?.id;
	const canvasInput = useMemo(
		(): CanvasInput | null =>
			imageId === undefined
				? null
				: { type: "regions", imageId, regions: overlay, onToggle: toggle },
		[imageId, overlay, toggle],
	);

	return {
		state: detection.state,
		overlay,
		visibleIndices,
		selectedCount,
		find,
		retry: () => {
			const { state } = detection;
			if (state.status !== "idle") find(state.scope);
		},
		review,
		toggle,
		canvasInput,
		selectAll: () => detection.select(visibleIndices),
		clear: () => detection.select([]),
		reset: () => {
			setReviewed(null);
			detection.reset();
		},
		// The regions chosen, redacted together in one group, saying how many
		// and what they are (null for both kinds).
		redact: () => {
			const result = found && chosenBoxes(regions, found.selected);
			if (!result) return;
			addRedactionBoxes(result.boxes, redactionEffect, result.groupName);
			onRedacted(result.boxes.length, result.feature);
		},
	};
}

/**
 * Reviewing what Find found zooms to each region it steps to, and back to
 * the fit once it stops (finishing or leaving Find included). Keyed on
 * the region, so other renders don't undo a pan.
 */
export function useReviewZoom(review: FindReview, view: ReviewView) {
	const reviewedRegion = review.current?.sourceIndex ?? null;
	const reviewBounds = useRef<Rect | null>(null);
	reviewBounds.current = review.current?.bounds ?? null;
	const zoomedToReview = useRef(false);
	const viewRef = useRef(view);
	viewRef.current = view;

	useEffect(() => {
		if (reviewedRegion !== null && reviewBounds.current) {
			viewRef.current.zoomToArea(reviewBounds.current);
			zoomedToReview.current = true;
		} else if (zoomedToReview.current) {
			viewRef.current.fit();
			zoomedToReview.current = false;
		}
	}, [reviewedRegion]);
}

// A found region's upright bounds in the document.
function regionBounds({
	width,
	height,
	transform,
}: RedactionBoxPlacement): Rect {
	const { halfWidth, halfHeight } = boundingBox(transform, {
		halfWidth: width / 2,
		halfHeight: height / 2,
	});
	return {
		x: transform.x - halfWidth,
		y: transform.y - halfHeight,
		width: halfWidth * 2,
		height: halfHeight * 2,
	};
}
