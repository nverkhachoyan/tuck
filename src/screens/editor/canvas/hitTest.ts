// Relative `.ts` imports keep this loadable by Node's test runner.
import type { MaskStroke } from "../../../model/document.ts";
import { hitTestDrawing } from "../../../model/drawing.ts";
import {
	type Box,
	hitTestBox,
	type Point,
	type Transform,
	toLayerSpace,
} from "../../../model/geometry.ts";
import type { ResizeMode } from "./handleGeometry.ts";

/**
 * What gestures need to know about a visible layer on the UI thread, where
 * text can't be laid out: where it is, its selection box, and where a touch
 * selects it. Built on the JS thread whenever the document or the view's
 * scale changes (see `layerTargets.ts`), and hit-tested on either thread.
 */
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
	// Its box's resize behavior, including whether it has side handles.
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
