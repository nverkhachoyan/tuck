import type { ImageBox } from "./ImageAnalysis.types";

/** How sure a pixel must be to count as foreground. */
export const SALIENT_CONFIDENCE = 0.5;

/**
 * Reject only empty / stray-speck masks (<0.2%) or masks covering virtually
 * the entire frame (>98%). Real off-center subjects in wide landscapes can be
 * ~1–2% of the frame, so the lower bound stays well below 3%.
 */
export const MIN_SALIENT_AREA = 0.002;
export const MAX_SALIENT_AREA = 0.98;

/**
 * Nearby salient components whose boxes overlap after expanding each by this
 * share of its longer side merge into one box before MobileSAM refines them,
 * so a subject split across a thin bridge (like handlebars) stays whole.
 */
export const BOX_MERGE_GAP = 0.1;

/** Cap refined boxes so a fragmented mask cannot trigger many SAM runs. */
export const MAX_REFINED_BOXES = 4;

/**
 * Minimum IoU between U²-Net-p's salient mask and MobileSAM's refined mask.
 * Below this, SAM diverged from the detected subject and we keep U²-Net-p's.
 */
export const MIN_REFINEMENT_IOU = 0.7;

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

type PixelBox = {
	area: number;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

/**
 * Normalized bounding boxes of salient foreground components in a `side × side`
 * probability map, sorted largest first and merged where nearby boxes overlap
 * within `BOX_MERGE_GAP`.
 */
export function salientSubjectBoxes(
	confidences: ArrayLike<number>,
	side: number,
): ImageBox[] {
	if (side <= 0 || confidences.length < side * side) return [];
	const total = side * side;
	const visited = new Uint8Array(total);
	const stack: number[] = [];
	const components: PixelBox[] = [];

	for (let y = 0; y < side; y++) {
		for (let x = 0; x < side; x++) {
			const start = y * side + x;
			if (visited[start] || (confidences[start] ?? 0) < SALIENT_CONFIDENCE) {
				continue;
			}
			visited[start] = 1;
			stack.push(start);
			let minX = x;
			let maxX = x;
			let minY = y;
			let maxY = y;
			let area = 0;
			while (stack.length > 0) {
				const cur = stack.pop();
				if (cur === undefined) break;
				const cx = cur % side;
				const cy = (cur - cx) / side;
				area++;
				if (cx < minX) minX = cx;
				if (cx > maxX) maxX = cx;
				if (cy < minY) minY = cy;
				if (cy > maxY) maxY = cy;
				for (let dy = -1; dy <= 1; dy++) {
					const ny = cy + dy;
					if (ny < 0 || ny >= side) continue;
					for (let dx = -1; dx <= 1; dx++) {
						const nx = cx + dx;
						if (nx < 0 || nx >= side) continue;
						const next = ny * side + nx;
						if (
							!visited[next] &&
							(confidences[next] ?? 0) >= SALIENT_CONFIDENCE
						) {
							visited[next] = 1;
							stack.push(next);
						}
					}
				}
			}
			if (area / total >= MIN_SALIENT_AREA) {
				components.push({ area, minX, minY, maxX, maxY });
			}
		}
	}

	// Merge boxes whose padded extents overlap until fixed point.
	const merged = [...components];
	let changed = true;
	while (changed) {
		changed = false;
		for (let i = 0; i < merged.length; i++) {
			for (let j = i + 1; j < merged.length; j++) {
				const a = merged[i];
				const b = merged[j];
				if (!a || !b || !boxesNear(a, b)) continue;
				merged[i] = {
					area: a.area + b.area,
					minX: Math.min(a.minX, b.minX),
					minY: Math.min(a.minY, b.minY),
					maxX: Math.max(a.maxX, b.maxX),
					maxY: Math.max(a.maxY, b.maxY),
				};
				merged.splice(j, 1);
				changed = true;
				break;
			}
			if (changed) break;
		}
	}

	return merged
		.sort((a, b) => b.area - a.area)
		.slice(0, MAX_REFINED_BOXES)
		.map(({ minX, minY, maxX, maxY }) => ({
			x: minX / side,
			y: minY / side,
			width: (maxX - minX + 1) / side,
			height: (maxY - minY + 1) / side,
		}));
}

function boxesNear(a: PixelBox, b: PixelBox): boolean {
	const padA =
		Math.max(a.maxX - a.minX + 1, a.maxY - a.minY + 1) * BOX_MERGE_GAP;
	const padB =
		Math.max(b.maxX - b.minX + 1, b.maxY - b.minY + 1) * BOX_MERGE_GAP;
	return (
		a.minX - padA <= b.maxX + 1 + padB &&
		a.maxX + 1 + padA >= b.minX - padB &&
		a.minY - padA <= b.maxY + 1 + padB &&
		a.maxY + 1 + padA >= b.minY - padB
	);
}

/**
 * Intersection-over-union between a salient probability map (`0–1`) and a
 * same-size refined grayscale mask (`0–255` red channel from RGBA ImageData
 * or single-channel bytes, selected by `stride`).
 */
export function maskAgreementIoU(
	salientProbs: ArrayLike<number>,
	refinedPixels: ArrayLike<number>,
	stride = 4,
): number {
	const count = salientProbs.length;
	if (count === 0 || refinedPixels.length < count * stride) return 0;
	let intersection = 0;
	let union = 0;
	for (let i = 0; i < count; i++) {
		const a = (salientProbs[i] ?? 0) >= SALIENT_CONFIDENCE;
		const b = (refinedPixels[i * stride] ?? 0) >= 128;
		if (a && b) intersection++;
		if (a || b) union++;
	}
	return union === 0 ? 0 : intersection / union;
}
