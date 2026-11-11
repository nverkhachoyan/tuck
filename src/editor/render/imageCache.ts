import type { SkImage } from "react-native-skia";

/** A decoded image, kept in memory until its holder calls `release`. */
export type HeldImage = { decoded: Promise<SkImage>; release: () => void };

/** A point-in-time snapshot of the cache's size and memory usage. */
export type ImageCacheSnapshot = {
	count: number;
	bytes: number;
};

export type ImageCache = {
	acquire: (uri: string) => HeldImage;
	snapshot: () => ImageCacheSnapshot;
};

// `releases` counts the releases so far, so only the latest one frees.
type Entry = {
	decoded: Promise<SkImage>;
	resolved?: SkImage;
	users: number;
	releases: number;
};

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
			// still drew the image, may end just after that user lets go. See
			// docs/GOTCHAS.md, "A delayed free can belong to an earlier release".
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
				decoded.then(
					(image) => {
						created.resolved = image;
					},
					() => {},
				);
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
		snapshot() {
			let bytes = 0;
			for (const entry of entries.values()) {
				if (entry.resolved) {
					const w =
						typeof entry.resolved.width === "function"
							? entry.resolved.width()
							: 0;
					const h =
						typeof entry.resolved.height === "function"
							? entry.resolved.height()
							: 0;
					bytes += w * h * 4;
				}
			}
			return {
				count: entries.size,
				bytes,
			};
		},
	};
}
