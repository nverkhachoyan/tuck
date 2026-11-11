import type { ReactNode } from "react";
import { LayerView } from "../render/LayerView";
import { useDecodedImage } from "../render/useDecodedImage";
import type { ColorMatrix } from "./image/adjustments";
import type { ImageLayer } from "./image/image";
import type { Layer } from "./layer";
import type { RedactionMask } from "./redaction/redaction";

/**
 * A layer's content in its own space, loading images asynchronously.
 * `stroke` is one still being drawn on a drawing layer, or on an image's
 * cut, which `selectionColor` shows as a selection; `matrix` colors an
 * image in place of its adjustments (see `ImageLayerView`); `opacity`
 * fades a drawing, and `wrapStroke` wraps each of its pen strokes;
 * `liveInside` says `stroke` stays within a drawing's ink (an eraser).
 */
export function LayerContent({
	layer,
	uri,
	stroke,
	matrix,
	selectionColor,
	opacity,
	wrapStroke,
	liveInside,
	onImageError,
}: {
	layer: Layer;
	uri?: string;
	stroke?: ReactNode;
	opacity?: number;
	wrapStroke?: (index: number, stroke: ReactNode) => ReactNode;
	liveInside?: boolean;
	matrix?: { value: ColorMatrix };
	selectionColor?: string;
	onImageError: (error: unknown) => void;
}) {
	if (layer.type === "image") {
		return (
			<AsyncImage
				layer={layer}
				uri={uri ?? layer.uri}
				matrix={matrix}
				stroke={stroke}
				selectionColor={selectionColor}
				onError={onImageError}
			/>
		);
	}
	if (layer.type === "redaction" && layer.shape === "mask") {
		return <AsyncMaskedRedaction layer={layer} onError={onImageError} />;
	}
	return (
		<LayerView
			layer={layer}
			stroke={stroke}
			opacity={opacity}
			wrapStroke={wrapStroke}
			liveInside={liveInside}
		/>
	);
}

/**
 * Draws nothing until the image, and its mask if it has one, have decoded,
 * or if either can't be: a cut-out never shows its background meanwhile.
 * A new mask shows once it has decoded, and the one before it until then.
 * A cut shown as a selection hides nothing, so the image shows meanwhile.
 */
function AsyncImage({
	layer,
	uri,
	matrix,
	stroke,
	selectionColor,
	onError,
}: {
	layer: ImageLayer;
	uri: string;
	matrix?: { value: ColorMatrix };
	stroke?: ReactNode;
	selectionColor?: string;
	onError: (error: unknown) => void;
}) {
	const image = useDecodedImage(uri, onError);
	const mask = useDecodedImage(layer.mask ?? null, onError);
	if (!image || (mask === undefined && !selectionColor)) return null;
	return (
		<LayerView
			layer={layer}
			image={image}
			mask={mask ?? undefined}
			matrix={matrix}
			stroke={stroke}
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
	return mask ? <LayerView layer={layer} mask={mask} /> : null;
}
