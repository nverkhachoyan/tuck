import { Rect, type SkRect } from "@shopify/react-native-skia";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { ImageLayer, Layer } from "@/model/document";
import { Checkerboard } from "@/ui/Checkerboard";
import { useDecodedImage } from "./useDecodedImage";

// What the editor's canvas and the crop tool's both draw.

// A transparency checkerboard square's side, in screen pixels.
const CHECKER_PX = 8;

/** The canvas's fill, or a checkerboard where it's transparent. */
export function CanvasBackground({
	bounds,
	background,
	viewScale,
}: {
	bounds: SkRect;
	background: string | null;
	// Screen pixels per unit of `bounds`.
	viewScale: number;
}) {
	if (background === null) {
		return <Checkerboard bounds={bounds} cell={CHECKER_PX / viewScale} />;
	}
	return <Rect rect={bounds} color={background} />;
}

/** A layer's content in its own space, loading images asynchronously. */
export function LayerContent({
	layer,
	onImageError,
}: {
	layer: Layer;
	onImageError: (error: unknown) => void;
}) {
	switch (layer.type) {
		case "image":
			return <AsyncImage layer={layer} onError={onImageError} />;
		case "text":
			return <TextLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}

/** Draws nothing until the image has decoded, or if it can't be. */
function AsyncImage({
	layer,
	onError,
}: {
	layer: ImageLayer;
	onError: (error: unknown) => void;
}) {
	const image = useDecodedImage(layer.uri, onError);
	if (!image) return null;
	return <ImageLayerView layer={layer} image={image} />;
}
