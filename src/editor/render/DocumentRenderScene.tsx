import { Fill, Group, Rect, type SkImage } from "react-native-skia";
import type { EditorDocument } from "../document/document";
import { toTransformList } from "../layers/layerTransform";
import { LayerView } from "./LayerView";

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
						<LayerView
							layer={layer}
							image={layer.type === "image" ? images.get(layer.uri) : undefined}
							mask={
								layer.type === "image"
									? layer.mask === undefined
										? undefined
										: images.get(layer.mask)
									: layer.type === "redaction" && layer.shape === "mask"
										? images.get(layer.mask)
										: undefined
							}
						/>
					</Group>
				),
			)}
		</Group>
	);
}
