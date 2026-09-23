import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { decodeImage } from "@/layers/ImageLayerView";

type Entry = { decoded: Promise<SkImage>; users: number };

// Decoded images by URI, shared by everything drawing the same one: the
// canvas, the crop tool, and duplicated photos all hold a single copy.
const cache = new Map<string, Entry>();

function acquire(uri: string): Entry {
	let entry = cache.get(uri);
	if (!entry) {
		const decoded = decodeImage(uri);
		const created: Entry = { decoded, users: 0 };
		// A failed decode is tried again by the next user.
		decoded.catch(() => {
			if (cache.get(uri) === created) cache.delete(uri);
		});
		cache.set(uri, created);
		entry = created;
	}
	entry.users += 1;
	return entry;
}

// Freed a moment later, so a user that takes the image straight back (a
// remount) reuses it rather than decoding it again.
function release(uri: string, entry: Entry) {
	entry.users -= 1;
	setTimeout(() => {
		// Two users letting go together both get here; only the one that
		// evicts the entry frees it.
		if (entry.users > 0 || cache.get(uri) !== entry) return;
		cache.delete(uri);
		entry.decoded.then(
			(image) => image.dispose(),
			() => {},
		);
	}, 0);
}

/**
 * An image file decoded for drawing, or null until it has decoded or if it
 * can't be. `onError` must be stable.
 */
export function useDecodedImage(
	uri: string,
	onError: (error: unknown) => void,
): SkImage | null {
	const [loaded, setLoaded] = useState<{ uri: string; image: SkImage } | null>(
		null,
	);

	useEffect(() => {
		let active = true;
		const entry = acquire(uri);
		entry.decoded.then(
			(image) => {
				if (active) setLoaded({ uri, image });
			},
			(error: unknown) => {
				if (active) onError(error);
			},
		);
		return () => {
			active = false;
			release(uri, entry);
		};
	}, [uri, onError]);

	// Never an image this component has let go of.
	return loaded?.uri === uri ? loaded.image : null;
}
