/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createBlankDocument,
	createDocumentFromImage,
	createDrawingLayer,
	createRedactionBox,
	createRedactionStrokes,
	createShapeLayer,
	createTextLayer,
	type EditorDocument,
} from "../model/document.ts";
import {
	isImageFile,
	mapImageUris,
	newImageFile,
	PHOTO_FILE,
	PROJECT_VERSION,
	parseSavedProject,
	projectLabel,
	type SavedProject,
} from "./projectFile.ts";

function documentWithText(...texts: string[]): EditorDocument {
	const document = createDocumentFromImage(
		"file:///photo.jpg",
		4000,
		3000,
		true,
	);
	for (const text of texts) {
		document.layers.push(createTextLayer(document, text));
	}
	return document;
}

function drawingLayer() {
	return createDrawingLayer({
		type: "pen",
		color: "#FF3B30",
		width: 12,
		points: [0, 0, 100, 50],
	});
}

function shapeLayer(shape: "rectangle" | "arrow") {
	return createShapeLayer(
		shape,
		{ x: 50, y: 60, rotation: 0.5, width: 200, height: 100 },
		{ color: "#0A84FF", strokeWidth: 12 },
	);
}

function savedJson(project: Partial<SavedProject> = {}) {
	return JSON.stringify({
		version: PROJECT_VERSION,
		createdAt: 1,
		updatedAt: 2,
		document: mapImageUris(documentWithText("TOP TEXT"), () => "original.jpg"),
		...project,
	});
}

describe("mapImageUris", () => {
	test("rewrites image layers only, and maps back to the same document", () => {
		const document = documentWithText("TOP TEXT");
		const saved = mapImageUris(document, () => "original.jpg");
		assert.equal(
			saved.layers[0].type === "image" && saved.layers[0].uri,
			"original.jpg",
		);
		assert.equal(saved.layers[1], document.layers[1]);
		assert.deepEqual(
			mapImageUris(saved, () => "file:///photo.jpg"),
			document,
		);
	});
});

describe("image files", () => {
	test("the photo's file and new ones are known, and new ones differ", () => {
		const names = new Set(
			Array.from({ length: 50 }, (_, i) => newImageFile(i % 2 === 0)),
		);
		assert.equal(names.size, 50);
		assert.ok(!names.has(PHOTO_FILE));
		for (const name of [PHOTO_FILE, ...names]) {
			assert.ok(isImageFile(name), name);
		}
	});

	test("a new file is a JPEG's for an opaque image, else a PNG's", () => {
		assert.match(newImageFile(true), /\.jpg$/);
		assert.match(newImageFile(false), /\.png$/);
	});

	test("anything else isn't, such as a path or another format", () => {
		const unknown = [
			"",
			"file:///original.jpg",
			"../original.jpg",
			"original.png",
			"image-a/b.jpg",
			"image-a.webp",
			"stickers/cat.png",
		];
		for (const name of unknown) {
			assert.equal(isImageFile(name), false, name);
		}
	});
});

describe("parseSavedProject", () => {
	test("reads back what was saved", () => {
		const project = parseSavedProject(savedJson());
		assert.equal(project?.updatedAt, 2);
		assert.equal(project?.document.layers.length, 2);
	});

	test("keeps a thumbnail, and drops a malformed one but not the project", () => {
		const thumbnail = { url: "data:image/jpeg;base64,AA", updatedAt: 2 };
		assert.deepEqual(
			parseSavedProject(savedJson({ thumbnail }))?.thumbnail,
			thumbnail,
		);
		const malformed = { url: "file:///thumb.jpg", updatedAt: 2 };
		const project = parseSavedProject(savedJson({ thumbnail: malformed }));
		assert.ok(project);
		assert.equal(project.thumbnail, undefined);
	});

	test("reads version 1, from before backgrounds, locks, and flips", () => {
		const current = mapImageUris(documentWithText("TOP"), () => "original.jpg");
		const { background, ...document } = current;
		const layers = document.layers.map((layer) => {
			const { locked, ...rest } = layer;
			if (rest.type !== "image") return rest;
			const { flipped, opaque, ...image } = rest;
			return image;
		});
		const project = parseSavedProject(
			savedJson({ version: 1, document: { ...document, layers } } as never),
		);
		assert.equal(project?.version, PROJECT_VERSION);
		assert.deepEqual(project?.document, current);
	});

	test("reads version 2, when the photo was always first", () => {
		const document = mapImageUris(
			documentWithText("TOP"),
			() => "original.jpg",
		);
		const project = parseSavedProject(savedJson({ version: 2, document }));
		assert.equal(project?.version, PROJECT_VERSION);
		assert.deepEqual(project?.document, document);
	});

	test("reads image layers from before transparent images as opaque", () => {
		const current = mapImageUris(documentWithText("TOP"), () => "original.jpg");
		const layers = current.layers.map((layer) => {
			if (layer.type !== "image") return layer;
			const { opaque, ...image } = layer;
			return image;
		});
		const project = parseSavedProject(
			savedJson({ document: { ...current, layers } } as never),
		);
		assert.deepEqual(project?.document, current);
	});

	test("reads a blank canvas, and a photo that isn't first", () => {
		const blank = createBlankDocument(1080, 1920, "#000000");
		assert.deepEqual(
			parseSavedProject(savedJson({ document: blank }))?.document,
			blank,
		);
		const withText = mapImageUris(
			documentWithText("TOP"),
			() => "original.jpg",
		);
		const reordered = { ...withText, layers: withText.layers.toReversed() };
		assert.deepEqual(
			parseSavedProject(savedJson({ document: reordered }))?.document,
			reordered,
		);
	});

	test("reads several image layers, sharing files or not", () => {
		const document = documentWithText("TOP");
		const [photo] = document.layers;
		const added = "image-abc-123.jpg";
		document.layers.push({ ...photo, id: "copy" }, { ...photo, id: "added" });
		const saved = mapImageUris(document, (uri) => uri);
		saved.layers = saved.layers.map((layer) =>
			layer.type === "image"
				? { ...layer, uri: layer.id === "added" ? added : PHOTO_FILE }
				: layer,
		);
		assert.deepEqual(
			parseSavedProject(savedJson({ document: saved }))?.document,
			saved,
		);
	});

	test("reads a drawing, with pen and eraser strokes", () => {
		const document = documentWithText();
		const drawing = drawingLayer();
		drawing.strokes.push(
			{
				type: "pen",
				color: "#FFD60A",
				width: 40,
				points: [0, 0],
				tip: "marker",
			},
			{ type: "pen", color: "#0A84FF", width: 20, points: [5, 5], tip: "neon" },
			{ type: "eraser", width: 30, points: [10, 10] },
		);
		document.layers.push(drawing);
		const saved = mapImageUris(document, () => "original.jpg");
		const project = parseSavedProject(savedJson({ document: saved }));
		assert.deepEqual(project?.document, saved);
	});

	test("reads redactions: boxes and brushed strokes, solid, blurred, and pixelated", () => {
		const document = documentWithText();
		const strokes = createRedactionStrokes(
			{ type: "pen", width: 40, points: [0, 0, 100, 0] },
			{ type: "blur", radius: 24 },
		);
		strokes.strokes.push({ type: "eraser", width: 20, points: [50, 0] });
		document.layers.push(
			createRedactionBox(
				{ x: 10, y: 20, width: 300, height: 80 },
				{ type: "solid", color: "#000000" },
			),
			strokes,
			createRedactionBox(
				{ x: 0, y: 0, width: 40, height: 40 },
				{ type: "pixelate", size: 16 },
			),
		);
		const saved = mapImageUris(document, () => "original.jpg");
		const project = parseSavedProject(savedJson({ document: saved }));
		assert.deepEqual(project?.document, saved);
	});

	test("reads shapes: boxes and lines", () => {
		const document = documentWithText();
		document.layers.push(shapeLayer("rectangle"), shapeLayer("arrow"));
		const saved = mapImageUris(document, () => "original.jpg");
		const project = parseSavedProject(savedJson({ document: saved }));
		assert.deepEqual(project?.document, saved);
	});

	test("reads a photo-only marker after the last edit is removed", () => {
		const photo = mapImageUris(documentWithText(), () => "original.jpg");
		const project = parseSavedProject(savedJson({ document: photo }));
		assert.equal(project?.document.layers.length, 1);
	});

	test("rejects what this version can't open", () => {
		const photo = mapImageUris(documentWithText(), () => "original.jpg");
		const unreadable = [
			"{ not json",
			"null",
			savedJson({ version: PROJECT_VERSION + 1 }),
			savedJson({ document: { ...photo, layers: null } } as never),
			savedJson({ document: { ...photo, width: 0 } }),
			savedJson({ document: { ...photo, background: 1 } } as never),
			savedJson({
				document: {
					...photo,
					layers: [
						...photo.layers,
						{ ...documentWithText("TEXT").layers[1], font: "missing" },
					],
				},
			} as unknown as Partial<SavedProject>),
			savedJson({
				document: { ...photo, layers: [...photo.layers, { type: "sticker" }] },
			} as unknown as Partial<SavedProject>),
			savedJson({
				document: {
					...photo,
					layers: [
						{
							...photo.layers[0],
							transform: { ...photo.layers[0].transform, x: null },
						},
					],
				},
			} as unknown as Partial<SavedProject>),
			savedJson({
				document: { ...photo, layers: [{ ...photo.layers[0], opaque: 1 }] },
			} as unknown as Partial<SavedProject>),
			...[
				{ type: "pen", width: 4, points: [0, 0] },
				{ type: "pencil", color: "#000", width: 4, points: [0, 0] },
				{ type: "pen", color: "#000", width: 4, points: [0, 0], tip: "chalk" },
				{ type: "eraser", width: 0, points: [0, 0] },
				{ type: "eraser", width: 4, points: [] },
				{ type: "eraser", width: 4, points: [0, 0, 1] },
				{ type: "eraser", width: 4, points: [0, "1"] },
			].map((stroke) =>
				savedJson({
					document: {
						...photo,
						layers: [...photo.layers, { ...drawingLayer(), strokes: [stroke] }],
					},
				} as unknown as Partial<SavedProject>),
			),
			...[
				{ effect: { type: "mosaic", size: 8 } },
				{ effect: { type: "pixelate", size: 0 } },
				{ effect: { type: "blur", radius: 0 } },
				{ effect: { type: "solid" } },
				{ width: 0 },
				{ shape: "circle" },
				{ shape: "strokes" },
				{
					shape: "strokes",
					strokes: [{ type: "pencil", width: 4, points: [0, 0] }],
				},
			].map((patch) =>
				savedJson({
					document: {
						...photo,
						layers: [
							...photo.layers,
							{
								...createRedactionBox(
									{ x: 0, y: 0, width: 10, height: 10 },
									{ type: "blur", radius: 8 },
								),
								...patch,
							},
						],
					},
				} as unknown as Partial<SavedProject>),
			),
			...[
				{ shape: "star" },
				{ color: null },
				{ strokeWidth: 0 },
				{ width: 0 },
				// A line needs a length, not a box.
				{ shape: "line" },
			].map((patch) =>
				savedJson({
					document: {
						...photo,
						layers: [...photo.layers, { ...shapeLayer("rectangle"), ...patch }],
					},
				} as unknown as Partial<SavedProject>),
			),
		];
		for (const json of unreadable) {
			assert.equal(parseSavedProject(json), null, json);
		}
	});
});

describe("projectLabel", () => {
	test("is the top visible text, on one line", () => {
		const document = documentWithText("BOTTOM", "TOP\n  TEXT ");
		assert.equal(projectLabel(document), "TOP TEXT");
		document.layers[2] = { ...document.layers[2], hidden: true };
		assert.equal(projectLabel(document), "BOTTOM");
	});

	test("falls back when there's no text", () => {
		assert.equal(projectLabel(documentWithText()), "Untitled");
		assert.equal(projectLabel(createBlankDocument(100, 100, null)), "Untitled");
	});

	test("reads text at the bottom of the stack", () => {
		const document = createBlankDocument(1080, 1080, "#FFFFFF");
		document.layers.push(createTextLayer(document, "ONLY"));
		assert.equal(projectLabel(document), "ONLY");
	});
});
