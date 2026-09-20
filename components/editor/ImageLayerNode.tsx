import { Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import type { ImageLayer } from "../../lib/editor-document";

export function ImageLayerNode({
	layer,
	x,
	y,
	width,
	height,
}: {
	layer: ImageLayer;
	x: number;
	y: number;
	width: number;
	height: number;
}) {
	const image = useImage(layer.uri);
	if (!image) return null;
	return <SkiaImage image={image} x={x} y={y} width={width} height={height} fit="fill" />;
}
