import { Fill, Group, ImageFormat } from "react-native-skia";
import { DrawingLayerView } from "../layers/drawing/DrawingLayerView";
import {
	type DrawingLayer,
	inkRect,
	layerBlend,
	type Stroke,
} from "../layers/drawing/drawing";
import { drawOffscreen } from "./drawOffscreen";

// The share of the picture left around the ink on each side.
const MARGIN = 0.1;

// A mark's strokes never change in place, so each picture is drawn once
// per size.
const pictures = new WeakMap<Stroke[], Map<number, Promise<string | null>>>();

// Renders run one after another: on web they share one offscreen surface.
let queue: Promise<unknown> = Promise.resolve();

/**
 * A picture of the mark `layer` alone, `pixels` square, as a PNG data URL,
 * or null if it couldn't be drawn:
 * - its ink fitted inside a small margin, in its own space, unturned;
 * - a highlight drawn over white, since it multiplies; other ink on
 *   transparent;
 * - cached by its strokes and size, and drawn one at a time.
 */
export function renderMarkThumbnail(
	layer: DrawingLayer,
	pixels: number,
): Promise<string | null> {
	const size = Math.max(1, Math.round(pixels));
	let bySize = pictures.get(layer.strokes);
	if (!bySize) {
		bySize = new Map();
		pictures.set(layer.strokes, bySize);
	}
	const cached = bySize.get(size);
	if (cached) return cached;
	const drawn = queue.then(() => draw(layer, size)).catch(() => null);
	queue = drawn;
	bySize.set(size, drawn);
	return drawn;
}

async function draw(layer: DrawingLayer, size: number): Promise<string | null> {
	const ink = inkRect(layer);
	const fit = (size * (1 - 2 * MARGIN)) / Math.max(ink.width, ink.height, 1);
	const image = await drawOffscreen(
		<Group>
			{layerBlend(layer) === "multiply" && <Fill color="white" />}
			<Group
				transform={[
					{ translateX: size / 2 },
					{ translateY: size / 2 },
					{ scale: fit },
					{ translateX: -(ink.x + ink.width / 2) },
					{ translateY: -(ink.y + ink.height / 2) },
				]}
			>
				<DrawingLayerView layer={layer} />
			</Group>
		</Group>,
		{ width: size, height: size },
	);
	if (!image) return null;
	try {
		return `data:image/png;base64,${await image.encodeToBase64(ImageFormat.PNG)}`;
	} finally {
		image.dispose();
	}
}
