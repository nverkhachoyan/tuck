import { Fill, Group, Rect, type SkImage } from "@shopify/react-native-skia";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { toTransformList } from "@/layers/layerTransform";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { EditorDocument, Layer } from "@/model/document";

/**
 * The document's background and layers in document space, with no selection
 * chrome or gesture state. `images` must be pre-decoded: the offscreen
 * renderer draws a single frame, so async loaders like `useImage` would
 * still be null.
 */
export function ExportScene({
	document,
	images,
}: {
	document: EditorDocument;
	images: Map<string, SkImage>;
}) {
	const { width, height, background } = document;
	return (
		<Group>
			{/* A new offscreen surface isn't guaranteed to start out transparent. */}
			<Fill blendMode="clear" />
			{background !== null && (
				<Rect x={0} y={0} width={width} height={height} color={background} />
			)}
			{document.layers.map((layer) =>
				layer.hidden ? null : (
					<Group key={layer.id} transform={toTransformList(layer.transform)}>
						<LayerContent layer={layer} images={images} />
					</Group>
				),
			)}
		</Group>
	);
}

function LayerContent({
	layer,
	images,
}: {
	layer: Layer;
	images: Map<string, SkImage>;
}) {
	switch (layer.type) {
		case "image": {
			const image = images.get(layer.id);
			return image ? <ImageLayerView layer={layer} image={image} /> : null;
		}
		case "text":
			return <TextLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}
