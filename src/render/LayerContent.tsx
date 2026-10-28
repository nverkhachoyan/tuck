import type { ReactNode } from "react";
import type { ColorMatrix } from "@/model/adjustments";
import { assertNever } from "@/model/assertNever";
import type { ImageLayer } from "@/model/layers/image";
import type { Layer } from "@/model/layers/layer";
import type { RedactionMask } from "@/model/layers/redaction";
import { DrawingLayerView } from "./layers/DrawingLayerView";
import { ImageLayerView } from "./layers/ImageLayerView";
import { RedactionLayerView } from "./layers/RedactionLayerView";
import { ShapeLayerView } from "./layers/ShapeLayerView";
import { TextLayerView } from "./layers/TextLayerView";
import { useDecodedImage } from "./useDecodedImage";

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
	if (!image || mask === undefined) return null;
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
