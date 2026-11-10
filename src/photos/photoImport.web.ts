import * as ImagePicker from "expo-image-picker";
import type {
	PickedPhoto,
	PickPhotoOptions,
	PickPhotoResult,
} from "./photoImport";
import { JPEG_QUALITY, previewSize, scaledPhotoSize } from "./photoScale";

export type {
	PickedPhoto,
	PickPhotoOptions,
	PickPhotoResult,
} from "./photoImport";
export { JPEG_QUALITY } from "./photoScale";

/** See `photoImport.ts`. */
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

/** See `photoImport.ts`. */
export async function importPhoto(
	uri: string,
	options: PickPhotoOptions = {},
): Promise<PickedPhoto> {
	return reencode(uri, options);
}

// How many pixels `isCanvasOpaque` copies out at a time, so a large image's
// aren't all copied at once.
const SCAN_PIXELS = 1 << 20;

/**
 * Decodes the photo once with the browser (which applies EXIF rotation and
 * keeps the bitmap outside CanvasKit's heap), then encodes the photo and its
 * canvas preview directly from `OffscreenCanvas` without an intermediate PNG.
 */
async function reencode(
	uri: string,
	{ maxShortSide, maxLongSide }: PickPhotoOptions,
): Promise<PickedPhoto> {
	const response = await fetch(uri);
	if (!response.ok) throw new Error("Couldn't read the photo.");
	const blob = await response.blob();
	const bitmap = await createImageBitmap(blob);
	try {
		const { width, height } = scaledPhotoSize(
			bitmap,
			maxShortSide,
			maxLongSide,
		);
		const { canvas, context } = drawBitmap(bitmap, width, height);
		const opaque =
			blob.type === "image/jpeg" || isCanvasOpaque(context, width, height);
		const encoded = await encodeCanvas(canvas, opaque);
		const previewTarget = previewSize({ width, height });
		if (!previewTarget) {
			return { uri: encoded, width, height, opaque };
		}
		const preview = await encodeCanvas(
			drawBitmap(bitmap, previewTarget.width, previewTarget.height).canvas,
			opaque,
		);
		return { uri: encoded, width, height, opaque, preview };
	} finally {
		bitmap.close();
	}
}

function drawBitmap(bitmap: ImageBitmap, width: number, height: number) {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Couldn't prepare a canvas for the photo.");
	context.drawImage(bitmap, 0, 0, width, height);
	return { canvas, context };
}

function isCanvasOpaque(
	context: OffscreenCanvasRenderingContext2D,
	width: number,
	height: number,
): boolean {
	const rows = Math.max(1, Math.floor(SCAN_PIXELS / width));
	for (let y = 0; y < height; y += rows) {
		const { data } = context.getImageData(
			0,
			y,
			width,
			Math.min(rows, height - y),
		);
		for (let alpha = 3; alpha < data.length; alpha += 4) {
			if (data[alpha] < 255) return false;
		}
	}
	return true;
}

async function encodeCanvas(
	canvas: OffscreenCanvas,
	opaque: boolean,
): Promise<string> {
	const blob = await canvas.convertToBlob(
		opaque
			? { type: "image/jpeg", quality: JPEG_QUALITY }
			: { type: "image/png" },
	);
	return URL.createObjectURL(blob);
}
