import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { EditorDocument, ImageLayer } from "../editor/core";
import { JPEG_QUALITY } from "./photoImport";
import { PREVIEW_LONG_SIDE, photoScale } from "./photoScale";
import previewStorage, { type PreviewStorage } from "./previewStorage";

// Previews keyed by projectId and image file name or URI in memory for synchronous canvas lookups.
const memoryPreviews = new Map<string, string>();

const cacheKey = (projectId: string, fileOrUri: string) =>
	`${projectId}:${fileOrUri}`;

/**
 * Whether an image with these dimensions needs a preview texture.
 * Only images exceeding PREVIEW_LONG_SIDE on their long side need one.
 */
export function needsPreview(size: { width: number; height: number }): boolean {
	return Math.max(size.width, size.height) > PREVIEW_LONG_SIDE;
}

/**
 * Synchronous lookup of an already-prepared preview URI for a project's image.
 * Returns null if the image does not have or need a preview texture.
 */
export function getPreviewUri(
	projectId: string,
	fileOrUri: string,
): string | null {
	return memoryPreviews.get(cacheKey(projectId, fileOrUri)) ?? null;
}

/**
 * Loads a preview URI from storage into the memory cache.
 */
export async function loadPreviewUri(
	projectId: string,
	file: string,
	storage: PreviewStorage = previewStorage,
): Promise<string | null> {
	const cached = getPreviewUri(projectId, file);
	if (cached) return cached;
	const stored = await storage.getPreviewUri(projectId, file);
	if (stored) {
		memoryPreviews.set(cacheKey(projectId, file), stored);
	}
	return stored;
}

/**
 * Generates or retrieves a preview texture for a specific image file in a project.
 * Returns null if the image long side is <= PREVIEW_LONG_SIDE.
 * Never modifies or rewrites the stored source file.
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
	if (!needsPreview({ width, height })) {
		return null;
	}

	const existing = await storage.getPreviewUri(projectId, file);
	if (existing) {
		memoryPreviews.set(cacheKey(projectId, file), existing);
		memoryPreviews.set(cacheKey(projectId, uri), existing);
		return existing;
	}

	const scale = photoScale(
		{ width, height },
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		PREVIEW_LONG_SIDE,
	);
	const targetWidth = Math.floor(width * scale);

	const rendered = await ImageManipulator.manipulate(uri)
		.resize({ width: targetWidth })
		.renderAsync();

	try {
		const saved = await rendered.saveAsync(
			opaque
				? { format: SaveFormat.JPEG, compress: JPEG_QUALITY }
				: { format: SaveFormat.PNG },
		);
		const previewUri = await storage.savePreview(projectId, file, saved.uri);
		memoryPreviews.set(cacheKey(projectId, file), previewUri);
		memoryPreviews.set(cacheKey(projectId, uri), previewUri);
		return previewUri;
	} finally {
		rendered.release();
	}
}

/**
 * Builds or loads preview textures for all oversized image layers in an open project.
 * Builds once per file exceeding PREVIEW_LONG_SIDE.
 * Released before Skia canvas decoding.
 */
export async function prepareProjectPreviews(
	projectId: string,
	document: EditorDocument,
	imageFile: (uri: string) => string | undefined,
	storage: PreviewStorage = previewStorage,
): Promise<Map<string, string>> {
	const previews = new Map<string, string>();
	const seenFiles = new Set<string>();

	for (const layer of document.layers) {
		if (layer.type !== "image") continue;
		const imageLayer = layer as ImageLayer;
		const file = imageFile(imageLayer.uri);
		if (!file || seenFiles.has(file)) continue;
		seenFiles.add(file);

		if (!needsPreview(imageLayer)) continue;

		const previewUri = await ensurePreview(
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

		if (previewUri) {
			previews.set(file, previewUri);
			previews.set(imageLayer.uri, previewUri);
			memoryPreviews.set(cacheKey(projectId, file), previewUri);
			memoryPreviews.set(cacheKey(projectId, imageLayer.uri), previewUri);
		}
	}

	return previews;
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
