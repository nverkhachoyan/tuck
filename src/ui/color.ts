const HEX = /^#([0-9a-f]{6})$/i;

/** Red, green, and blue, 0 to 255 each. */
export type Rgb = [number, number, number];

/** A `#RRGGBB` color's channels, or null if it isn't one. */
export function parseHex(hex: string): Rgb | null {
	const match = HEX.exec(hex);
	if (!match) return null;
	const channels = Number.parseInt(match[1], 16);
	return [(channels >> 16) & 255, (channels >> 8) & 255, channels & 255];
}

/** Channels as `#RRGGBB` in capitals, each rounded and clamped to 0–255. */
export function toHex(rgb: Rgb): string {
	const channels = rgb.map((channel) =>
		Math.round(Math.min(255, Math.max(0, channel)))
			.toString(16)
			.padStart(2, "0"),
	);
	return `#${channels.join("")}`.toUpperCase();
}

/** Whether `value` is a color as the app keeps them: `#RRGGBB`. */
export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && HEX.test(value);
}

/**
 * The average of unpremultiplied RGBA pixels, 8 bits a channel, as
 * `#RRGGBB`, or null if they're all transparent. Each pixel counts as
 * much as it's opaque, so a see-through edge doesn't pull the average
 * toward whatever color its invisible pixels hold.
 */
export function averageColor(pixels: ArrayLike<number>): string | null {
	const sum: Rgb = [0, 0, 0];
	let weight = 0;
	for (let i = 0; i + 3 < pixels.length; i += 4) {
		const alpha = pixels[i + 3];
		sum[0] += pixels[i] * alpha;
		sum[1] += pixels[i + 1] * alpha;
		sum[2] += pixels[i + 2] * alpha;
		weight += alpha;
	}
	if (weight === 0) return null;
	return toHex(sum.map((channel) => channel / weight) as Rgb);
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
