import { Fill, Group, Rect, type SkImage } from "@shopify/react-native-skia";
import { DrawingLayerView } from "@/layers/DrawingLayerView";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { toTransformList } from "@/layers/layerTransform";
import { RedactionLayerView } from "@/layers/RedactionLayerView";
import { ShapeLayerView } from "@/layers/ShapeLayerView";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { EditorDocument, Layer } from "@/model/document";

/**
 * The document's background and layers in document space, with no selection
 * chrome or gesture state. `images`, by file, must be pre-decoded (see
 * `decodeImageLayers`): the offscreen renderer draws a single frame, so async
 * loaders like `useImage` would still be null.
 */
export function DocumentRenderScene({
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
			const image = images.get(layer.uri);
			const mask = layer.mask === undefined ? null : images.get(layer.mask);
			if (!image || mask === undefined) return null;
			return (
				<ImageLayerView layer={layer} image={image} mask={mask ?? undefined} />
			);
		}
		case "text":
			return <TextLayerView layer={layer} />;
		case "drawing":
			return <DrawingLayerView layer={layer} />;
		case "redaction":
			return <RedactionLayerView layer={layer} />;
		case "shape":
			return <ShapeLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}
