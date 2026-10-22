// Stickers people save from their own images, kept on the device outside any
// project: placing one copies its image into the project, like a bundled
// sticker's, so removing it later never breaks a project.
// `stickerStorage.ts` (or `.web.ts`) keeps them; this is the pure part.

/** An image ready to become a sticker or a layer, as a URI it may take. */
export type StickerImage = {
	uri: string;
	width: number;
	height: number;
	// A JPEG if every pixel is opaque, else a PNG.
	opaque: boolean;
};

export type SavedSticker = {
	id: string;
	width: number;
	height: number;
	opaque: boolean;
	// When it was saved or last placed: the most recent come first.
	usedAt: number;
};

// A saved sticker's longer side, at most, in pixels: twice a bundled one's,
// since it may be a logo or a cutout people want to use large.
export const SAVED_STICKER_MAX_SIDE = 1024;

// Bump when the index's format changes, and teach `parseStickerIndex` to read
// the older one.
const INDEX_VERSION = 1;

export function newStickerId(now: number): string {
	return `sticker-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function stickerFileName({
	id,
	opaque,
}: Pick<SavedSticker, "id" | "opaque">): string {
	return `${id}.${opaque ? "jpg" : "png"}`;
}

export function isSavedSticker(value: unknown): value is SavedSticker {
	if (typeof value !== "object" || value === null) return false;
	const { id, width, height, opaque, usedAt } = value as Record<
		string,
		unknown
	>;
	return (
		typeof id === "string" &&
		/^sticker-[a-z0-9-]+$/.test(id) &&
		isPositive(width) &&
		isPositive(height) &&
		typeof opaque === "boolean" &&
		typeof usedAt === "number" &&
		Number.isFinite(usedAt)
	);
}

function isPositive(value: unknown): boolean {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function recentFirst<T extends SavedSticker>(stickers: T[]): T[] {
	return stickers.slice().sort((a, b) => b.usedAt - a.usedAt);
}

/**
 * The stickers in a saved index, most recently used first, leaving out any
 * that aren't valid. An index that can't be read at all holds none.
 */
export function parseStickerIndex(json: string | null): SavedSticker[] {
	if (json === null) return [];
	try {
		const value: unknown = JSON.parse(json);
		if (
			typeof value !== "object" ||
			value === null ||
			(value as { version?: unknown }).version !== INDEX_VERSION
		) {
			return [];
		}
		const { stickers } = value as { stickers?: unknown };
		return Array.isArray(stickers)
			? recentFirst(stickers.filter(isSavedSticker))
			: [];
	} catch {
		return [];
	}
}

export function serializeStickerIndex(stickers: SavedSticker[]): string {
	return JSON.stringify({ version: INDEX_VERSION, stickers });
}

/** The stickers with `id` marked as used at `now`, which moves it first. */
export function withStickerUsed<T extends SavedSticker>(
	stickers: T[],
	id: string,
	now: number,
): T[] {
	return recentFirst(
		stickers.map((sticker) =>
			sticker.id === id ? { ...sticker, usedAt: now } : sticker,
		),
	);
}
