import { type SkImage, Image as SkiaImage } from "@shopify/react-native-skia";
import type { ImageLayer } from "@/features/editor/model/document";

/** Draws an already-decoded image layer at its document-space size. */
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
			x={layer.transform.x}
			y={layer.transform.y}
			width={layer.width}
			height={layer.height}
			fit="fill"
		/>
	);
}
