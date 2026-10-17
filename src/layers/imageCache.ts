import type { SkImage } from "@shopify/react-native-skia";

/** A decoded image, kept in memory until its holder calls `release`. */
export type HeldImage = { decoded: Promise<SkImage>; release: () => void };

export type ImageCache = { acquire: (uri: string) => HeldImage };

type Entry = { decoded: Promise<SkImage>; users: number };

/**
 * Decoded images by URI, shared by everyone holding the same one and freed
 * once they've all released it, when `later` runs what it's given (see
 * `decodedImages` for why that waits).
 */
export function createImageCache(
	decode: (uri: string) => Promise<SkImage>,
	later: (free: () => void) => void = (free) => setTimeout(free, 0),
): ImageCache {
	const entries = new Map<string, Entry>();

	// Freed later, so a user that takes the image straight back (a remount)
	// reuses it rather than decoding it again.
	function release(uri: string, entry: Entry) {
		entry.users -= 1;
		later(() => {
			// Two users letting go together both get here; only the one that
			// evicts the entry frees it.
			if (entry.users > 0 || entries.get(uri) !== entry) return;
			entries.delete(uri);
			entry.decoded.then(
				(image) => image.dispose(),
				() => {},
			);
		});
	}

	return {
		acquire(uri) {
			let entry = entries.get(uri);
			if (!entry) {
				const decoded = decode(uri);
				const created: Entry = { decoded, users: 0 };
				// A failed decode is tried again by the next user.
				decoded.catch(() => {
					if (entries.get(uri) === created) entries.delete(uri);
				});
				entries.set(uri, created);
				entry = created;
			}
			entry.users += 1;
			return { decoded: entry.decoded, release: () => release(uri, entry) };
		},
	};
}
