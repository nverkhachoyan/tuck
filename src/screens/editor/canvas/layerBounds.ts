import { assertNever } from "@/lib/assertNever";
import type { Box } from "@/model/geometry";
import type { Layer } from "@/model/layers/layer";
import { shapeBox } from "@/model/shapes";
import { drawingBox } from "@/model/strokes";
import { textLayerBounds } from "@/render/textLayerLayout";

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
			return padded(
				{ halfWidth: layer.width / 2, halfHeight: layer.height / 2 },
				minPadding,
			);
		case "drawing":
			return padded(drawingBox(layer), minPadding);
		case "redaction":
			return layer.shape === "strokes"
				? padded(drawingBox(layer), minPadding)
				: padded(
						{ halfWidth: layer.width / 2, halfHeight: layer.height / 2 },
						minPadding,
					);
		case "shape":
			return padded(shapeBox(layer), minPadding);
		default:
			return assertNever(layer);
	}
}

function padded({ halfWidth, halfHeight }: Box, padding: number): Box {
	return { halfWidth: halfWidth + padding, halfHeight: halfHeight + padding };
}
