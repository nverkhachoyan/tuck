/** The colors every color picker offers first, with their names. */
export const SWATCHES = [
	{ color: "#FFFFFF", name: "White" },
	{ color: "#000000", name: "Black" },
	{ color: "#FF3B30", name: "Red" },
	{ color: "#FFD60A", name: "Yellow" },
	{ color: "#34C759", name: "Green" },
	{ color: "#0A84FF", name: "Blue" },
] as const;

/** The name of the swatch `color` is, whatever its case, or null. */
export function swatchName(color: string): string | null {
	const upper = color.toUpperCase();
	return SWATCHES.find((swatch) => swatch.color === upper)?.name ?? null;
}
