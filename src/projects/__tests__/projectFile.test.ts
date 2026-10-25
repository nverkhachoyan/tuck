/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatCreatedAt } from "../../lib/formatCreatedAt.ts";
import { withMask } from "../../model/cutout.ts";
import {
	createBlankDocument,
	createDocumentFromImage,
	type EditorDocument,
} from "../../model/document.ts";
import { createDrawingLayer } from "../../model/layers/drawing.ts";
import {
	createStickerLayer,
	type ImageLayer,
	withAdjustments,
} from "../../model/layers/image.ts";
import {
	createMaskedRedaction,
	createRedactionBox,
	createRedactionStrokes,
} from "../../model/layers/redaction.ts";
import { createShapeLayer } from "../../model/layers/shape.ts";
import { createTextLayer } from "../../model/layers/text.ts";
import type { MaskStroke } from "../../model/strokes.ts";
import {
	copyName,
	imageFiles,
	isImageFile,
	mapImageUris,
	newImageFile,
	PHOTO_FILE,
	PROJECT_VERSION,
	parseSavedProject,
	projectLabel,
	projectName,
	type SavedProject,
} from "../projectFile.ts";

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

describe("imageFiles", () => {
	test("names each image and mask file once", () => {
		const document = documentWithText("TOP TEXT");
		const [photo] = document.layers as ImageLayer[];
		document.layers.push(withMask(photo, "file:///mask.png"), photo);
		assert.deepEqual(
			[...imageFiles(document)],
			["file:///photo.jpg", "file:///mask.png"],
		);
	});

	test("names a masked redaction's mask, and maps it", () => {
		const document = documentWithText();
		const [photo] = document.layers as ImageLayer[];
		document.layers.push(
			createMaskedRedaction(
				photo,
				"file:///selection.png",
				{ x: 10, y: 20, width: 300, height: 400 },
				{ type: "blur", radius: 24 },
			),
		);
		assert.deepEqual(
			[...imageFiles(document)],
			["file:///photo.jpg", "file:///selection.png"],
		);
		const saved = mapImageUris(document, (uri) => uri.slice(8));
		const [, redaction] = saved.layers;
		assert.equal(
			redaction.type === "redaction" &&
				redaction.shape === "mask" &&
				redaction.mask,
			"selection.png",
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

	test("reads a sticker, an image layer in a file of its own", () => {
		const document = documentWithText();
		document.layers.push(
			createStickerLayer(document, "image-abc-123.png", 512, 512, false),
		);
		const saved = mapImageUris(document, (uri) =>
			uri === "image-abc-123.png" ? uri : PHOTO_FILE,
		);
		const project = parseSavedProject(savedJson({ document: saved }));
		assert.deepEqual(project?.document, saved);
	});

	test("reads an image layer's adjustments", () => {
		const document = documentWithText();
		document.layers[0] = withAdjustments(document.layers[0] as ImageLayer, {
			brightness: 0.25,
			contrast: -1,
			saturation: 1,
			temperature: -0.4,
		});
		const saved = mapImageUris(document, () => PHOTO_FILE);
		const project = parseSavedProject(savedJson({ document: saved }));
		assert.deepEqual(project?.document, saved);
	});

	test("reads a cut-out image, its mask in a file of its own", () => {
		const document = documentWithText();
		document.layers[0] = withMask(
			document.layers[0] as ImageLayer,
			"image-abc-123.png",
		);
		const saved = mapImageUris(document, (uri) =>
			uri === "image-abc-123.png" ? uri : PHOTO_FILE,
		);
		const project = parseSavedProject(savedJson({ document: saved }));
		assert.deepEqual(project?.document, saved);
		assert.equal(
			parseSavedProject(
				savedJson({
					document: {
						...saved,
						layers: [{ ...saved.layers[0], mask: 1 } as unknown as ImageLayer],
					},
				}),
			),
			null,
		);
	});

	test("reads a cut refined by hand, and rejects damaged strokes", () => {
		const document = mapImageUris(documentWithText(), () => PHOTO_FILE);
		const photo = document.layers[0] as ImageLayer;
		const stroke: MaskStroke = {
			type: "eraser",
			width: 12,
			points: [1, 2, 3, 4],
		};
		document.layers[0] = {
			...photo,
			maskStrokes: [stroke, { ...stroke, feather: 2 }],
		};
		assert.deepEqual(
			parseSavedProject(savedJson({ document }))?.document,
			document,
		);
		for (const maskStrokes of [
			[],
			[{ ...stroke, points: [1] }],
			[{ ...stroke, feather: -1 }],
			"strokes",
		]) {
			const damaged = {
				...document,
				layers: [{ ...photo, maskStrokes } as unknown as ImageLayer],
			};
			assert.equal(parseSavedProject(savedJson({ document: damaged })), null);
		}
	});

	test("reads version 4, from before cut-outs, as it was", () => {
		const document = mapImageUris(documentWithText("A"), () => PHOTO_FILE);
		const project = parseSavedProject(savedJson({ version: 4, document }));
		assert.equal(project?.version, PROJECT_VERSION);
		assert.deepEqual(project?.document, document);
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

	test("reads redactions: boxes, brushed strokes, and masks, solid, blurred, and pixelated", () => {
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
			createMaskedRedaction(
				document.layers[0] as ImageLayer,
				"file:///selection.png",
				{ x: 10, y: 20, width: 300, height: 400 },
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

	test("keeps a name, and drops a malformed one but not the project", () => {
		assert.equal(parseSavedProject(savedJson({ name: "Trip" }))?.name, "Trip");
		for (const name of [3, "   "]) {
			const project = parseSavedProject(
				savedJson({ name } as unknown as Partial<SavedProject>),
			);
			assert.ok(project);
			assert.equal("name" in project, false);
		}
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
			savedJson({
				document: {
					...photo,
					layers: [{ ...photo.layers[0], sticker: "yes" }],
				},
			} as unknown as Partial<SavedProject>),
			...[
				"warm",
				{ brightness: 0.5, contrast: 0, saturation: 0 },
				{ brightness: 1.5, contrast: 0, saturation: 0, temperature: 0 },
				{ brightness: null, contrast: 0, saturation: 0, temperature: 0 },
				{ brightness: "0", contrast: 0, saturation: 0, temperature: 0 },
			].map((adjustments) =>
				savedJson({
					document: { ...photo, layers: [{ ...photo.layers[0], adjustments }] },
				} as unknown as Partial<SavedProject>),
			),
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
	const createdAt = new Date(2026, 9, 24, 15, 15).getTime();
	const dated = (kind: "Photo" | "Canvas") =>
		`${kind} · ${formatCreatedAt(createdAt)}`;

	test("is the top visible text, on one line", () => {
		const document = documentWithText("BOTTOM", "TOP\n  TEXT ");
		assert.equal(projectLabel(document, createdAt), "TOP TEXT");
		document.layers[2] = { ...document.layers[2], hidden: true };
		assert.equal(projectLabel(document, createdAt), "BOTTOM");
	});

	test("falls back to what the project holds and when it was made", () => {
		assert.equal(projectLabel(documentWithText(), createdAt), dated("Photo"));
		assert.equal(
			projectLabel(createBlankDocument(100, 100, null), createdAt),
			dated("Canvas"),
		);
		const hidden = documentWithText("SECRET");
		hidden.layers[1] = { ...hidden.layers[1], hidden: true };
		assert.equal(projectLabel(hidden, createdAt), dated("Photo"));
		assert.equal(
			projectLabel(documentWithText(), createdAt, "Keeper"),
			"Keeper",
		);
	});

	test("reads text at the bottom of the stack", () => {
		const document = createBlankDocument(1080, 1080, "#FFFFFF");
		document.layers.push(createTextLayer(document, "ONLY"));
		assert.equal(projectLabel(document, createdAt), "ONLY");
	});
});

describe("projectName", () => {
	test("is the text on one line, trimmed", () => {
		assert.equal(projectName("  Trip\n to\tRome "), "Trip to Rome");
	});

	test("is null for blank text, which lists a project by its text", () => {
		assert.equal(projectName(" \n "), null);
	});

	test("is cut to the longest a name can be", () => {
		assert.equal(projectName("a".repeat(100))?.length, 60);
	});
});

describe("copyName", () => {
	test("adds copy, then counts on past names that are taken", () => {
		assert.equal(copyName("Trip", ["Trip"]), "Trip copy");
		assert.equal(copyName("Trip", ["Trip", "Trip copy"]), "Trip copy 2");
		assert.equal(
			copyName("Trip", ["Trip copy", "Trip copy 2", "Trip copy 4"]),
			"Trip copy 3",
		);
	});

	test("counts a copy of a copy on from the original", () => {
		assert.equal(copyName("Trip copy", ["Trip copy"]), "Trip copy 2");
		assert.equal(copyName("Trip copy 2", ["Trip copy"]), "Trip copy 2");
	});

	test("names a copy of a dated label from that label", () => {
		const label = "Photo · Oct 24, 3:15 PM";
		assert.equal(copyName(label, []), `${label} copy`);
		assert.equal(copyName(label, [`${label} copy`]), `${label} copy 2`);
	});

	test("leaves room for the count after a long label", () => {
		const name = copyName("a".repeat(100), []);
		assert.ok(projectName(`${name} 99`)?.endsWith(" 99"));
	});
});
