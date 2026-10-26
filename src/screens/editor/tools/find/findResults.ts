import type { EditorDocument } from "../../../../model/document.ts";
import {
	hitTestBox,
	type Point,
	type Transform,
} from "../../../../model/geometry.ts";
import type { ImageLayer } from "../../../../model/layers/image.ts";
import type { RedactionBoxPlacement } from "../../../../model/layers/redaction.ts";
import type { DetectionFeature } from "../../detection/imageDetection.ts";
import type { MappedDetectionRect } from "./mapDetectionRects.ts";

// A region Find found, placed in the document.
export type FoundRegion = MappedDetectionRect & { feature: DetectionFeature };

/** Everything that makes a displayed detection box stale. */
export function detectionTargetKey(
	document: EditorDocument,
	layer: ImageLayer | null,
): string {
	if (!layer) return `none:${document.width}:${document.height}`;
	const { transform } = layer;
	return [
		layer.id,
		layer.uri,
		layer.width,
		layer.height,
		layer.flipped,
		transform.x,
		transform.y,
		transform.scaleX,
		transform.scaleY,
		transform.rotation,
		document.width,
		document.height,
	].join(":");
}

// What Find names the group of boxes it adds, when they're all one kind.
const GROUP_NAMES: Record<DetectionFeature, string> = {
	faces: "Face results",
	text: "Text results",
};

/**
 * The boxes for the regions whose `sourceIndex` is `chosen`, in order, what
 * they are (null for both kinds), and what to call their group: by what was
 * found, or "Find results" for both kinds. Null when none is chosen.
 */
export function chosenBoxes(
	regions: readonly FoundRegion[],
	chosen: ReadonlySet<number>,
): {
	boxes: RedactionBoxPlacement[];
	feature: DetectionFeature | null;
	groupName: string;
} | null {
	const picked = regions.filter(({ sourceIndex }) => chosen.has(sourceIndex));
	if (picked.length === 0) return null;
	const features = new Set(picked.map(({ feature }) => feature));
	const feature = features.size > 1 ? null : picked[0].feature;
	return {
		boxes: picked.map(({ width, height, transform }) => ({
			width,
			height,
			transform,
		})),
		feature,
		groupName: feature ? GROUP_NAMES[feature] : "Find results",
	};
}

/**
 * The order to step through `regions` in, as positions in it: rows from top
 * to bottom, then left to right along each, by each region's center. A
 * region starts a new row once its center is below the row's first by more
 * than half that one's height, so a row of faces at slightly different
 * heights still steps across.
 */
export function readingOrder(
	regions: readonly RedactionBoxPlacement[],
): number[] {
	const byTop = regions
		.map((_, index) => index)
		.sort((a, b) => regions[a].transform.y - regions[b].transform.y);
	const rows: number[][] = [];
	let rowTop = 0;
	let rowReach = 0;
	for (const index of byTop) {
		const { transform, height } = regions[index];
		const row = rows.at(-1);
		if (row && transform.y - rowTop <= rowReach) {
			row.push(index);
		} else {
			rows.push([index]);
			rowTop = transform.y;
			rowReach = (height * Math.abs(transform.scaleY)) / 2;
		}
	}
	return rows.flatMap((row) =>
		row.sort((a, b) => regions[a].transform.x - regions[b].transform.x),
	);
}

/**
 * The detected region under a document-space point, each padded by
 * `padding` so a small one stays tappable, and the smallest where padded
 * regions overlap. Null when there's none.
 */
export function detectionAt<
	Region extends { transform: Transform; width: number; height: number },
>(regions: readonly Region[], point: Point, padding: number): Region | null {
	let hit: Region | null = null;
	for (const region of regions) {
		const box = {
			halfWidth: region.width / 2 + padding,
			halfHeight: region.height / 2 + padding,
		};
		if (
			hitTestBox(region.transform, box, point) &&
			(!hit || region.width * region.height < hit.width * hit.height)
		) {
			hit = region;
		}
	}
	return hit;
}
