import type { ImagePoint } from "./ImageAnalysis.types";

/**
 * How sure a pixel must be to count as the subject. MagicTouch's subject
 * mask is a soft confidence, and half is the line used to measure it.
 */
export const SUBJECT_CONFIDENCE = 0.5;

/**
 * Area, as a fraction of the frame, below which a mask is a speck. A horse
 * on a wide hillside can be about a sixtieth of the frame and still be the
 * subject.
 */
export const MIN_SUBJECT_AREA = 0.01;

/**
 * Area above which a mask is the frame itself, not a subject standing in it.
 */
export const MAX_SUBJECT_AREA = 0.9;

/**
 * Share of the frame's edge pixels above which a mask is background that
 * runs to the frame. A forested hillside that meets the top and left was
 * 0.071; the horses inside that photo met none of the edge.
 */
export const BORDER_SUBJECT_LIMIT = 0.05;

/**
 * A mask this wide is a band of background (a tree line, a far hillside)
 * unless it is also very sure, as a subject photographed up close can be.
 */
export const WIDE_COLUMN_SPAN = 0.75;

/** Confidence at which a wide mask can still be a subject. */
export const SURE_SUBJECT_CONFIDENCE = 0.96;

/**
 * A small mask this covered by a rejected background region is part of that
 * region, not a subject in front of it.
 */
export const CONTAINED_IN_BACKGROUND = 0.7;

/** Overlap above which two prompts found the same subject and are combined. */
export const SAME_SUBJECT_OVERLAP = 0.2;

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
	/** Fraction of columns that contain a subject pixel. */
	columnSpan: number;
	/** Fraction of rows that contain a subject pixel. */
	rowSpan: number;
};

/**
 * One prompt's mask. `occupancy` is a shared-size 0/1 grid so two prompts
 * can be compared; without it, overlap is not used.
 */
export type SubjectCandidate<T> = {
	stats: SubjectMaskStats;
	mask: T;
	occupancy?: ArrayLike<number>;
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
		return { area: 0, confidence: 0, border: 0, columnSpan: 0, rowSpan: 0 };
	}
	let subject = 0;
	let confidenceSum = 0;
	let borderPixels = 0;
	let borderSubject = 0;
	const columns = new Uint8Array(width);
	const rows = new Uint8Array(height);
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
			columns[x] = 1;
			rows[y] = 1;
			if (onBorder) borderSubject += 1;
		}
	}
	let columnHits = 0;
	for (const hit of columns) columnHits += hit;
	let rowHits = 0;
	for (const hit of rows) rowHits += hit;
	return {
		area: subject / count,
		confidence: subject === 0 ? 0 : confidenceSum / subject,
		border: borderPixels === 0 ? 0 : borderSubject / borderPixels,
		columnSpan: columnHits / width,
		rowSpan: rowHits / height,
	};
}

/**
 * A coarse 0/1 grid of where the mask is subject, for comparing prompts.
 * Every mask of one photo uses the same grid size.
 */
export function maskOccupancy(
	confidences: ArrayLike<number>,
	width: number,
	height: number,
	columns = 32,
	rows = 24,
): Uint8Array {
	const grid = new Uint8Array(columns * rows);
	if (width <= 0 || height <= 0) return grid;
	for (let row = 0; row < rows; row++) {
		const y0 = Math.floor((row * height) / rows);
		const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * height) / rows));
		for (let column = 0; column < columns; column++) {
			const x0 = Math.floor((column * width) / columns);
			const x1 = Math.max(x0 + 1, Math.floor(((column + 1) * width) / columns));
			let sum = 0;
			let count = 0;
			for (let y = y0; y < y1 && y < height; y++) {
				for (let x = x0; x < x1 && x < width; x++) {
					sum += confidences[y * width + x] ?? 0;
					count += 1;
				}
			}
			if (count > 0 && sum / count >= SUBJECT_CONFIDENCE) {
				grid[row * columns + column] = 1;
			}
		}
	}
	return grid;
}

/**
 * A mask that could be a subject on its own: not a speck, not the whole
 * frame, not running along the edge, and not a wide uncertain band.
 */
export function isPlausibleSubject(stats: SubjectMaskStats): boolean {
	return (
		stats.area >= MIN_SUBJECT_AREA &&
		stats.area <= MAX_SUBJECT_AREA &&
		stats.border < BORDER_SUBJECT_LIMIT &&
		!(
			stats.columnSpan >= WIDE_COLUMN_SPAN &&
			stats.confidence < SURE_SUBJECT_CONFIDENCE
		)
	);
}

/**
 * The foreground masks to keep, combined where they are the same subject,
 * or an empty list when nothing looks like one.
 * - A speck, a mask of almost the whole frame, a mask that meets more than
 *   a small share of the edge, or a wide uncertain band is background.
 * - A mask mostly covered by one of those is part of that background.
 * - Of what remains, the most confident wins, and an equal confidence
 *   keeps the larger area.
 * - Other survivors that overlap that winner are the same subject and are
 *   returned with it, so a subject split across prompts is kept whole.
 */
export function chooseSubjectMasks<T>(
	candidates: readonly SubjectCandidate<T>[],
): T[] {
	const interior = candidates.filter((candidate) =>
		isPlausibleSubject(candidate.stats),
	);
	const background = candidates.filter(
		(candidate) =>
			!isPlausibleSubject(candidate.stats) &&
			candidate.stats.area >= MIN_SUBJECT_AREA,
	);
	const free = interior.filter(
		(candidate) => !containedInBackground(candidate, background),
	);
	let best = free[0];
	if (best === undefined) return [];
	for (const candidate of free) {
		if (betterSubject(candidate.stats, best.stats)) best = candidate;
	}
	const same = free.filter(
		(candidate) => candidate === best || overlaps(candidate, best),
	);
	return same.map((candidate) => candidate.mask);
}

function betterSubject(a: SubjectMaskStats, b: SubjectMaskStats): boolean {
	if (a.confidence !== b.confidence) return a.confidence > b.confidence;
	return a.area > b.area;
}

function containedInBackground<T>(
	candidate: SubjectCandidate<T>,
	background: readonly SubjectCandidate<T>[],
): boolean {
	const inner = candidate.occupancy;
	if (!inner) return false;
	for (const other of background) {
		const outer = other.occupancy;
		if (!outer || outer.length !== inner.length) continue;
		if (coverage(inner, outer) >= CONTAINED_IN_BACKGROUND) return true;
	}
	return false;
}

function overlaps<T>(a: SubjectCandidate<T>, b: SubjectCandidate<T>): boolean {
	const left = a.occupancy;
	const right = b.occupancy;
	if (!left || !right || left.length !== right.length) return false;
	return intersectionOverUnion(left, right) >= SAME_SUBJECT_OVERLAP;
}

/** Fraction of `inner`'s subject cells that `outer` also marks. */
function coverage(inner: ArrayLike<number>, outer: ArrayLike<number>): number {
	let subject = 0;
	let shared = 0;
	for (let i = 0; i < inner.length; i++) {
		if ((inner[i] ?? 0) < 0.5) continue;
		subject += 1;
		if ((outer[i] ?? 0) >= 0.5) shared += 1;
	}
	return subject === 0 ? 0 : shared / subject;
}

function intersectionOverUnion(
	left: ArrayLike<number>,
	right: ArrayLike<number>,
): number {
	let shared = 0;
	let union = 0;
	for (let i = 0; i < left.length; i++) {
		const a = (left[i] ?? 0) >= 0.5;
		const b = (right[i] ?? 0) >= 0.5;
		if (a || b) union += 1;
		if (a && b) shared += 1;
	}
	return union === 0 ? 0 : shared / union;
}
