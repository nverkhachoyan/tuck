import { useEffect, useRef, useState } from "react";
import type { SkImage } from "react-native-skia";
import { decodedImages } from "./decodedImages";
import type { HeldImage } from "./imageCache";

type Shown = { uri: string | null; image: SkImage | null };

/**
 * An image file decoded for drawing. While a new `uri` decodes, it's still
 * the image before (or null, if there was none), so changing the file
 * doesn't blank what's drawn. Null without a `uri`, and undefined until
 * there's an image to draw: before the first has decoded, or once one
 * couldn't be. `onError` must be stable.
 */
export function useDecodedImage(
	uri: string | null,
	onError: (error: unknown) => void,
): SkImage | null | undefined {
	const [shown, setShown] = useState<Shown | undefined>(() =>
		uri === null ? { uri, image: null } : undefined,
	);
	// The hold on `shown`'s image, let go of only as `shown` moves on, so
	// it's never an image the cache may have freed.
	const held = useRef<HeldImage | null>(null);

	useEffect(() => {
		const show = (next: Shown | undefined, hold: HeldImage | null) => {
			held.current?.release();
			held.current = hold;
			setShown((current) =>
				current?.uri === next?.uri && current?.image === next?.image
					? current
					: next,
			);
		};
		if (uri === null) {
			show({ uri, image: null }, null);
			return;
		}
		let pending = true;
		const hold = decodedImages.acquire(uri);
		hold.decoded.then(
			(image) => {
				if (!pending) return;
				pending = false;
				show({ uri, image }, hold);
			},
			(error: unknown) => {
				if (!pending) return;
				pending = false;
				hold.release();
				show(undefined, null);
				onError(error);
			},
		);
		return () => {
			// Replaced before it decoded, it was never shown.
			if (!pending) return;
			pending = false;
			hold.release();
		};
	}, [uri, onError]);

	useEffect(
		() => () => {
			held.current?.release();
			held.current = null;
			setShown(undefined);
		},
		[],
	);

	return uri === null ? null : shown?.image;
}
