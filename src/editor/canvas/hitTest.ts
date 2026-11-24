import {
	type Box,
	boundingBox,
	hitTestBox,
	type Point,
	type Rect,
	type Transform,
	toDocumentSpace,
	toLayerSpace,
} from "../document/geometry.ts";
import {
	erasedAt,
	hitTestDrawing,
	type MaskStroke,
	segmentDistanceSquared,
} from "../layers/strokes.ts";
import type { ResizeMode } from "./handleGeometry.ts";

/**
 * What gestures need to know about a visible layer on the UI thread, where
 * text can't be laid out: where it is, its selection box, and where a touch
 * selects it. Built on the JS thread whenever the document or the view's
 * scale changes (see `layerTargets.ts`), and hit-tested on either thread.
 */
// Minimum comfortable touch padding around a layer, in screen pixels.
export const HIT_PADDING_PX = 14;

/**
 * A value the UI thread receives once and then reads by reference (a
 * Reanimated mutable, from `shareOnce`), so copying targets to the UI
 * thread doesn't copy every stroke again.
 */
export type Shared<T> = { readonly value: T };

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
	strokes: Shared<MaskStroke[]> | null;
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
				{ strokes: target.strokes.value },
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
 * Whether a document-space point lies inside `box` placed by `transform`,
 * padded by `HIT_PADDING_PX` on screen at the view's `scale`.
 */
export function insidePaddedBox(
	transform: Transform,
	box: Box,
	point: Point,
	scale: number,
): boolean {
	"worklet";
	if (scale === 0) return false;
	const pad = HIT_PADDING_PX / scale;
	return hitTestBox(
		transform,
		{
			halfWidth: box.halfWidth + pad / (Math.abs(transform.scaleX) || 1),
			halfHeight: box.halfHeight + pad / (Math.abs(transform.scaleY) || 1),
		},
		point,
	);
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

/** Whether a document-space point hits any layer whose id is in `ids`. */
export function hitsAnyLayer(
	targets: readonly LayerTarget[],
	ids: readonly string[],
	point: Point,
): boolean {
	"worklet";
	for (const id of ids) {
		if (hitsLayer(targets, id, point)) return true;
	}
	return false;
}

// Marquee hit-testing runs in gestures on the UI thread too, so every helper
// is a worklet declared above the ones that call it.
function cross(origin: Point, a: Point, b: Point): number {
	"worklet";
	return (
		(a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
	);
}

function segmentsCross(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
	"worklet";
	const d1 = cross(b0, b1, a0);
	const d2 = cross(b0, b1, a1);
	if (!((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))) return false;
	const d3 = cross(a0, a1, b0);
	const d4 = cross(a0, a1, b1);
	return (d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0);
}

function pointInRect(point: Point, rect: Rect): boolean {
	"worklet";
	return (
		point.x >= rect.x &&
		point.x <= rect.x + rect.width &&
		point.y >= rect.y &&
		point.y <= rect.y + rect.height
	);
}

// Whether a layer-space point lies inside or within sqrt(reachSquared) of the
// convex quad (c0, c1, c2, c3) formed by mapping `rect` through `transform`.
function pointNearQuad(
	point: Point,
	transform: Transform,
	rect: Rect,
	c0: Point,
	c1: Point,
	c2: Point,
	c3: Point,
	reachSquared: number,
): boolean {
	"worklet";
	if (pointInRect(toDocumentSpace(transform, point), rect)) return true;
	return (
		segmentDistanceSquared(c0, c1, point) <= reachSquared ||
		segmentDistanceSquared(c1, c2, point) <= reachSquared ||
		segmentDistanceSquared(c2, c3, point) <= reachSquared ||
		segmentDistanceSquared(c3, c0, point) <= reachSquared
	);
}

// Whether a layer-space segment (p0, p1) comes within sqrt(reachSquared) of
// the quad (c0, c1, c2, c3). Exact: either it meets the quad or the minimum
// distance is attained at a segment endpoint or a quad corner.
function segmentNearQuad(
	p0: Point,
	p1: Point,
	transform: Transform,
	rect: Rect,
	c0: Point,
	c1: Point,
	c2: Point,
	c3: Point,
	reachSquared: number,
): boolean {
	"worklet";
	if (
		pointNearQuad(p0, transform, rect, c0, c1, c2, c3, reachSquared) ||
		pointNearQuad(p1, transform, rect, c0, c1, c2, c3, reachSquared)
	) {
		return true;
	}
	if (
		segmentsCross(p0, p1, c0, c1) ||
		segmentsCross(p0, p1, c1, c2) ||
		segmentsCross(p0, p1, c2, c3) ||
		segmentsCross(p0, p1, c3, c0)
	) {
		return true;
	}
	return (
		segmentDistanceSquared(p0, p1, c0) <= reachSquared ||
		segmentDistanceSquared(p0, p1, c1) <= reachSquared ||
		segmentDistanceSquared(p0, p1, c2) <= reachSquared ||
		segmentDistanceSquared(p0, p1, c3) <= reachSquared
	);
}

function strokesMeetRect(
	strokes: MaskStroke[],
	transform: Transform,
	rect: Rect,
	c0: Point,
	c1: Point,
	c2: Point,
	c3: Point,
	qMinX: number,
	qMaxX: number,
	qMinY: number,
	qMaxY: number,
	padding: number,
): boolean {
	"worklet";
	for (let index = 0; index < strokes.length; index++) {
		const stroke = strokes[index];
		if (stroke.type !== "pen") continue;
		const { points, width } = stroke;
		if (points.length < 2) continue;
		const reach = width / 2 + padding;
		const reachSquared = reach * reach;
		const bxMin = qMinX - reach;
		const bxMax = qMaxX + reach;
		const byMin = qMinY - reach;
		const byMax = qMaxY + reach;
		let hasEraser = false;
		for (let i = index + 1; i < strokes.length && !hasEraser; i++) {
			hasEraser = strokes[i].type === "eraser";
		}
		const gap = Math.max(width / 4, reach / 8);
		const last = Math.max(0, points.length - 4);
		for (let i = 0; i <= last; i += 2) {
			const end = Math.min(i + 2, points.length - 2);
			const x0 = points[i];
			const y0 = points[i + 1];
			const x1 = points[end];
			const y1 = points[end + 1];
			if (
				Math.max(x0, x1) < bxMin ||
				Math.min(x0, x1) > bxMax ||
				Math.max(y0, y1) < byMin ||
				Math.min(y0, y1) > byMax
			) {
				continue;
			}
			const p0 = { x: x0, y: y0 };
			const p1 = { x: x1, y: y1 };
			if (
				!segmentNearQuad(p0, p1, transform, rect, c0, c1, c2, c3, reachSquared)
			) {
				continue;
			}
			if (!hasEraser) return true;
			const dx = x1 - x0;
			const dy = y1 - y0;
			const length = Math.hypot(dx, dy);
			if (length === 0) {
				if (!erasedAt(strokes, index + 1, p0)) return true;
				continue;
			}
			// Clip the segment to the quad's padded extent before sampling, so a
			// long stroke only checks the part near the box.
			let t0 = 0;
			let t1 = 1;
			if (dx !== 0) {
				const a = (bxMin - x0) / dx;
				const b = (bxMax - x0) / dx;
				t0 = Math.max(t0, Math.min(a, b));
				t1 = Math.min(t1, Math.max(a, b));
			}
			if (dy !== 0) {
				const a = (byMin - y0) / dy;
				const b = (byMax - y0) / dy;
				t0 = Math.max(t0, Math.min(a, b));
				t1 = Math.min(t1, Math.max(a, b));
			}
			if (t0 > t1) continue;
			const steps = Math.max(1, Math.ceil(((t1 - t0) * length) / gap));
			for (let step = 0; step <= steps; step++) {
				const t = t0 + ((t1 - t0) * step) / steps;
				const sample = { x: x0 + dx * t, y: y0 + dy * t };
				if (
					pointNearQuad(
						sample,
						transform,
						rect,
						c0,
						c1,
						c2,
						c3,
						reachSquared,
					) &&
					!erasedAt(strokes, index + 1, sample)
				) {
					return true;
				}
			}
		}
	}
	return false;
}

/**
 * The ids of every unlocked visible layer in `targets` caught by `rect` (in
 * document space), in bottom-to-top order.
 * - A layer with strokes (drawing, brushed redaction, shape) is caught only
 *   where `rect` touches its non-erased ink, padded like a tap.
 * - Any other layer (image, sticker, text, box or masked redaction) is caught
 *   where `rect` meets its rotated bounds, unless those bounds hold all of
 *   `rect` (so a box dragged on top of an unlocked full-canvas photo skips it).
 */
export function layersInRect(
	targets: readonly LayerTarget[],
	rect: Rect,
): string[] {
	"worklet";
	const caught: string[] = [];
	const right = rect.x + rect.width;
	const bottom = rect.y + rect.height;
	for (const target of targets) {
		if (!target.hitBox) continue;
		const { transform } = target;
		const checkBox = target.strokes ? target.hitBox : target.box;
		const extent = boundingBox(transform, checkBox);
		if (
			transform.x + extent.halfWidth < rect.x ||
			transform.x - extent.halfWidth > right ||
			transform.y + extent.halfHeight < rect.y ||
			transform.y - extent.halfHeight > bottom
		) {
			continue;
		}
		const c0 = toLayerSpace(transform, { x: rect.x, y: rect.y });
		const c1 = toLayerSpace(transform, { x: right, y: rect.y });
		const c2 = toLayerSpace(transform, { x: right, y: bottom });
		const c3 = toLayerSpace(transform, { x: rect.x, y: bottom });
		const minX = Math.min(c0.x, c1.x, c2.x, c3.x);
		const maxX = Math.max(c0.x, c1.x, c2.x, c3.x);
		const minY = Math.min(c0.y, c1.y, c2.y, c3.y);
		const maxY = Math.max(c0.y, c1.y, c2.y, c3.y);
		if (
			maxX < -checkBox.halfWidth ||
			minX > checkBox.halfWidth ||
			maxY < -checkBox.halfHeight ||
			minY > checkBox.halfHeight
		) {
			continue;
		}
		if (!target.strokes) {
			if (
				minX >= -checkBox.halfWidth &&
				maxX <= checkBox.halfWidth &&
				minY >= -checkBox.halfHeight &&
				maxY <= checkBox.halfHeight
			) {
				continue;
			}
			caught.push(target.id);
			continue;
		}
		if (
			strokesMeetRect(
				target.strokes.value,
				transform,
				rect,
				c0,
				c1,
				c2,
				c3,
				minX,
				maxX,
				minY,
				maxY,
				target.hitPadding,
			)
		) {
			caught.push(target.id);
		}
	}
	return caught;
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
