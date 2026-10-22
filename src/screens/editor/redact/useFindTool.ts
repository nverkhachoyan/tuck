import { useMemo } from "react";
import { detectionTargetKey } from "@/detection/detectionTarget";
import { mapDetectionRects } from "@/detection/mapDetectionRects";
import {
	type DetectionScope,
	useImageDetection,
} from "@/detection/useImageDetection";
import type {
	EditorDocument,
	ImageLayer,
	RedactionEffect,
} from "@/model/document";
import { useStore } from "@/store";
import { chosenBoxes } from "./findResults";

/**
 * Find: faces and text found in `image`, placed in the document, to choose
 * from and redact. What's found goes stale when the image or the document
 * changes shape.
 */
export function useFindTool(
	document: EditorDocument,
	image: ImageLayer | null,
) {
	const addRedactionBoxes = useStore((state) => state.addRedactionBoxes);
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
		if (image) detection.start(image.uri, scope);
	};

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
		toggle: detection.toggle,
		selectAll: () => detection.select(visibleIndices),
		clear: () => detection.select([]),
		reset: detection.reset,
		// The regions chosen, redacted with `effect` together in one group.
		redactChosen: (effect: RedactionEffect) => {
			const result = found && chosenBoxes(regions, found.selected);
			if (result) addRedactionBoxes(result.boxes, effect, result.groupName);
		},
	};
}
