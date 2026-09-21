import { useImage } from "@shopify/react-native-skia";
import type { ImageLayer } from "@/features/editor/model/document";
import { ImageLayerView } from "./ImageLayerView";

/** Loads an image layer asynchronously, for the live editor canvas. */
export function ImageLayerNode({ layer }: { layer: ImageLayer }) {
	const image = useImage(layer.uri);
	if (!image) return null;
	return <ImageLayerView layer={layer} image={image} />;
}
