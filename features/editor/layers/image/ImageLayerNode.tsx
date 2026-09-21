import { Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import type { ImageLayer } from "@/features/editor/model/document";

/** Draws an image layer at its document-space size. */
export function ImageLayerNode({ layer }: { layer: ImageLayer }) {
	const image = useImage(layer.uri);
	if (!image) return null;
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
