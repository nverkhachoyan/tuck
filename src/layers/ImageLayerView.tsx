import {
	Group,
	type SkImage,
	Image as SkiaImage,
} from "@shopify/react-native-skia";
import type { ImageLayer } from "@/model/document";

const MIRRORED = [{ scaleX: -1 }];

/**
 * Draws an already-decoded image layer in its own space, centered on the
 * origin, and mirrored there if it's flipped. Callers position it with the
 * layer's transform.
 */
export function ImageLayerView({
	layer,
	image,
}: {
	layer: ImageLayer;
	image: SkImage;
}) {
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			<SkiaImage
				image={image}
				x={-layer.width / 2}
				y={-layer.height / 2}
				width={layer.width}
				height={layer.height}
				fit="fill"
			/>
		</Group>
	);
}
