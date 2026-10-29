import {
	createDocumentFromImage,
	type EditorDocument,
} from "@model/document.ts";
import { createDrawingLayer } from "@model/layers/drawing.ts";
import type { Layer } from "@model/layers/layer.ts";
import { createRedactionBox } from "@model/layers/redaction.ts";
import { createShapeLayer } from "@model/layers/shape.ts";
import { createTextLayer } from "@model/layers/text.ts";
import { decodedImages } from "@src/render/decodedImages.ts";
import { decodeImageLayers } from "@src/render/decodeImageLayers.ts";
import type { SkImage } from "react-native-skia";
import { makePhotoFile } from "./photoFile.ts";

export type Sample = {
	document: EditorDocument;
	// By file, decoded by the app's own cache, as export needs them.
	images: Map<string, SkImage>;
	release: () => void;
};

/**
 * The rendering lessons' document: a photo file, decoded by Skia, with one
 * layer of every kind on it.
 */
export async function makeSample(): Promise<Sample> {
	const photo = await makePhotoFile(1200, 900);
	const document = createDocumentFromImage(photo, 1200, 900, true);
	const caption = createTextLayer(document, "Golden hour");
	const sample: EditorDocument = {
		...document,
		layers: [
			...document.layers,
			{ ...caption, transform: { ...caption.transform, y: 520 } },
			// Over the sun.
			createRedactionBox(
				{ x: 120, y: 105, width: 260, height: 250 },
				{ type: "blur", radius: 22 },
			),
			// Over the kites.
			createRedactionBox(
				{ x: 720, y: 40, width: 360, height: 230 },
				{ type: "pixelate", size: 36 },
			),
			createShapeLayer(
				"arrow",
				{ x: 640, y: 330, rotation: -0.5, width: 260, height: 0 },
				{ color: "#FF3B30", strokeWidth: 14 },
			),
			createDrawingLayer({
				type: "pen",
				color: "#FF2D95",
				width: 16,
				tip: "neon",
				points: [150, 770, 250, 710, 350, 790, 450, 712, 540, 770],
			}),
		],
	};
	const decoded = await decodeImageLayers(sample.layers, decodedImages);
	return { document: sample, images: decoded.images, release: decoded.release };
}

export function layerLabel(layer: Layer): string {
	switch (layer.type) {
		case "image":
			return "The photo";
		case "text":
			return `“${layer.text}”`;
		case "redaction":
			return `Redaction · ${layer.effect.type}`;
		case "shape":
			return `Shape · ${layer.shape}`;
		case "drawing":
			return "Drawing";
	}
}
