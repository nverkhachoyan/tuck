import { type SkImage, Image as SkiaImage } from "@shopify/react-native-skia";
import type { ImageLayer } from "@/model/document";

/**
 * Draws an already-decoded image layer in its own space, centered on the
 * origin. Callers position it with the layer's transform.
 */
export function ImageLayerView({
	layer,
	image,
}: {
	layer: ImageLayer;
	image: SkImage;
}) {
	return (
		<SkiaImage
			image={image}
			x={-layer.width / 2}
			y={-layer.height / 2}
			width={layer.width}
			height={layer.height}
			fit="fill"
		/>
	);
}
