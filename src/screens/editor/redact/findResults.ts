import type { DetectionFeature } from "@/screens/editor/detection/imageDetection";
import type { MappedDetectionRect } from "@/screens/editor/detection/mapDetectionRects";
import type { RedactionBoxPlacement } from "../../../model/document.ts";

// A region Find found, placed in the document.
export type FoundRegion = MappedDetectionRect & { feature: DetectionFeature };

// What Find names the group of boxes it adds, when they're all one kind.
const GROUP_NAMES: Record<DetectionFeature, string> = {
	faces: "Face results",
	text: "Text results",
};

/**
 * The boxes for the regions whose `sourceIndex` is `chosen`, in order, and
 * what to call their group: by what was found, or "Find results" for both
 * kinds. Null when none is chosen.
 */
export function chosenBoxes(
	regions: readonly FoundRegion[],
	chosen: ReadonlySet<number>,
): { boxes: RedactionBoxPlacement[]; groupName: string } | null {
	const picked = regions.filter(({ sourceIndex }) => chosen.has(sourceIndex));
	if (picked.length === 0) return null;
	const features = new Set(picked.map(({ feature }) => feature));
	return {
		boxes: picked.map(({ width, height, transform }) => ({
			width,
			height,
			transform,
		})),
		groupName:
			features.size > 1 ? "Find results" : GROUP_NAMES[picked[0].feature],
	};
}
