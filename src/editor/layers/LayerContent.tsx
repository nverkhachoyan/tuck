import type { ReactNode } from "react";
import { assertNever } from "../document/assertNever";
import { useDecodedImage } from "../render/useDecodedImage";
import { DrawingLayerView } from "./drawing/DrawingLayerView";
import type { ColorMatrix } from "./image/adjustments";
import { ImageLayerView } from "./image/ImageLayerView";
import type { ImageLayer } from "./image/image";
import type { Layer } from "./layer";
import { RedactionLayerView } from "./redaction/RedactionLayerView";
import type { RedactionMask } from "./redaction/redaction";
import { ShapeLayerView } from "./shape/ShapeLayerView";
import { TextLayerView } from "./text/TextLayerView";

/**
 * A layer's content in its own space, loading images asynchronously.
 * `stroke` is one still being drawn on a drawing layer, or on an image's
 * cut, which `selectionColor` shows as a selection; `matrix` colors an
 * image in place of its adjustments (see `ImageLayerView`).
 */
export function LayerContent({
	layer,
	stroke,
	matrix,
	selectionColor,
	onImageError,
}: {
	layer: Layer;
	stroke?: ReactNode;
	matrix?: { value: ColorMatrix };
	selectionColor?: string;
	onImageError: (error: unknown) => void;
}) {
	switch (layer.type) {
		case "image":
			return (
				<AsyncImage
					layer={layer}
					matrix={matrix}
					liveMask={stroke}
					selectionColor={selectionColor}
					onError={onImageError}
				/>
			);
		case "text":
			return <TextLayerView layer={layer} />;
		case "drawing":
			return <DrawingLayerView layer={layer}>{stroke}</DrawingLayerView>;
		case "redaction":
			return layer.shape === "mask" ? (
				<AsyncMaskedRedaction layer={layer} onError={onImageError} />
			) : (
				<RedactionLayerView layer={layer} />
			);
		case "shape":
			return <ShapeLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}

/**
 * Draws nothing until the image, and its mask if it has one, have decoded,
 * or if either can't be: a cut-out never shows its background meanwhile.
 * A new mask shows once it has decoded, and the one before it until then.
 * A cut shown as a selection hides nothing, so the image shows meanwhile.
 */
function AsyncImage({
	layer,
	matrix,
	liveMask,
	selectionColor,
	onError,
}: {
	layer: ImageLayer;
	matrix?: { value: ColorMatrix };
	liveMask?: ReactNode;
	selectionColor?: string;
	onError: (error: unknown) => void;
}) {
	const image = useDecodedImage(layer.uri, onError);
	const mask = useDecodedImage(layer.mask ?? null, onError);
	if (!image || (mask === undefined && !selectionColor)) return null;
	return (
		<ImageLayerView
			layer={layer}
			image={image}
			mask={mask ?? undefined}
			matrix={matrix}
			liveMask={liveMask}
			selectionColor={selectionColor}
		/>
	);
}

/** Draws nothing until a masked redaction's mask has decoded. */
function AsyncMaskedRedaction({
	layer,
	onError,
}: {
	layer: RedactionMask;
	onError: (error: unknown) => void;
}) {
	const mask = useDecodedImage(layer.mask, onError);
	return mask ? <RedactionLayerView layer={layer} mask={mask} /> : null;
}
