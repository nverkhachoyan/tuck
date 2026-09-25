import { Rect, type SkRect } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { DrawingLayerView } from "@/layers/DrawingLayerView";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { ImageLayer, Layer } from "@/model/document";
import { CHECKER_CELL } from "@/theme";
import { Checkerboard } from "@/ui/Checkerboard";
import { useDecodedImage } from "./useDecodedImage";

// What the editor's canvas and the crop tool's both draw.

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
		return <Checkerboard bounds={bounds} cell={CHECKER_CELL / viewScale} />;
	}
	return <Rect rect={bounds} color={background} />;
}

/**
 * A layer's content in its own space, loading images asynchronously.
 * `stroke` is one still being drawn on a drawing layer.
 */
export function LayerContent({
	layer,
	stroke,
	onImageError,
}: {
	layer: Layer;
	stroke?: ReactNode;
	onImageError: (error: unknown) => void;
}) {
	switch (layer.type) {
		case "image":
			return <AsyncImage layer={layer} onError={onImageError} />;
		case "text":
			return <TextLayerView layer={layer} />;
		case "drawing":
			return <DrawingLayerView layer={layer}>{stroke}</DrawingLayerView>;
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
