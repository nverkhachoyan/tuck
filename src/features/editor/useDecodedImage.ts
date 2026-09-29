import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { decodedImages } from "@/layers/decodedImages";

/**
 * An image file decoded for drawing, or null until it has decoded, if it
 * can't be, or without a `uri`. `onError` must be stable.
 */
export function useDecodedImage(
	uri: string | null,
	onError: (error: unknown) => void,
): SkImage | null {
	const [loaded, setLoaded] = useState<{ uri: string; image: SkImage } | null>(
		null,
	);

	useEffect(() => {
		if (uri === null) return;
		let active = true;
		const held = decodedImages.acquire(uri);
		held.decoded.then(
			(image) => {
				if (active) setLoaded({ uri, image });
			},
			(error: unknown) => {
				if (active) onError(error);
			},
		);
		return () => {
			active = false;
			held.release();
			// Forgotten with its hold: taking the same file back (a mask taken
			// off, then put back) waits for a new hold rather than drawing
			// this image, which the cache may have freed by then.
			setLoaded((current) => (current?.uri === uri ? null : current));
		};
	}, [uri, onError]);

	// Never an image this component has let go of.
	return loaded?.uri === uri ? loaded.image : null;
}
