import {
	AlphaType,
	ColorType,
	Fill,
	Group,
	ImageFormat,
	type SkImage,
	Skia,
	ColorMatrix as SkiaColorMatrix,
	Image as SkiaImage,
} from "react-native-skia";
import { CutMask } from "../../layers/image/ImageLayerView";
import type { ImageLayer } from "../../layers/image/image";
import { decodedImages } from "../../render/decodedImages";
import { drawOffscreen } from "../../render/drawOffscreen";

// A flattened cut's longer side, at most, when strokes refine it: soft
// edges hide the difference on a larger photo.
const FLAT_MAX_SIDE = 2048;

// Turns white into black and black into white. Its last column is in 0–1
// units.
const INVERT = [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0];

/**
 * Returns a grayscale PNG's bytes. Both masks cover the whole image, so the
 * result has the larger one's pixels, and the other is stretched to fit.
 */
export async function combineMasks(
	mask: SkImage | null,
	subject: SkImage,
	mode: "add" | "remove",
): Promise<Uint8Array> {
	const width = Math.max(mask?.width() ?? 0, subject.width());
	const height = Math.max(mask?.height() ?? 0, subject.height());
	const box = { x: 0, y: 0, width, height };
	const combined = await drawOffscreen(
		<Group>
			<Fill color="black" />
			{mask && <SkiaImage image={mask} {...box} fit="fill" />}
			<SkiaImage
				image={subject}
				{...box}
				fit="fill"
				blendMode={mode === "add" ? "lighten" : "darken"}
			>
				{mode === "remove" && <SkiaColorMatrix matrix={INVERT} />}
			</SkiaImage>
		</Group>,
		{ width, height },
	);
	if (!combined) throw new Error("Couldn't combine the masks");
	return encodeGrayPng(combined);
}

/**
 * Without a `mask`, inverts one that shows the whole image, which gives a black
 * pixel, stretched over the image like any mask. Returns a grayscale PNG's
 * bytes.
 */
export async function invertedMask(
	mask: SkImage | undefined,
): Promise<Uint8Array> {
	const width = mask?.width() ?? 1;
	const height = mask?.height() ?? 1;
	const inverted = await drawOffscreen(
		<Group>
			<Fill color="black" />
			{mask && (
				<SkiaImage image={mask} x={0} y={0} width={width} height={height}>
					<SkiaColorMatrix matrix={INVERT} />
				</SkiaImage>
			)}
		</Group>,
		{ width, height },
	);
	if (!inverted) throw new Error("Couldn't invert the cut");
	return encodeGrayPng(inverted);
}

/**
 * The mask Cut's Remove leaves an image with, as a grayscale PNG's bytes:
 * `selection`'s cut taken out of `from`'s, or out of the whole image when
 * `from` is null (see `removalOf`).
 */
export async function removedMask(
	from: ImageLayer | null,
	selection: ImageLayer,
): Promise<Uint8Array> {
	const selected = await flattenedCut(selection);
	try {
		if (!from) return await invertedMask(selected);
		const kept = await flattenedCut(from);
		try {
			return await combineMasks(kept, selected, "remove");
		} finally {
			kept.dispose();
		}
	} finally {
		selected.dispose();
	}
}

/**
 * What `layer`'s cut shows, its mask with its strokes painted over it, as
 * one gray image stretched over the image like any mask. Without strokes it
 * has its mask's pixels; with them, the image's, up to `FLAT_MAX_SIDE`, so
 * a stroke on a small mask keeps its edge.
 */
async function flattenedCut(layer: ImageLayer): Promise<SkImage> {
	const held =
		layer.mask === undefined ? null : decodedImages.acquire(layer.mask);
	try {
		const mask = held ? await held.decoded : undefined;
		let width = mask?.width() ?? 1;
		let height = mask?.height() ?? 1;
		if (layer.maskStrokes) {
			const scale = Math.min(
				1,
				FLAT_MAX_SIDE / Math.max(layer.width, layer.height),
			);
			width = Math.max(width, Math.round(layer.width * scale));
			height = Math.max(height, Math.round(layer.height * scale));
		}
		const flat = await drawOffscreen(
			<Group>
				<Fill color="black" />
				<Group
					transform={[
						{ scaleX: width / layer.width },
						{ scaleY: height / layer.height },
						{ translateX: layer.width / 2 },
						{ translateY: layer.height / 2 },
					]}
				>
					<CutMask layer={layer} mask={mask} />
				</Group>
			</Group>,
			{ width, height },
		);
		if (!flat) throw new Error("Couldn't read the selection");
		return flat;
	} finally {
		held?.release();
	}
}

/**
 * A gray `image` as a grayscale PNG's bytes, disposing of it. CanvasKit
 * can't read a GPU surface back as gray, so it's read in color and keeps a
 * channel.
 */
function encodeGrayPng(image: SkImage): Uint8Array {
	const width = image.width();
	const height = image.height();
	let pixels: Float32Array | Uint8Array | null;
	try {
		pixels = image.readPixels(0, 0, {
			width,
			height,
			colorType: ColorType.RGBA_8888,
			alphaType: AlphaType.Unpremul,
		});
	} finally {
		image.dispose();
	}
	if (!(pixels instanceof Uint8Array)) {
		throw new Error("Couldn't read the mask");
	}
	const gray = new Uint8Array(width * height);
	for (let i = 0; i < gray.length; i++) gray[i] = pixels[i * 4];
	const grayImage = Skia.Image.MakeImage(
		{ width, height, colorType: ColorType.Gray_8, alphaType: AlphaType.Opaque },
		Skia.Data.fromBytes(gray),
		width,
	);
	if (!grayImage) throw new Error("Couldn't read the mask");
	try {
		return grayImage.encodeToBytes(ImageFormat.PNG);
	} finally {
		grayImage.dispose();
	}
}
