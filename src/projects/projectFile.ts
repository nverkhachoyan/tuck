// Relative `.ts` import keeps this loadable by Node's test runner.
import { type EditorDocument, textFonts } from "../model/document.ts";

// Bump when the saved format changes, and teach `parseSavedProject` to read
// the older one. 2 added the canvas's background, layers' `locked`, and
// image layers' `flipped`.
export const PROJECT_VERSION = 2;

// The photo's file in a project, which saved image layers name as their `uri`.
export const PHOTO_FILE = "original.jpg";

export type SavedProject = {
	version: number;
	createdAt: number;
	updatedAt: number;
	// Image layers' `uri` names a file in the project rather than a URL: where
	// the project lives can change (on iOS, with every app update).
	document: EditorDocument;
	thumbnail?: ProjectThumbnail;
};

/**
 * A small image of the document as a data URL (a JPEG, or a PNG when some of
 * the canvas is transparent), and the `updatedAt` of the save it shows. Saves
 * carry it over, so it can be older than the document.
 */
export type ProjectThumbnail = { url: string; updatedAt: number };

export type ProjectSummary =
	| {
			id: string;
			status: "ready";
			updatedAt: number;
			label: string;
			thumbnail: string | null;
	  }
	| { id: string; status: "unavailable" };

/** `document` with every image layer's `uri` passed through `map`. */
export function mapImageUris(
	document: EditorDocument,
	map: (uri: string) => string,
): EditorDocument {
	return {
		...document,
		layers: document.layers.map((layer) =>
			layer.type === "image" ? { ...layer, uri: map(layer.uri) } : layer,
		),
	};
}

/** A saved project read back from JSON, or null if it isn't one this app can open. */
export function parseSavedProject(json: string): SavedProject | null {
	try {
		const value = upgradeProject(JSON.parse(json));
		if (!isSavedProject(value)) return null;
		// A bad thumbnail only costs the thumbnail; closing makes a new one.
		const { thumbnail, ...project } = value;
		return isThumbnail(thumbnail) ? { ...project, thumbnail } : project;
	} catch {
		return null;
	}
}

/** What a project is listed as: its top text, since that's what it's remembered by. */
export function projectLabel(document: EditorDocument): string {
	for (let i = document.layers.length - 1; i > 0; i--) {
		const layer = document.layers[i];
		const text = layer.type === "text" ? layer.text.replace(/\s+/g, " ") : "";
		if (!layer.hidden && text.trim()) return text.trim();
	}
	return "Untitled";
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
	return typeof value === "object" && value !== null;
}

/**
 * A version 1 project as version 2 would have saved it: no background, only
 * the photo locked, and nothing flipped. Anything else is returned as is.
 */
function upgradeProject(value: unknown): unknown {
	if (
		!isFields(value) ||
		value.version !== 1 ||
		!isFields(value.document) ||
		!Array.isArray(value.document.layers)
	) {
		return value;
	}
	const layers: unknown[] = value.document.layers;
	return {
		...value,
		version: 2,
		document: {
			...value.document,
			background: null,
			layers: layers.map((layer, index) =>
				isFields(layer)
					? {
							...layer,
							locked: index === 0,
							...(layer.type === "image" && { flipped: false }),
						}
					: layer,
			),
		},
	};
}

function isSavedProject(value: unknown): value is SavedProject {
	return (
		isFields(value) &&
		value.version === PROJECT_VERSION &&
		typeof value.createdAt === "number" &&
		typeof value.updatedAt === "number" &&
		isDocument(value.document)
	);
}

function isThumbnail(value: unknown): value is ProjectThumbnail {
	return (
		isFields(value) &&
		typeof value.url === "string" &&
		value.url.startsWith("data:image/") &&
		typeof value.updatedAt === "number"
	);
}

function isDocument(value: unknown): boolean {
	if (!isFields(value) || !Array.isArray(value.layers)) return false;
	const [photo] = value.layers;
	return (
		isPositive(value.width) &&
		isPositive(value.height) &&
		isColorOrNull(value.background) &&
		isFields(photo) &&
		photo.type === "image" &&
		value.layers.every(isLayer)
	);
}

function isLayer(value: unknown): boolean {
	if (
		!isFields(value) ||
		typeof value.id !== "string" ||
		typeof value.hidden !== "boolean" ||
		typeof value.locked !== "boolean" ||
		!isTransform(value.transform)
	) {
		return false;
	}
	switch (value.type) {
		case "image":
			return (
				typeof value.uri === "string" &&
				isPositive(value.width) &&
				isPositive(value.height) &&
				typeof value.flipped === "boolean"
			);
		case "text":
			return (
				typeof value.text === "string" &&
				textFonts.some((font) => font === value.font) &&
				isPositive(value.fontSize) &&
				isPositive(value.maxWidth) &&
				typeof value.color === "string" &&
				isColorOrNull(value.outlineColor) &&
				isColorOrNull(value.backgroundColor) &&
				["left", "center", "right"].includes(value.align as string)
			);
		default:
			return false;
	}
}

function isTransform(value: unknown): boolean {
	return (
		isFields(value) &&
		["x", "y", "scaleX", "scaleY", "rotation"].every((key) =>
			Number.isFinite(value[key]),
		)
	);
}

function isPositive(value: unknown): boolean {
	return typeof value === "number" && value > 0;
}

function isColorOrNull(value: unknown): boolean {
	return value === null || typeof value === "string";
}
