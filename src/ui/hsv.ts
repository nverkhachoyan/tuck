import { parseHex, type Rgb, toHex } from "./color.ts";

/**
 * A color as a color picker holds it: `hue` in degrees (0 to 360), and
 * `saturation` and `value` (brightness) from 0 to 1.
 */
export type Hsv = { hue: number; saturation: number; value: number };

const TYPED_HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parses user-typed hex text into `#RRGGBB` or null.
 * Accepts optional leading `#` and 3-digit shorthand.
 */
export function parseTypedHex(text: string): string | null {
	const match = TYPED_HEX.exec(text.trim());
	if (!match) return null;
	const digits =
		match[1].length === 3
			? [...match[1]].map((digit) => digit + digit).join("")
			: match[1];
	return `#${digits.toUpperCase()}`;
}

/** Converts HSV to `#RRGGBB` in uppercase. */
export function hsvToHex({ hue, saturation, value }: Hsv): string {
	const h = (((hue % 360) + 360) % 360) / 60;
	const chroma = value * saturation;
	const x = chroma * (1 - Math.abs((h % 2) - 1));
	const [r, g, b]: Rgb =
		h < 1
			? [chroma, x, 0]
			: h < 2
				? [x, chroma, 0]
				: h < 3
					? [0, chroma, x]
					: h < 4
						? [0, x, chroma]
						: h < 5
							? [x, 0, chroma]
							: [chroma, 0, x];
	const m = value - chroma;
	return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/**
 * Converts `#RRGGBB` into HSV or null.
 * Grays retain `fallbackHue` so white or black drags preserve chosen hue.
 */
export function hexToHsv(hex: string, fallbackHue = 0): Hsv | null {
	const rgb = parseHex(hex);
	if (!rgb) return null;
	const [r, g, b] = rgb.map((channel) => channel / 255);
	const max = Math.max(r, g, b);
	const chroma = max - Math.min(r, g, b);
	let hue = fallbackHue;
	if (chroma > 0) {
		if (max === r) hue = 60 * (((g - b) / chroma + 6) % 6);
		else if (max === g) hue = 60 * ((b - r) / chroma + 2);
		else hue = 60 * ((r - g) / chroma + 4);
	}
	return { hue, saturation: max === 0 ? 0 : chroma / max, value: max };
}

/**
 * Maps a 1D tone along White -> Pure Hue -> Black (0 to 1) to an HSV color.
 * - Tone <= 0.5: shades from White (0) to Pure Hue (0.5).
 * - Tone > 0.5: shades from Pure Hue (0.5) to Black (1.0).
 */
export function toneToHsv(hue: number, tone: number): Hsv {
	const t = Math.min(1, Math.max(0, tone));
	if (t <= 0.5) {
		return { hue, saturation: t * 2, value: 1 };
	}
	return { hue, saturation: 1, value: 1 - (t - 0.5) * 2 };
}

/**
 * Projects an HSV color onto a 1D tone from White (0) through Pure Hue (0.5) to Black (1).
 * Maps inverse Lightness (1 - L) so all grays and hues round-trip with toneToHsv.
 */
export function hsvToTone({ saturation, value }: Hsv): number {
	const tone = 1 - value * (1 - saturation / 2);
	return Math.min(1, Math.max(0, tone));
}

/** CSS linear-gradient string for the 1D tone bar across white, pure hue, and black. */
export function toneGradientCss(pureHex: string): string {
	return `linear-gradient(to right, #FFFFFF 0%, ${pureHex} 50%, #000000 100%)`;
}
