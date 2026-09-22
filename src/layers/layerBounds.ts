import { assertNever } from "@/lib/assertNever";
import type { Layer } from "@/model/document";
import type { Box } from "@/model/geometry";
import { textLayerBounds } from "./textLayerLayout";

/**
 * The box a layer occupies in its own space, centered on its origin. The
 * selection outline, the handles, and hit-testing all use it, so they agree
 * on where the layer is. `minPadding` widens the box's padding, never
 * narrows it (hit-testing uses it to keep small layers tappable).
 */
export function layerBounds(layer: Layer, minPadding = 0): Box {
	switch (layer.type) {
		case "text":
			return textLayerBounds(layer, minPadding);
		case "image":
			return {
				halfWidth: layer.width / 2 + minPadding,
				halfHeight: layer.height / 2 + minPadding,
			};
		default:
			return assertNever(layer);
	}
}
