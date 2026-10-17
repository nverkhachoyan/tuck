import {
	AlphaType,
	ColorType,
	drawAsImage,
	Fill,
	Group,
	ImageFormat,
	type SkImage,
} from "@shopify/react-native-skia";
import { decodedImages } from "@/layers/decodedImages";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { averageColor } from "@/lib/color";
import {
	type EditorDocument,
	hasTransparency,
	type ImageLayer,
} from "@/model/document";
import { DocumentRenderScene } from "./DocumentRenderScene";
import { decodeImageLayers } from "./decodeImageLayers";
import { keptBounds } from "./keptBounds";

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

// The longer side, in pixels, of the quick render that finds what a cut-out
// keeps.
const TRIM_SIZE = 512;

/**
 * What an image layer's cut keeps, trimmed to it, as it looks in the layer
 * (flipped and adjusted, but not turned or scaled), with a transparent
 * background and its longer side `maxSide` pixels at most. Throws when the
 * cut keeps nothing.
 */
export async function renderCutOut(
	layer: ImageLayer,
	maxSide: number,
): Promise<SkImage> {
	const decoded = await decodeImageLayers([layer], decodedImages);
	const image = decoded.images.get(layer.uri);
	const mask =
		layer.mask === undefined ? undefined : decoded.images.get(layer.mask);
	if (!image) throw new Error("Couldn't read the image");
	// The image's pixels from `left`, `top`, at `scale`.
	const draw = (
		left: number,
		top: number,
		scale: number,
		width: number,
		height: number,
	) =>
		drawAsImage(
			<Group>
				<Fill blendMode="clear" />
				<Group
					transform={[
						{ scale },
						{ translateX: layer.width / 2 - left },
						{ translateY: layer.height / 2 - top },
					]}
				>
					<ImageLayerView layer={layer} image={image} mask={mask} />
				</Group>
			</Group>,
			{ width, height },
		);
	try {
		const quick = Math.min(1, TRIM_SIZE / Math.max(layer.width, layer.height));
		const width = Math.max(1, Math.round(layer.width * quick));
		const height = Math.max(1, Math.round(layer.height * quick));
		const preview = await draw(0, 0, quick, width, height);
		if (!preview) throw new Error("Couldn't draw the cut-out");
		let pixels: Float32Array | Uint8Array | null;
		try {
			pixels = preview.readPixels(0, 0, {
				width,
				height,
				colorType: ColorType.RGBA_8888,
				alphaType: AlphaType.Unpremul,
			});
		} finally {
			preview.dispose();
		}
		const kept =
			pixels instanceof Uint8Array && keptBounds(pixels, width, height);
		if (!kept) throw new Error("This cut-out keeps nothing of the image.");
		// A pixel's margin around what the quick render found, which may
		// round a soft edge away.
		const left = Math.max(0, Math.floor((kept.x - 1) / quick));
		const top = Math.max(0, Math.floor((kept.y - 1) / quick));
		const right = Math.min(
			layer.width,
			Math.ceil((kept.x + kept.width + 1) / quick),
		);
		const bottom = Math.min(
			layer.height,
			Math.ceil((kept.y + kept.height + 1) / quick),
		);
		const scale = Math.min(1, maxSide / Math.max(right - left, bottom - top));
		const result = await draw(
			left,
			top,
			scale,
			Math.max(1, Math.round((right - left) * scale)),
			Math.max(1, Math.round((bottom - top) * scale)),
		);
		if (!result) throw new Error("Couldn't draw the cut-out");
		return result;
	} finally {
		decoded.release();
	}
}
