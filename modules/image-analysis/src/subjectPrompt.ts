import type { ImagePoint } from "./ImageAnalysis.types";

/**
 * How sure a pixel must be to count as the subject. MagicTouch's subject
 * mask is a soft confidence, and half is the line used to measure it.
 */
export const SUBJECT_CONFIDENCE = 0.5;

/**
 * Area, as a fraction of the frame, below which a mask is a speck. Remove
 * BG leaves the photo alone rather than keep one. A subject that fills
 * about a twentieth of the frame still counts.
 */
export const MIN_SUBJECT_AREA = 0.03;

/**
 * Area above which a mask is the frame itself, not a subject standing in it.
 */
export const MAX_SUBJECT_AREA = 0.9;

/**
 * Share of the frame's edge pixels that counts as touching most of the
 * border. Grass and sky that run to the edge do; a subject set inside the
 * frame does not.
 */
export const BORDER_SUBJECT_LIMIT = 0.5;

/**
 * How much a mask that covers most of the border loses in the ranking, so
 * a subject inside the frame wins a close call and a portrait that is
 * clearly the surest mask is still kept.
 */
export const BORDER_RANK_PENALTY = 0.05;

/**
 * Where Remove BG looks when nobody tapped: the nine points of the
 * rule-of-thirds grid. MagicTouch only segments the object under a point,
 * so a center that lands on grass or sky is not the only try.
 */
export const AUTO_SUBJECT_POINTS: readonly ImagePoint[] = [
	{ x: 0.5, y: 0.5 },
	{ x: 1 / 3, y: 1 / 3 },
	{ x: 0.5, y: 1 / 3 },
	{ x: 2 / 3, y: 1 / 3 },
	{ x: 1 / 3, y: 0.5 },
	{ x: 2 / 3, y: 0.5 },
	{ x: 1 / 3, y: 2 / 3 },
	{ x: 0.5, y: 2 / 3 },
	{ x: 2 / 3, y: 2 / 3 },
];

/** How a foreground confidence mask sits in its frame. */
export type SubjectMaskStats = {
	/** Fraction of pixels at or above the subject confidence. */
	area: number;
	/** Mean confidence of those pixels, or 0 when there are none. */
	confidence: number;
	/** Fraction of the frame's edge pixels that count as subject. */
	border: number;
};

/**
 * Which confidence mask is the subject. MagicTouch labels its categories
 * background, then subject, so the last mask is the subject. One mask is
 * used as-is. No masks is null.
 */
export function subjectMaskIndex(maskCount: number): number | null {
	if (maskCount < 1) return null;
	return maskCount - 1;
}

/**
 * Area, confidence, and border coverage of a foreground confidence mask.
 * `confidences` is row-major, one value per pixel, in the same order
 * MagicTouch returns.
 */
export function subjectMaskStats(
	confidences: ArrayLike<number>,
	width: number,
	height: number,
): SubjectMaskStats {
	const count = width * height;
	if (count <= 0 || width <= 0 || height <= 0) {
		return { area: 0, confidence: 0, border: 0 };
	}
	let subject = 0;
	let confidenceSum = 0;
	let borderPixels = 0;
	let borderSubject = 0;
	for (let y = 0; y < height; y++) {
		const edgeRow = y === 0 || y === height - 1;
		for (let x = 0; x < width; x++) {
			const onBorder = edgeRow || x === 0 || x === width - 1;
			if (onBorder) borderPixels += 1;
			const index = y * width + x;
			const confidence =
				index < confidences.length ? (confidences[index] ?? 0) : 0;
			if (confidence < SUBJECT_CONFIDENCE) continue;
			subject += 1;
			confidenceSum += confidence;
			if (onBorder) borderSubject += 1;
		}
	}
	return {
		area: subject / count,
		confidence: subject === 0 ? 0 : confidenceSum / subject,
		border: borderPixels === 0 ? 0 : borderSubject / borderPixels,
	};
}

/** A mask big enough to be a subject and small enough not to be the frame. */
export function isPlausibleSubject(stats: SubjectMaskStats): boolean {
	return stats.area >= MIN_SUBJECT_AREA && stats.area <= MAX_SUBJECT_AREA;
}

/**
 * The foreground mask most likely to be the subject, or null when none is.
 * - A speck, or a mask of almost the whole frame, is ignored.
 * - The winner is the most confident mask. A mask that covers most of the
 *   border ranks a little lower, so sky or grass running to the edge loses
 *   a close call and a portrait that is clearly surest is still kept.
 * - An equal confidence keeps the larger area.
 */
export function chooseSubjectMask<T>(
	candidates: readonly { stats: SubjectMaskStats; mask: T }[],
): T | null {
	const plausible = candidates.filter((candidate) =>
		isPlausibleSubject(candidate.stats),
	);
	let best = plausible[0];
	if (best === undefined) return null;
	for (const candidate of plausible) {
		if (betterSubject(candidate.stats, best.stats)) best = candidate;
	}
	return best.mask;
}

function subjectRank(stats: SubjectMaskStats): number {
	const penalty =
		stats.border >= BORDER_SUBJECT_LIMIT ? BORDER_RANK_PENALTY : 0;
	return stats.confidence - penalty;
}

function betterSubject(a: SubjectMaskStats, b: SubjectMaskStats): boolean {
	const rankA = subjectRank(a);
	const rankB = subjectRank(b);
	if (rankA !== rankB) return rankA > rankB;
	return a.area > b.area;
}
