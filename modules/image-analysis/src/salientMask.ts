/** How sure a pixel must be to count as foreground. */
export const SALIENT_CONFIDENCE = 0.5;

/**
 * Reject only empty / stray-speck masks (<0.2%) or masks covering virtually
 * the entire frame (>98%). Real off-center subjects in wide landscapes can be
 * ~1–2% of the frame, so the lower bound stays well below 3%.
 */
export const MIN_SALIENT_AREA = 0.002;
export const MAX_SALIENT_AREA = 0.98;

export type SalientMaskCheck = {
	hasSubject: boolean;
	area: number;
	maxConfidence: number;
};

/**
 * Measures foreground coverage of a salient-object probability map (`0–1`)
 * and reports whether it represents a plausible subject rather than an empty
 * scene or full-frame wash.
 */
export function evaluateSalientMask(
	confidences: ArrayLike<number>,
): SalientMaskCheck {
	const count = confidences.length;
	if (count === 0) {
		return { hasSubject: false, area: 0, maxConfidence: 0 };
	}
	let foreground = 0;
	let maxConfidence = 0;
	for (let i = 0; i < count; i++) {
		const raw = confidences[i] ?? 0;
		const value = Math.min(1, Math.max(0, raw));
		if (value > maxConfidence) maxConfidence = value;
		if (value >= SALIENT_CONFIDENCE) foreground++;
	}
	const area = foreground / count;
	const hasSubject = area >= MIN_SALIENT_AREA && area <= MAX_SALIENT_AREA;
	return { hasSubject, area, maxConfidence };
}
