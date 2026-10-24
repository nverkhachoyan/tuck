import type { Rect, Size, Transform } from "../geometry.ts";

export type LayerBase = {
	id: string;
	transform: Transform;
	// Left out of the editor, hit testing, and export.
	hidden: boolean;
	// Can't be selected, and so can't be moved, on the canvas.
	locked: boolean;
	// When true, selection sides and corners stretch this layer instead of
	// uniformly scaling it. Only images and text expose this in the UI.
	resizable?: boolean;
};

export const identityTransform: Transform = {
	x: 0,
	y: 0,
	scaleX: 1,
	scaleY: 1,
	rotation: 0,
};

let nextLayerId = 0;

export function createLayerId(prefix: string): string {
	nextLayerId += 1;
	return `${prefix}-${Date.now().toString(36)}-${nextLayerId}`;
}

/** Places something of this size centered on a canvas of the same size. */
export function centeredTransform(width: number, height: number): Transform {
	return { ...identityTransform, x: width / 2, y: height / 2 };
}

/**
 * The whole of a canvas, where a new layer goes unless it's given the part
 * the editor shows.
 */
export function canvasArea(canvas: Size): Rect {
	return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}

// Centered on `area`, unscaled.
export function areaTransform(area: Rect): Transform {
	return {
		...identityTransform,
		x: area.x + area.width / 2,
		y: area.y + area.height / 2,
	};
}
