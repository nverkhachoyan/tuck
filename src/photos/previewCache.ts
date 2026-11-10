import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { EditorDocument, ImageLayer } from "../editor/core";
import { JPEG_QUALITY, previewSize } from "./photoScale";
import previewStorage, { type PreviewStorage } from "./previewStorage";

// Previews keyed by projectId and image URI in memory for synchronous canvas lookups.
const memoryPreviews = new Map<string, string>();

const cacheKey = (projectId: string, uri: string) => `${projectId}:${uri}`;

/**
 * Whether an image with these dimensions needs a preview texture.
 * Only images exceeding PREVIEW_LONG_SIDE on their long side need one.
 */
export function needsPreview(size: { width: number; height: number }): boolean {
	return previewSize(size) !== null;
}

/**
 * Synchronous lookup of an already-prepared preview URI for a project's image.
 * Returns null if the image does not have or need a preview texture.
 */
export function getPreviewUri(projectId: string, uri: string): string | null {
	return memoryPreviews.get(cacheKey(projectId, uri)) ?? null;
}

/**
 * Stores a preview created during photo import and records it in memory for
 * the project's image URL.
 */
export async function storePreview(
	projectId: string,
	file: string,
	uri: string,
	tempUri: string,
	storage: PreviewStorage = previewStorage,
): Promise<string> {
	const previewUri = await storage.savePreview(projectId, file, tempUri);
	memoryPreviews.set(cacheKey(projectId, uri), previewUri);
	return previewUri;
}

/**
 * Loads a stored preview for a project's image, or generates one when opening
 * a project saved without a preview. Never modifies the stored source file.
 */
export async function ensurePreview(
	options: {
		projectId: string;
		file: string;
		uri: string;
		width: number;
		height: number;
		opaque: boolean;
	},
	storage: PreviewStorage = previewStorage,
): Promise<string | null> {
	const { projectId, file, uri, width, height, opaque } = options;
	const target = previewSize({ width, height });
	if (!target) {
		return null;
	}

	const existing = await storage.getPreviewUri(projectId, file);
	if (existing) {
		memoryPreviews.set(cacheKey(projectId, uri), existing);
		return existing;
	}

	const rendered = await ImageManipulator.manipulate(uri)
		.resize({ width: target.width })
		.renderAsync();

	try {
		const saved = await rendered.saveAsync(
			opaque
				? { format: SaveFormat.JPEG, compress: JPEG_QUALITY }
				: { format: SaveFormat.PNG },
		);
		return await storePreview(projectId, file, uri, saved.uri, storage);
	} finally {
		rendered.release();
	}
}

/**
 * Loads or builds preview textures for all oversized image layers in a
 * reopened project before Skia canvas decoding.
 */
export async function prepareProjectPreviews(
	projectId: string,
	document: EditorDocument,
	imageFile: (uri: string) => string | undefined,
	storage: PreviewStorage = previewStorage,
): Promise<void> {
	const seenFiles = new Set<string>();

	for (const layer of document.layers) {
		if (layer.type !== "image") continue;
		const imageLayer = layer as ImageLayer;
		const file = imageFile(imageLayer.uri);
		if (!file || seenFiles.has(file)) continue;
		seenFiles.add(file);

		await ensurePreview(
			{
				projectId,
				file,
				uri: imageLayer.uri,
				width: imageLayer.width,
				height: imageLayer.height,
				opaque: imageLayer.opaque,
			},
			storage,
		);
	}
}

/**
 * Cleans up preview textures when a project is deleted.
 */
export async function removeProjectPreviews(
	projectId: string,
	storage: PreviewStorage = previewStorage,
): Promise<void> {
	await storage.removeProjectPreviews(projectId);
	for (const key of memoryPreviews.keys()) {
		if (key.startsWith(`${projectId}:`)) {
			memoryPreviews.delete(key);
		}
	}
}
