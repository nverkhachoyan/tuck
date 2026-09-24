import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { decodedImages } from "@/layers/ImageLayerView";

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
		};
	}, [uri, onError]);

	// Never an image this component has let go of.
	return loaded?.uri === uri ? loaded.image : null;
}
