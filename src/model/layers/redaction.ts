import { type Rect, toDocumentSpace } from "../geometry.ts";
import { type MaskStroke, recenterDrawing } from "../strokes.ts";
import { createLayerId, identityTransform, type LayerBase } from "./base.ts";
import type { ImageLayer } from "./image.ts";

/**
 * How a redaction hides what's under it: covered with a color, blurred, or
 * pixelated. `radius` is the blur's sigma, and `size` a pixel's side, in
 * document pixels, however the layer is scaled, so resizing one never
 * weakens it.
 */
export type RedactionEffect =
	| { type: "solid"; color: string }
	| { type: "blur"; radius: number }
	| { type: "pixelate"; size: number };

export function effectsEqual(
	left: RedactionEffect,
	right: RedactionEffect,
): boolean {
	switch (left.type) {
		case "solid":
			return right.type === "solid" && left.color === right.color;
		case "blur":
			return right.type === "blur" && left.radius === right.radius;
		case "pixelate":
			return right.type === "pixelate" && left.size === right.size;
	}
}

type RedactionBase = LayerBase & {
	type: "redaction";
	effect: RedactionEffect;
};

/** A redaction over a box `width` by `height`, centered on its origin. */
export type RedactionBox = RedactionBase & {
	shape: "box";
	width: number;
	height: number;
};

/** The geometry of a box redaction before it becomes a document layer. */
export type RedactionBoxPlacement = Pick<
	RedactionBox,
	"width" | "height" | "transform"
>;

/**
 * A redaction over strokes painted across what to hide, in its own space
 * and centered like a drawing's (see `recenterDrawing`).
 */
export type RedactionStrokes = RedactionBase & {
	shape: "strokes";
	strokes: MaskStroke[];
};

/**
 * A redaction over a selection: inside a box `width` by `height`, centered
 * on its origin, as far as `mask`, an image file stretched over the box,
 * covers it. Opaque in the mask hides what's under it, transparent leaves
 * it, so a soft edge fades. Its proportions hold, so its handles scale it.
 */
export type RedactionMask = RedactionBase & {
	shape: "mask";
	mask: string;
	width: number;
	height: number;
};

export type RedactionLayer = RedactionBox | RedactionStrokes | RedactionMask;

/** A redaction covering `rect`, a box in document space. */
export function createRedactionBox(
	rect: Rect,
	effect: RedactionEffect,
): RedactionBox {
	return createPlacedRedactionBox(
		{
			width: rect.width,
			height: rect.height,
			transform: {
				...identityTransform,
				x: rect.x + rect.width / 2,
				y: rect.y + rect.height / 2,
			},
		},
		effect,
	);
}

/** A box redaction with its complete oriented placement. */
export function createPlacedRedactionBox(
	placement: RedactionBoxPlacement,
	effect: RedactionEffect,
): RedactionBox {
	return {
		type: "redaction",
		id: createLayerId("redaction"),
		effect,
		shape: "box",
		...placement,
		hidden: false,
		locked: false,
	};
}

/** A redaction begun by a pen stroke in document space, like a drawing. */
export function createRedactionStrokes(
	stroke: MaskStroke & { type: "pen" },
	effect: RedactionEffect,
): RedactionStrokes {
	return recenterDrawing<RedactionStrokes>({
		type: "redaction",
		id: createLayerId("redaction"),
		effect,
		shape: "strokes",
		strokes: [stroke],
		transform: identityTransform,
		hidden: false,
		locked: false,
	});
}

/**
 * A redaction over a selection on `image`: `mask`, covering `rect` of the
 * image's pixels as it shows (flipped, if it is), from its top left. It
 * turns and scales with the image, so it lands on what was selected.
 */
export function createMaskedRedaction(
	image: ImageLayer,
	mask: string,
	rect: Rect,
	effect: RedactionEffect,
): RedactionMask {
	const center = toDocumentSpace(image.transform, {
		x: rect.x + rect.width / 2 - image.width / 2,
		y: rect.y + rect.height / 2 - image.height / 2,
	});
	return {
		type: "redaction",
		id: createLayerId("redaction"),
		effect,
		shape: "mask",
		mask,
		width: rect.width,
		height: rect.height,
		transform: { ...image.transform, ...center },
		hidden: false,
		locked: false,
	};
}
