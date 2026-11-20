import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasInput } from "../../canvas/canvasInput";
import { regionAt } from "../../canvas/hitTest";
import type { CanvasRegion } from "../../canvas/RegionOutline";
import type { DetectionFeature } from "../../detection/imageDetection";
import { boundingBox, type Point, type Rect } from "../../document/geometry";
import type { RedactionBoxPlacement } from "../../layers/redaction/redaction";
import { useRedactLook } from "../../shell/useRedactLook";
import { useStore } from "../../store";
import type { ToolEnv } from "../defineTool";
import {
	chosenBoxes,
	detectionTargetKey,
	type FoundRegion,
	isChosen,
	readingOrder,
	redactedNotice,
} from "./findResults";
import { mapDetectionRects, mapWordRects } from "./mapDetectionRects";
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

export type FindController = ReturnType<typeof useFindTool>;

/**
 * Find: faces and text found in `image`, placed in the document, to choose
 * from and redact, and to review one at a time. What's found goes stale when
 * the image or the document changes shape, and is let go once Find closes.
 * `canvasInput` chooses a region tapped on the canvas, while there's an
 * image to search; a second tap on a chosen line narrows it to the word
 * under the finger, whose words are then shown and chosen one by one. Reviewing zooms the canvas to each region (`view`).
 * Redacting says how many regions it redacted (`notify`).
 */
export function useFindTool({
	document,
	image,
	open,
	notify,
	view,
}: Pick<ToolEnv, "document" | "image" | "open" | "notify" | "view">) {
	const { addRedactionBoxes } = useStore((state) => state.actions);
	const { effectFor } = useRedactLook();
	const detection = useImageDetection(detectionTargetKey(document, image));
	const documentSize = useMemo(
		() => ({ width: document.width, height: document.height }),
		[document.width, document.height],
	);
	const detected =
		detection.state.status === "found" ? detection.state.regions : null;
	const regions = useMemo(
		(): FoundRegion[] =>
			image && detected
				? detected.flatMap(({ feature, words, ...region }, sourceIndex) =>
						mapDetectionRects(image, [region], documentSize, feature).map(
							(mapped) => ({
								...mapped,
								sourceIndex,
								feature,
								// A line of one word has nothing to narrow to.
								words:
									words && words.length > 1
										? mapWordRects(image, region, words, documentSize)
										: [],
							}),
						),
					)
				: [],
		[image, detected, documentSize],
	);
	const found = detection.state.status === "found" ? detection.state : null;
	// A narrowed line shows its words, each chosen or not, in its place.
	const overlay = useMemo(
		() =>
			regions.flatMap(
				({ sourceIndex, width, height, transform, words }): CanvasRegion[] => {
					const narrowed = found?.words.get(sourceIndex);
					return narrowed
						? words.map(({ sourceIndex: word, ...placement }) => ({
								...placement,
								sourceIndex,
								word,
								selected: narrowed.has(word),
							}))
						: [
								{
									sourceIndex,
									width,
									height,
									transform,
									selected: found?.selected.has(sourceIndex) ?? false,
								},
							];
				},
			),
		[regions, found],
	);
	const visibleIndices = useMemo(
		() => regions.map(({ sourceIndex }) => sourceIndex),
		[regions],
	);
	const selectedCount = found
		? visibleIndices.filter((index) => isChosen(found, index)).length
		: 0;
	// Whether a line chosen whole could be narrowed to a word, to say how.
	const canNarrow =
		found !== null &&
		regions.some(
			({ sourceIndex, words }) =>
				words.length > 1 && found.selected.has(sourceIndex),
		);
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
			included: found ? isChosen(found, shown.sourceIndex) : false,
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
			if (shown) detection.tap(shown.sourceIndex, null);
		},
		stop: () => setReviewed(null),
	};
	useReviewZoom(review, view);

	// A tap on a region chooses it, narrows it, or leaves it out
	// (`tapChoice`), and moves a review there. On a line chosen whole, the
	// word tapped is the nearest one to the point.
	const { tap: tapDetection } = detection;
	const chosenWhole = found?.selected;
	const tap = useCallback(
		(hit: CanvasRegion, point: Point) => {
			const index = hit.sourceIndex;
			let word = hit.word ?? null;
			if (word === null && chosenWhole?.has(index)) {
				const line = regions.find(({ sourceIndex }) => sourceIndex === index);
				if (line && line.words.length > 1) {
					word = regionAt(line.words, point, Infinity)?.sourceIndex ?? null;
				}
			}
			tapDetection(index, word);
			setReviewed((current) => (current === null ? null : index));
		},
		[tapDetection, chosenWhole, regions],
	);
	const { reset: resetDetection } = detection;
	const reset = useCallback(() => {
		setReviewed(null);
		resetDetection();
	}, [resetDetection]);
	const wasOpen = useRef(open);
	useEffect(() => {
		if (wasOpen.current && !open) reset();
		wasOpen.current = open;
	}, [open, reset]);

	const imageId = image?.id;
	const canvasInput = useMemo(
		(): CanvasInput | null =>
			imageId === undefined
				? null
				: { type: "regions", imageId, regions: overlay, onTap: tap },
		[imageId, overlay, tap],
	);

	return {
		state: detection.state,
		overlay,
		visibleIndices,
		selectedCount,
		canNarrow,
		find,
		retry: () => {
			const { state } = detection;
			if (state.status !== "idle") find(state.scope);
		},
		review,
		canvasInput,
		selectAll: () => detection.select(visibleIndices),
		clear: () => detection.select([]),
		reset,
		// The regions chosen, redacted together in one group, saying how many
		// and what they are (null for both kinds).
		redact: () => {
			const result = found && chosenBoxes(regions, found);
			if (!result) return;
			addRedactionBoxes(
				result.boxes,
				effectFor(documentSize),
				result.groupName,
			);
			notify(redactedNotice(result.boxes.length, result.feature));
		},
	};
}

/**
 * Reviewing what Find found zooms to each region it steps to, and back to
 * the fit once it stops (finishing or leaving Find included). Keyed on
 * the region, so other renders don't undo a pan. In Find's hook rather
 * than a view, which the tray and the layout mount and unmount: a remount
 * mid-review would forget it zoomed in, and leaving wouldn't fit again.
 */
function useReviewZoom(review: FindReview, view: ToolEnv["view"]) {
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
