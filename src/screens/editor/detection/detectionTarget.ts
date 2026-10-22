import type {
	EditorDocument,
	ImageLayer,
	Layer,
} from "../../../model/document.ts";
import { framingAnchor } from "../../../model/framing.ts";

/** The selected visible image, or the document's framing photo, or any image. */
export function detectionTarget(
	document: EditorDocument,
	selected: Layer | undefined,
): ImageLayer | null {
	if (selected?.type === "image" && !selected.hidden) return selected;
	return (
		framingAnchor(document).layer ??
		document.layers.find(
			(layer): layer is ImageLayer => layer.type === "image" && !layer.hidden,
		) ??
		null
	);
}

/** Everything that makes a displayed detection box stale. */
export function detectionTargetKey(
	document: EditorDocument,
	layer: ImageLayer | null,
): string {
	if (!layer) return `none:${document.width}:${document.height}`;
	const { transform } = layer;
	return [
		layer.id,
		layer.uri,
		layer.width,
		layer.height,
		layer.flipped,
		transform.x,
		transform.y,
		transform.scaleX,
		transform.scaleY,
		transform.rotation,
		document.width,
		document.height,
	].join(":");
}
