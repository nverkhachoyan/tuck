import { Rect, type SkRect } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { DrawingLayerView } from "@/layers/DrawingLayerView";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { RedactionLayerView } from "@/layers/RedactionLayerView";
import { ShapeLayerView } from "@/layers/ShapeLayerView";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { ColorMatrix } from "@/model/adjustments";
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
 * `stroke` is one still being drawn on a drawing layer, or on an image's
 * cut, which `showRemoved` shows what it cuts away from; `matrix` colors an
 * image in place of its adjustments (see `ImageLayerView`).
 */
export function LayerContent({
	layer,
	stroke,
	matrix,
	showRemoved,
	onImageError,
}: {
	layer: Layer;
	stroke?: ReactNode;
	matrix?: { value: ColorMatrix };
	showRemoved?: boolean;
	onImageError: (error: unknown) => void;
}) {
	switch (layer.type) {
		case "image":
			return (
				<AsyncImage
					layer={layer}
					matrix={matrix}
					liveMask={stroke}
					showRemoved={showRemoved}
					onError={onImageError}
				/>
			);
		case "text":
			return <TextLayerView layer={layer} />;
		case "drawing":
			return <DrawingLayerView layer={layer}>{stroke}</DrawingLayerView>;
		case "redaction":
			return <RedactionLayerView layer={layer} />;
		case "shape":
			return <ShapeLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}

/**
 * Draws nothing until the image, and its mask if it has one, have decoded,
 * or if either can't be: a cut-out never shows its background meanwhile.
 */
function AsyncImage({
	layer,
	matrix,
	liveMask,
	showRemoved,
	onError,
}: {
	layer: ImageLayer;
	matrix?: { value: ColorMatrix };
	liveMask?: ReactNode;
	showRemoved?: boolean;
	onError: (error: unknown) => void;
}) {
	const image = useDecodedImage(layer.uri, onError);
	const mask = useDecodedImage(layer.mask ?? null, onError);
	if (!image || (layer.mask && !mask)) return null;
	return (
		<ImageLayerView
			layer={layer}
			image={image}
			mask={mask ?? undefined}
			matrix={matrix}
			liveMask={liveMask}
			showRemoved={showRemoved}
		/>
	);
}
