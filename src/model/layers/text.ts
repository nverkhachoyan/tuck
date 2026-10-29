import type { Rect, Size } from "../geometry.ts";
import { isColorOrNull, isFields, isPositive } from "../values.ts";
import {
	areaTransform,
	canvasArea,
	createLayerId,
	type LayerBase,
} from "./base.ts";

export type TextAlign = "left" | "center" | "right";

// Named for how they look; `editor/layers/text/fonts.ts` maps each to its bundled font.
export const textFonts = [
	"classic",
	"modern",
	"serif",
	"marker",
	"typewriter",
] as const;
export type TextFont = (typeof textFonts)[number];

// transform.x/y is the center of the text block in document space. Lines wrap
// at `maxWidth` (in the layer's own, unscaled space), and `\n` breaks a line.
export type TextLayer = LayerBase & {
	type: "text";
	text: string;
	font: TextFont;
	fontSize: number;
	color: string;
	outlineColor: string | null;
	// A filled box behind each line; null draws none.
	backgroundColor: string | null;
	align: TextAlign;
	maxWidth: number;
};

/**
 * What editing can change on an existing text layer. Its size is set once
 * at creation (`fontSize`); resizing it afterwards goes through its transform.
 */
export type TextLayerEdit = Partial<
	Pick<
		TextLayer,
		"text" | "align" | "font" | "color" | "outlineColor" | "backgroundColor"
	>
>;

/**
 * A new text layer's font size, relative to the shorter side of the area
 * it's placed in (the photo, or the part of it in view), so text starts out
 * looking the same on a 1080px screenshot and a 4000px camera photo. It's
 * fixed from then on: the layer's scale resizes it.
 */
export function initialFontSize(area: Size): number {
	return Math.max(1, Math.round(Math.min(area.width, area.height) * 0.08));
}

// Drawn faded in text being edited while it's empty, so the box reads as a
// place to type. Never part of the document.
export const TEXT_PLACEHOLDER = "Your text";

/** `layer` with the placeholder for its text while it has none. */
export function withPlaceholder<T extends { text: string }>(layer: T): T {
	return layer.text === "" ? { ...layer, text: TEXT_PLACEHOLDER } : layer;
}

export type TextLayerStyle = Pick<
	TextLayer,
	"font" | "color" | "outlineColor" | "backgroundColor" | "align"
>;

export const defaultTextStyle = {
	font: "classic",
	color: "#FFFFFF",
	outlineColor: "#000000",
	backgroundColor: null,
	align: "center",
} as const satisfies TextLayerStyle;

export function createTextLayer(
	canvas: Size,
	text: string,
	style: Partial<TextLayerStyle> = {},
	area: Rect = canvasArea(canvas),
): TextLayer {
	return {
		type: "text",
		id: createLayerId("text"),
		text,
		fontSize: initialFontSize(area),
		...defaultTextStyle,
		...style,
		// Meme captions span most of the photo before wrapping.
		maxWidth: area.width * 0.9,
		transform: areaTransform(area),
		hidden: false,
		locked: false,
	};
}

export function isTextLayer(value: unknown): boolean {
	return (
		isFields(value) &&
		value.type === "text" &&
		typeof value.text === "string" &&
		textFonts.some((font) => font === value.font) &&
		isPositive(value.fontSize) &&
		isPositive(value.maxWidth) &&
		typeof value.color === "string" &&
		isColorOrNull(value.outlineColor) &&
		isColorOrNull(value.backgroundColor) &&
		["left", "center", "right"].includes(value.align as string)
	);
}
