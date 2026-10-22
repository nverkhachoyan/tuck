import {
	AlphaType,
	ColorType,
	drawAsImage,
	Fill,
	Group,
	ImageFormat,
	type SkImage,
	Skia,
	ColorMatrix as SkiaColorMatrix,
	Image as SkiaImage,
} from "@shopify/react-native-skia";
import type { ImageLayer } from "@/model/document";
import { CutMask, imageBox } from "@/render/ImageLayerView";

// Turns white into black and black into white. Its last column is in 0–1
// units.
const INVERT = [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0];

/**
 * Whether `layer`'s cut, with its decoded `mask` and its strokes, shows the
 * image `at` a point on it, as fractions of its width and height from its
 * top left before it's flipped (see `imagePointAt`). A soft edge counts
 * where it's at least half shown.
 */
export async function cutShowsAt(
	layer: ImageLayer,
	mask: SkImage | undefined,
	at: { x: number; y: number },
): Promise<boolean> {
	const box = imageBox(layer);
	const x = box.x + at.x * layer.width;
	const y = box.y + at.y * layer.height;
	const image = await drawAsImage(
		<Group>
			<Fill color="black" />
			<Group transform={[{ translateX: 0.5 - x }, { translateY: 0.5 - y }]}>
				<CutMask layer={layer} mask={mask} />
			</Group>
		</Group>,
		{ width: 1, height: 1 },
	);
	if (!image) throw new Error("Couldn't read the cut");
	try {
		const pixel = image.readPixels(0, 0, {
			width: 1,
			height: 1,
			colorType: ColorType.RGBA_8888,
			alphaType: AlphaType.Unpremul,
		});
		if (!pixel) throw new Error("Couldn't read the cut");
		return pixel[0] >= 128;
	} finally {
		image.dispose();
	}
}

/**
 * `mask` with `subject` added to it (the lighter of the two everywhere) or
 * taken out of it (the darker of it and the subject's inverse), or without
 * one, `subject` alone, as a grayscale PNG's bytes. Both cover the whole
 * image, so the result has the larger one's pixels, and the other is
 * stretched to fit.
 */
export async function combineMasks(
	mask: SkImage | null,
	subject: SkImage,
	mode: "add" | "remove",
): Promise<Uint8Array> {
	const width = Math.max(mask?.width() ?? 0, subject.width());
	const height = Math.max(mask?.height() ?? 0, subject.height());
	const box = { x: 0, y: 0, width, height };
	const combined = await drawAsImage(
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
 * The inverse of `mask`, or without one, of a mask that shows the whole
 * image: a black pixel, which is stretched over it like any mask. As a
 * grayscale PNG's bytes.
 */
export async function invertedMask(
	mask: SkImage | undefined,
): Promise<Uint8Array> {
	const width = mask?.width() ?? 1;
	const height = mask?.height() ?? 1;
	const inverted = await drawAsImage(
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
