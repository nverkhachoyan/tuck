import {
	Group,
	Mask,
	type SkImage,
	ColorMatrix as SkiaColorMatrix,
	Image as SkiaImage,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { adjustmentMatrix, type ColorMatrix } from "@/model/adjustments";
import type { ImageLayer } from "@/model/document";

const MIRRORED = [{ scaleX: -1 }];

/**
 * Draws an already-decoded image layer in its own space, centered on the
 * origin, mirrored there if it's flipped, colored by its adjustments, and
 * shown through its decoded `mask` when it has one. Callers position it with
 * the layer's transform. A live `matrix` (a shared value) colors it instead,
 * while a control is changing its adjustments.
 */
export function ImageLayerView({
	layer,
	image,
	mask,
	matrix,
}: {
	layer: ImageLayer;
	image: SkImage;
	mask?: SkImage;
	matrix?: { value: ColorMatrix };
}) {
	const { adjustments } = layer;
	const saved = useMemo(
		() => adjustments && adjustmentMatrix(adjustments),
		[adjustments],
	);
	const filter = matrix ?? saved;
	const box = {
		x: -layer.width / 2,
		y: -layer.height / 2,
		width: layer.width,
		height: layer.height,
		fit: "fill",
	} as const;
	const content = (
		<SkiaImage image={image} {...box}>
			{filter && <SkiaColorMatrix matrix={filter} />}
		</SkiaImage>
	);
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			{mask ? (
				// The mask covers the image exactly, so nothing needs clipping
				// to it, which would draw the image twice.
				<Mask
					mode="luminance"
					clip={false}
					mask={<SkiaImage image={mask} {...box} />}
				>
					{content}
				</Mask>
			) : (
				content
			)}
		</Group>
	);
}
