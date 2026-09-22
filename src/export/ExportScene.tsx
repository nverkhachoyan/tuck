import { Group, type SkImage } from "@shopify/react-native-skia";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { toTransformList } from "@/layers/layerTransform";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { EditorDocument } from "@/model/document";

/**
 * The document's layers in document space, with no selection chrome or
 * gesture state. `images` must be pre-decoded: the offscreen renderer draws
 * a single frame, so async loaders like `useImage` would still be null.
 */
export function ExportScene({
	document,
	images,
}: {
	document: EditorDocument;
	images: Map<string, SkImage>;
}) {
	return (
		<Group>
			{document.layers.map((layer) => {
				switch (layer.type) {
					case "image": {
						const image = images.get(layer.id);
						return image ? (
							<ImageLayerView key={layer.id} layer={layer} image={image} />
						) : null;
					}
					case "text":
						return (
							<TextLayerView
								key={layer.id}
								layer={layer}
								transform={toTransformList(layer.transform)}
							/>
						);
					default:
						return assertNever(layer);
				}
			})}
		</Group>
	);
}
