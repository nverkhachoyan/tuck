import type { SkImage } from "react-native-skia";

/** A decoded image, kept in memory until its holder calls `release`. */
export type HeldImage = { decoded: Promise<SkImage>; release: () => void };

export type ImageCache = { acquire: (uri: string) => HeldImage };

// `releases` counts the releases so far, so only the latest one frees.
type Entry = { decoded: Promise<SkImage>; users: number; releases: number };

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
		entry.releases += 1;
		const latest = entry.releases;
		later(() => {
			// Only the last user's release frees it, `later` after that user
			// let go: an earlier release's wait, started while another user
			// still drew the image, may end just after that user lets go.
			if (
				entry.users > 0 ||
				entry.releases !== latest ||
				entries.get(uri) !== entry
			) {
				return;
			}
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
				const created: Entry = { decoded, users: 0, releases: 0 };
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
