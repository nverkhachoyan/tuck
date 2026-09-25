import {
	AlphaType,
	ColorType,
	drawAsImage,
	Group,
	ImageFormat,
	type SkImage,
} from "@shopify/react-native-skia";
import { decodedImages } from "@/layers/decodedImages";
import { averageColor } from "@/lib/color";
import { type EditorDocument, hasTransparency } from "@/model/document";
import { DocumentRenderScene } from "./DocumentRenderScene";
import { decodeImageLayers } from "./decodeImageLayers";

// A thumbnail's shorter side, in pixels: a project card's print on a phone
// at 3x.
const THUMBNAIL_SIZE = 360;

/**
 * Renders the document at its full logical resolution (1 unit = 1 pixel), or
 * `scale` times that.
 */
export async function renderDocument(
	document: EditorDocument,
	scale = 1,
): Promise<SkImage> {
	const decoded = await decodeImageLayers(document.layers, decodedImages);
	try {
		const result = await drawAsImage(
			<Group transform={[{ scale }]}>
				<DocumentRenderScene document={document} images={decoded.images} />
			</Group>,
			{
				width: Math.round(document.width * scale),
				height: Math.round(document.height * scale),
			},
		);
		if (!result) {
			throw new Error("Could not render exported image");
		}
		return result;
	} finally {
		// Camera photos are large; let go of them right away, so the ones the
		// editor isn't drawing are freed instead of waiting for garbage collection.
		decoded.release();
	}
}

// How far around a point the eyedropper averages, in document pixels: a
// photo's noise makes any single pixel a poor sample of what's there.
const SAMPLE_RADIUS = 2;

/**
 * The color the document shows around `point`, in document space, as
 * `#RRGGBB`: what export would draw there, averaged over a few pixels.
 * Null outside the canvas, or where it's transparent. Only those pixels
 * are drawn, so it's quick whatever the document's size.
 */
export async function sampleColor(
	document: EditorDocument,
	point: { x: number; y: number },
): Promise<string | null> {
	if (
		point.x < 0 ||
		point.y < 0 ||
		point.x >= document.width ||
		point.y >= document.height
	) {
		return null;
	}
	const size = SAMPLE_RADIUS * 2 + 1;
	const left = Math.floor(point.x) - SAMPLE_RADIUS;
	const top = Math.floor(point.y) - SAMPLE_RADIUS;
	const decoded = await decodeImageLayers(document.layers, decodedImages);
	try {
		const image = await drawAsImage(
			<Group transform={[{ translateX: -left }, { translateY: -top }]}>
				<DocumentRenderScene document={document} images={decoded.images} />
			</Group>,
			{ width: size, height: size },
		);
		if (!image) return null;
		try {
			const pixels = image.readPixels(0, 0, {
				width: size,
				height: size,
				colorType: ColorType.RGBA_8888,
				alphaType: AlphaType.Unpremul,
			});
			return pixels ? averageColor(pixels) : null;
		} finally {
			image.dispose();
		}
	} finally {
		decoded.release();
	}
}

/**
 * A small image of the document, as a data URL for a project's thumbnail: a
 * JPEG, or a PNG when some of the canvas is transparent.
 */
export async function renderThumbnail(
	document: EditorDocument,
): Promise<string> {
	const shortSide = Math.min(document.width, document.height);
	const image = await renderDocument(
		document,
		Math.min(1, THUMBNAIL_SIZE / shortSide),
	);
	try {
		return hasTransparency(document)
			? `data:image/png;base64,${image.encodeToBase64(ImageFormat.PNG)}`
			: `data:image/jpeg;base64,${image.encodeToBase64(ImageFormat.JPEG, 80)}`;
	} finally {
		image.dispose();
	}
}
