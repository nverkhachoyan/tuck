import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { AlphaType, ColorType, Skia } from "react-native-skia";
import { MAX_PHOTO_PIXELS, photoScale } from "./photoScale";

export type PickedPhoto = {
	uri: string;
	width: number;
	height: number;
	// A JPEG if every pixel is opaque, else a PNG, which keeps transparency.
	opaque: boolean;
};

export type PickPhotoResult =
	| { status: "picked"; photo: PickedPhoto }
	| { status: "canceled" };

export type PickPhotoOptions = {
	// Shrinks the photo so its shorter side is at most this many pixels.
	maxShortSide?: number;
	// And so its longer side is at most this many.
	maxLongSide?: number;
};

/**
 * Lets the user pick a photo, re-encoded so the editor can always read it. The
 * system picker runs outside the app and returns only what the user chooses, so
 * no library permission is needed. Throws if the photo can't be read or
 * re-encoded.
 */
export async function pickPhoto(
	options: PickPhotoOptions = {},
): Promise<PickPhotoResult> {
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		quality: 1,
	});
	if (result.canceled) {
		return { status: "canceled" };
	}

	const photo = await reencode(result.assets[0].uri, options);
	return { status: "picked", photo };
}

/**
 * An image from elsewhere, as a URI (a pasted or dropped file's blob URL on
 * web), made ready for the editor like a picked photo. Throws if it can't be
 * read or re-encoded.
 */
export async function importPhoto(
	uri: string,
	options: PickPhotoOptions = {},
): Promise<PickedPhoto> {
	return reencode(uri, options);
}

// Looks the same as 1, at about half the size on disk. Export uses 0.95.
const JPEG_QUALITY = 0.92;

/**
 * Skia can't decode HEIC, the default on iPhone, so every photo is re-encoded
 * for the editor, and oversized ones shrink on the way. JPEG can't hold
 * transparency, so an image with any becomes a PNG.
 */
async function reencode(
	uri: string,
	{ maxShortSide, maxLongSide }: PickPhotoOptions,
): Promise<PickedPhoto> {
	const opaque = await isOpaque(uri);
	let image = await ImageManipulator.manipulate(uri).renderAsync();
	// The rendered size already has the photo's EXIF rotation applied.
	const scale = photoScale(image, MAX_PHOTO_PIXELS, maxShortSide, maxLongSide);
	if (scale < 1) {
		const full = image;
		image = await ImageManipulator.manipulate(full)
			.resize({ width: Math.floor(full.width * scale) })
			.renderAsync();
		full.release();
	}
	try {
		const {
			width,
			height,
			uri: encoded,
		} = await image.saveAsync(
			opaque
				? { format: SaveFormat.JPEG, compress: JPEG_QUALITY }
				: { format: SaveFormat.PNG },
		);
		return { uri: encoded, width, height, opaque };
	} finally {
		image.release();
	}
}

// How many pixels `isOpaque` copies out at a time, so a large image's
// aren't all copied at once.
const SCAN_PIXELS = 1 << 20;

/**
 * Whether every pixel of an image is opaque. Most images' formats say so;
 * one with an alpha channel, as screenshots often have, is checked pixel by
 * pixel. An image Skia can't decode, like an iPhone's HEIC photos, counts as
 * opaque.
 */
async function isOpaque(uri: string): Promise<boolean> {
	const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
	if (!image) return true;
	try {
		const { width, height, alphaType } = image.getImageInfo();
		if (alphaType === AlphaType.Opaque) return true;
		const rows = Math.max(1, Math.floor(SCAN_PIXELS / width));
		for (let y = 0; y < height; y += rows) {
			// Web's Skia reads only RGBA, not the alpha channel alone.
			const pixels = image.readPixels(0, y, {
				width,
				height: Math.min(rows, height - y),
				colorType: ColorType.RGBA_8888,
				alphaType: AlphaType.Premul,
			});
			// Unchecked counts as transparent: a PNG costs space, never pixels.
			if (!pixels) return false;
			for (let alpha = 3; alpha < pixels.length; alpha += 4) {
				if (pixels[alpha] < 255) return false;
			}
		}
		return true;
	} finally {
		image.dispose();
	}
}
