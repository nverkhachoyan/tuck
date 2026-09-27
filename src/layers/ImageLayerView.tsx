import {
	Group,
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
 * origin, mirrored there if it's flipped, and colored by its adjustments.
 * Callers position it with the layer's transform. A live `matrix` (a shared
 * value) colors it instead, while a control is changing its adjustments.
 */
export function ImageLayerView({
	layer,
	image,
	matrix,
}: {
	layer: ImageLayer;
	image: SkImage;
	matrix?: { value: ColorMatrix };
}) {
	const { adjustments } = layer;
	const saved = useMemo(
		() => adjustments && adjustmentMatrix(adjustments),
		[adjustments],
	);
	const filter = matrix ?? saved;
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			<SkiaImage
				image={image}
				x={-layer.width / 2}
				y={-layer.height / 2}
				width={layer.width}
				height={layer.height}
				fit="fill"
			>
				{filter && <SkiaColorMatrix matrix={filter} />}
			</SkiaImage>
		</Group>
	);
}
