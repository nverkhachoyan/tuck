import type { DetectionFeature } from "../../detection/imageDetection.ts";
import type { EditorDocument } from "../../document/document.ts";
import type { ImageLayer } from "../../layers/image/image.ts";
import type { RedactionBoxPlacement } from "../../layers/redaction/redaction.ts";
import type { MappedDetectionRect } from "./mapDetectionRects.ts";

// A region Find found, placed in the document, with its words' boxes when
// it's a line of text that can be narrowed to some of them (none otherwise).
export type FoundRegion = MappedDetectionRect & {
	feature: DetectionFeature;
	words: MappedDetectionRect[];
};

/**
 * What Find has chosen, by each region's source index: the regions chosen
 * whole (`selected`), and the lines narrowed to some of their words
 * (`words`, by word index). A region is in one or neither, and a narrowed
 * line keeps at least one word.
 */
export type FindChoice = {
	selected: ReadonlySet<number>;
	words: ReadonlyMap<number, ReadonlySet<number>>;
};

/** Whether region `index` is chosen, whole or narrowed to some words. */
export function isChosen(choice: FindChoice, index: number): boolean {
	return choice.selected.has(index) || choice.words.has(index);
}

/** Exactly the regions `indices`, each whole. */
export function chooseWhole(indices: Iterable<number>): FindChoice {
	return { selected: new Set(indices), words: new Map() };
}

/**
 * The choice once region `index` is tapped, `word` naming the word tapped
 * (null for none, or when the line has too few to narrow):
 * - left out, the region is chosen whole;
 * - chosen whole, a tap on a word narrows it to that word;
 * - narrowed, a tap on a word adds or leaves out that word, and leaving out
 *   its last leaves the line out;
 * - chosen either way, a tap on no word leaves it out.
 */
export function tapChoice(
	choice: FindChoice,
	index: number,
	word: number | null,
): FindChoice {
	const selected = new Set(choice.selected);
	const words = new Map(choice.words);
	const narrowed = words.get(index);
	if (narrowed && word !== null) {
		const kept = new Set(narrowed);
		if (kept.has(word)) kept.delete(word);
		else kept.add(word);
		if (kept.size > 0) words.set(index, kept);
		else words.delete(index);
	} else if (narrowed) {
		words.delete(index);
	} else if (selected.has(index)) {
		selected.delete(index);
		if (word !== null) words.set(index, new Set([word]));
	} else {
		selected.add(index);
	}
	return { selected, words };
}

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
 * The boxes for the regions `chosen`, in order (a narrowed line's chosen
 * words in its place), what they are (null for both kinds), and what to
 * call their group: by what was found, or "Find results" for both kinds.
 * Null when none is chosen.
 */
export function chosenBoxes(
	regions: readonly FoundRegion[],
	chosen: FindChoice,
): {
	boxes: RedactionBoxPlacement[];
	feature: DetectionFeature | null;
	groupName: string;
} | null {
	const picked = regions.filter(({ sourceIndex }) =>
		isChosen(chosen, sourceIndex),
	);
	const boxes = picked.flatMap((region): RedactionBoxPlacement[] => {
		const words = chosen.words.get(region.sourceIndex);
		const parts = words
			? region.words.filter(({ sourceIndex }) => words.has(sourceIndex))
			: [region];
		return parts.map(({ width, height, transform }) => ({
			width,
			height,
			transform,
		}));
	});
	if (boxes.length === 0) return null;
	const features = new Set(picked.map(({ feature }) => feature));
	const feature = features.size > 1 ? null : picked[0].feature;
	return {
		boxes,
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
 * What the edit notice says once Find redacted `count` regions, `feature`
 * saying what they are (null for both kinds).
 */
export function redactedNotice(
	count: number,
	feature: DetectionFeature | null,
): string {
	const one = count === 1;
	const name =
		feature === "faces"
			? one
				? "face"
				: "faces"
			: feature === "text"
				? one
					? "text region"
					: "text regions"
				: one
					? "region"
					: "regions";
	return `${count} ${name} redacted`;
}

/** What Find's Done says once `chosen` regions are chosen: none leaves "Done". */
export function findDoneLabel(chosen: number): string | undefined {
	return chosen > 0 ? `Redact ${chosen} chosen` : undefined;
}
