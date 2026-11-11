import {
	type Box,
	hitTestBox,
	type Point,
	type Transform,
	toLayerSpace,
} from "../document/geometry.ts";
import { hitTestDrawing, type MaskStroke } from "../layers/strokes.ts";
import type { ResizeMode } from "./handleGeometry.ts";

/**
 * What gestures need to know about a visible layer on the UI thread, where
 * text can't be laid out: where it is, its selection box, and where a touch
 * selects it. Built on the JS thread whenever the document or the view's
 * scale changes (see `layerTargets.ts`), and hit-tested on either thread.
 */
// Minimum comfortable touch padding around a layer, in screen pixels.
export const HIT_PADDING_PX = 14;

export type LayerTarget = {
	id: string;
	transform: Transform;
	box: Box;
	// The box a touch hits, padded so small layers stay tappable; null when
	// the layer is locked and can't be selected.
	hitBox: Box | null;
	hitPadding: number;
	// A drawing, a redaction painted with a brush, or a shape is only hit
	// near what its strokes drew.
	strokes: MaskStroke[] | null;
	// A locked photo is cut off at the canvas's edge.
	clipped: boolean;
	resizeMode: ResizeMode;
	// Moved only by a drag that starts on it, not one from empty space: a
	// redaction, so a stray drag can't uncover what it hides.
	anchored: boolean;
};

/**
 * The topmost selectable layer under a document-space point, or null. A
 * layer of strokes is only hit near what it drew, so a tap inside a circle
 * drawn around something reaches what's under it.
 */
export function findLayerAt(
	targets: readonly LayerTarget[],
	point: Point,
): LayerTarget | null {
	"worklet";
	for (let i = targets.length - 1; i >= 0; i--) {
		const target = targets[i];
		if (!target.hitBox || !hitTestBox(target.transform, target.hitBox, point))
			continue;
		if (
			!target.strokes ||
			hitTestDrawing(
				{ strokes: target.strokes },
				toLayerSpace(target.transform, point),
				target.hitPadding,
			)
		) {
			return target;
		}
	}
	return null;
}

/**
 * Whether a document-space point hits the layer `id` itself, whatever lies
 * over it there.
 */
export function hitsLayer(
	targets: readonly LayerTarget[],
	id: string,
	point: Point,
): boolean {
	"worklet";
	const target = targets.find((candidate) => candidate.id === id);
	return target !== undefined && findLayerAt([target], point) !== null;
}

/**
 * The region under a document-space point, or null when there's none.
 * - A region the point is inside wins, the smallest where several hold it.
 * - Otherwise each region is padded by `padding`, so a small one stays
 *   tappable, and the nearest padded region wins.
 */
export function regionAt<
	Region extends { transform: Transform; width: number; height: number },
>(regions: readonly Region[], point: Point, padding: number): Region | null {
	let inside: Region | null = null;
	let near: Region | null = null;
	let nearest = Infinity;
	for (const region of regions) {
		const local = toLayerSpace(region.transform, point);
		const dx = Math.max(0, Math.abs(local.x) - region.width / 2);
		const dy = Math.max(0, Math.abs(local.y) - region.height / 2);
		if (dx === 0 && dy === 0) {
			if (
				!inside ||
				region.width * region.height < inside.width * inside.height
			)
				inside = region;
		} else if (dx <= padding && dy <= padding) {
			const distance = Math.hypot(dx, dy);
			if (distance < nearest) {
				nearest = distance;
				near = region;
			}
		}
	}
	return inside ?? near;
}
