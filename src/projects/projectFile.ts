// Relative `.ts` imports keep this loadable by Node's test runner.
import { adjustmentKeys } from "../model/adjustments.ts";
import {
	type EditorDocument,
	isLineShape,
	penTips,
	shapeKinds,
	textFonts,
} from "../model/document.ts";

// Bump when the saved format changes, and teach `parseSavedProject` to read
// the older one. 2 added the canvas's background, layers' `locked`, and
// image layers' `flipped`. 3 stopped pinning the photo as the first layer:
// there may be none. An app that expects it there can't open these.
// Photos added later, each in a file of its own, kept version 3: builds from
// before them open only image layers naming `PHOTO_FILE`, and list the rest
// as unavailable. So did image layers' `opaque`: builds from before it save
// only JPEGs, so a layer without it is opaque, and they don't open PNGs.
// Drawings kept it too: builds from before them list a project that has one
// as unavailable. Names kept it as well: builds from before them list a
// project by its text, and drop its name when they save it. So did redactions, and shapes, for the same reason. So
// did pens' `tip`: builds from before it draw every pen as a plain one. So
// did image layers' `sticker`: builds from before it list a sticker as a
// photo. So did image layers' `adjustments`: builds from before them show
// the image unadjusted.
export const PROJECT_VERSION = 3;

// The file of the photo a project was made from. Saved image layers name a
// file in the project as their `uri`: this one, or an added photo's.
export const PHOTO_FILE = "original.jpg";

const ADDED_PHOTO_FILE = /^image-[a-z0-9-]+\.(jpg|png)$/;

/**
 * A new file name for a photo added to a project: a JPEG's, or a PNG's if
 * it isn't opaque (see `PickedPhoto`).
 */
export function newImageFile(opaque: boolean): string {
	const random = Math.random().toString(36).slice(2, 8);
	return `image-${Date.now().toString(36)}-${random}.${opaque ? "jpg" : "png"}`;
}

/**
 * Whether a saved image layer's `uri` names a file this version writes.
 * Builds from before transparent images know only the JPEGs, which they take
 * to be opaque (see `hasTransparency`), so they can't open a PNG's project.
 */
export function isImageFile(uri: string): boolean {
	return uri === PHOTO_FILE || ADDED_PHOTO_FILE.test(uri);
}

export type SavedProject = {
	version: number;
	createdAt: number;
	updatedAt: number;
	// Image layers' `uri` names a file in the project rather than a URL: where
	// the project lives can change (on iOS, with every app update).
	document: EditorDocument;
	thumbnail?: ProjectThumbnail;
	// Given by renaming; without one, it's listed by its text (see
	// `projectLabel`).
	name?: string;
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
			// Its name, or else its text.
			label: string;
			thumbnail: string | null;
			// Missing, or older than the latest save; see `updateThumbnail`.
			thumbnailOutdated: boolean;
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
		// A bad thumbnail only costs the thumbnail; the list makes a new one.
		// A bad name costs only the name.
		const { thumbnail, name, ...project } = value;
		const named = typeof name === "string" ? projectName(name) : null;
		return {
			...project,
			...(isThumbnail(thumbnail) && { thumbnail }),
			...(named !== null && { name: named }),
		};
	} catch {
		return null;
	}
}

// Enough for a caption, well past what a card shows.
export const NAME_MAX_LENGTH = 60;

/**
 * `text` as a project's name, on one line, or null when that leaves nothing,
 * which lists the project by its text again.
 */
export function projectName(text: string): string | null {
	const name = text
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, NAME_MAX_LENGTH)
		.trim();
	return name || null;
}

// A copy's name ends in " copy", or " copy 2" and on for later ones.
const COPY_SUFFIX = / copy(?: \d+)?$/;

/**
 * The name for a copy of a project listed as `label`, as Finder names one:
 * "label copy", or the first of "label copy 2", "label copy 3", ... that no
 * project is listed as yet. A copy of a copy counts on from the original.
 */
export function copyName(label: string, taken: Iterable<string>): string {
	const listed = new Set(taken);
	const base = label
		.replace(COPY_SUFFIX, "")
		.slice(0, NAME_MAX_LENGTH - " copy 99".length)
		.trim();
	for (let count = 1; ; count++) {
		const name = count === 1 ? `${base} copy` : `${base} copy ${count}`;
		if (!listed.has(name)) return name;
	}
}

/** What a project is listed as: its top text, since that's what it's remembered by. */
export function projectLabel(document: EditorDocument): string {
	for (let i = document.layers.length - 1; i >= 0; i--) {
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

/** An older project as this version would have saved it. */
function upgradeProject(value: unknown): unknown {
	const upgraded = upgradeFromVersion1(value);
	// Every version 2 project is also a version 3 one, with the photo first.
	return upgradeImageOpacity(
		isFields(upgraded) && upgraded.version === 2
			? { ...upgraded, version: 3 }
			: upgraded,
	);
}

/**
 * A project with each image layer saved before transparent images marked
 * opaque, since it's a JPEG. Anything else is returned as is.
 */
function upgradeImageOpacity(value: unknown): unknown {
	if (
		!isFields(value) ||
		!isFields(value.document) ||
		!Array.isArray(value.document.layers)
	) {
		return value;
	}
	const layers: unknown[] = value.document.layers;
	return {
		...value,
		document: {
			...value.document,
			layers: layers.map((layer) =>
				isFields(layer) && layer.type === "image" && !("opaque" in layer)
					? { ...layer, opaque: true }
					: layer,
			),
		},
	};
}

/**
 * A version 1 project as version 2 would have saved it: no background, only
 * the photo locked, and nothing flipped. Anything else is returned as is.
 */
function upgradeFromVersion1(value: unknown): unknown {
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
	return (
		isFields(value) &&
		Array.isArray(value.layers) &&
		isPositive(value.width) &&
		isPositive(value.height) &&
		isColorOrNull(value.background) &&
		value.layers.every(isLayer)
	);
}

function isLayer(value: unknown): boolean {
	if (
		!isFields(value) ||
		typeof value.id !== "string" ||
		typeof value.hidden !== "boolean" ||
		typeof value.locked !== "boolean" ||
		(value.resizable !== undefined && typeof value.resizable !== "boolean") ||
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
				typeof value.flipped === "boolean" &&
				typeof value.opaque === "boolean" &&
				(value.sticker === undefined || typeof value.sticker === "boolean") &&
				(value.adjustments === undefined || isAdjustments(value.adjustments))
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
		case "drawing":
			return Array.isArray(value.strokes) && value.strokes.every(isStroke);
		case "redaction":
			return isRedactionEffect(value.effect) && isRedactionShape(value);
		case "shape":
			return isShape(value);
		default:
			return false;
	}
}

function isAdjustments(value: unknown): boolean {
	return (
		isFields(value) &&
		adjustmentKeys.every((key) => {
			const amount = value[key];
			return typeof amount === "number" && Math.abs(amount) <= 1;
		})
	);
}

function isShape(value: Fields): boolean {
	const shape = shapeKinds.find((kind) => kind === value.shape);
	return (
		shape !== undefined &&
		typeof value.color === "string" &&
		isPositive(value.strokeWidth) &&
		(isLineShape(shape)
			? isPositive(value.length)
			: isPositive(value.width) && isPositive(value.height))
	);
}

function isRedactionEffect(value: unknown): boolean {
	return (
		isFields(value) &&
		((value.type === "solid" && typeof value.color === "string") ||
			(value.type === "blur" && isPositive(value.radius)) ||
			(value.type === "pixelate" && isPositive(value.size)))
	);
}

function isRedactionShape(value: Fields): boolean {
	switch (value.shape) {
		case "box":
			return isPositive(value.width) && isPositive(value.height);
		case "strokes":
			return Array.isArray(value.strokes) && value.strokes.every(isMaskStroke);
		default:
			return false;
	}
}

function isStroke(value: unknown): boolean {
	return (
		isMaskStroke(value) &&
		isFields(value) &&
		(value.type === "eraser" ||
			(typeof value.color === "string" &&
				(value.tip === undefined || penTips.some((tip) => tip === value.tip))))
	);
}

function isMaskStroke(value: unknown): boolean {
	return (
		isFields(value) &&
		(value.type === "pen" || value.type === "eraser") &&
		isPositive(value.width) &&
		Array.isArray(value.points) &&
		value.points.length >= 2 &&
		value.points.length % 2 === 0 &&
		value.points.every(Number.isFinite)
	);
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
