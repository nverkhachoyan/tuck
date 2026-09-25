/**
 * A color as a color picker holds it: `hue` in degrees (0 to 360), and
 * `saturation` and `value` (brightness) from 0 to 1. Unlike hex, it keeps a
 * hue through white, grays, and black, where hex has none.
 */
export type Hsv = { hue: number; saturation: number; value: number };

const HEX = /^#([0-9a-f]{6})$/i;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
	const match = HEX.exec(hex);
	if (!match) return null;
	const channels = Number.parseInt(match[1], 16);
	return [(channels >> 16) & 255, (channels >> 8) & 255, channels & 255];
}

function toHex(rgb: Rgb): string {
	const channels = rgb.map((channel) =>
		Math.round(Math.min(255, Math.max(0, channel)))
			.toString(16)
			.padStart(2, "0"),
	);
	return `#${channels.join("")}`.toUpperCase();
}

const TYPED_HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * A hex color as someone might type it, as `#RRGGBB` in capitals, or null
 * if it isn't one. The `#` is optional, and three digits stand for six, as
 * in CSS (`#F80` is `#FF8800`).
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

/** `#RRGGBB`, in capitals like the swatches', for a color picker's color. */
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
 * A `#RRGGBB` color in HSV, or null if it isn't one. A gray has no hue of
 * its own, so it takes `fallbackHue`: the picker's, so dragging to white or
 * black and back doesn't lose it.
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
 * `#RRGGBB` `amount` of the way from `from` to `to` (0 is `from`, 1 is
 * `to`). A color that isn't `#RRGGBB` comes back as it is.
 */
export function mixColors(from: string, to: string, amount: number): string {
	const start = parseHex(from);
	const end = parseHex(to);
	if (!start || !end) return from;
	return toHex(
		[0, 1, 2].map((i) => start[i] + (end[i] - start[i]) * amount) as Rgb,
	);
}
