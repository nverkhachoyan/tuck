import { isHexColor } from "../../../model/color.ts";
import {
	defaultTextStyle,
	type TextAlign,
	type TextLayerEdit,
	type TextLayerStyle,
	textFonts,
} from "../../../model/layers/text.ts";

/** A text layer's colors, which its Color, Outline, and Box tabs pick. */
export type TextColorKey = "color" | "outlineColor" | "backgroundColor";

const ALIGNS: TextAlign[] = ["left", "center", "right"];

/**
 * The style new text starts in, from what an earlier session saved, which
 * may be from an older build, or damaged: each part that isn't valid is the
 * default's. An outline or box saved as off stays off.
 */
export function parseTextStyle(saved: unknown): TextLayerStyle {
	if (typeof saved !== "object" || saved === null) return defaultTextStyle;
	const { font, color, outlineColor, backgroundColor, align } = saved as Record<
		string,
		unknown
	>;
	const optionalColor = (value: unknown, fallback: string | null) =>
		value === null || isHexColor(value) ? value : fallback;
	return {
		font: textFonts.find((each) => each === font) ?? defaultTextStyle.font,
		color: isHexColor(color) ? color : defaultTextStyle.color,
		outlineColor: optionalColor(outlineColor, defaultTextStyle.outlineColor),
		backgroundColor: optionalColor(
			backgroundColor,
			defaultTextStyle.backgroundColor,
		),
		align: ALIGNS.find((each) => each === align) ?? defaultTextStyle.align,
	};
}

/** `style` with whatever of it an edit to some text changed. */
export function withTextEdit(
	style: TextLayerStyle,
	edit: TextLayerEdit,
): TextLayerStyle {
	const next = { ...style };
	for (const key of Object.keys(style) as (keyof TextLayerStyle)[]) {
		const value = edit[key];
		if (value !== undefined) Object.assign(next, { [key]: value });
	}
	return next;
}
