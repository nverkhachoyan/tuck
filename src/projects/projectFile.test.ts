/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDocumentFromImage,
	createTextLayer,
	type EditorDocument,
} from "../model/document.ts";
import {
	mapImageUris,
	PROJECT_VERSION,
	parseSavedProject,
	projectLabel,
	type SavedProject,
} from "./projectFile.ts";

function documentWithText(...texts: string[]): EditorDocument {
	const document = createDocumentFromImage("file:///photo.jpg", 4000, 3000);
	for (const text of texts) {
		document.layers.push(createTextLayer(document, text, "center"));
	}
	return document;
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

describe("parseSavedProject", () => {
	test("reads back what was saved", () => {
		const project = parseSavedProject(savedJson());
		assert.equal(project?.updatedAt, 2);
		assert.equal(project?.document.layers.length, 2);
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
			savedJson({ document: { ...photo, layers: [] } }),
			savedJson({ document: { ...photo, width: 0 } }),
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
	});
});
