/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fitDocumentToView, viewPointToDocument } from "./viewport.ts";

describe("fitDocumentToView", () => {
	test("fits a landscape photo to a portrait view's width and centers it", () => {
		const viewport = fitDocumentToView(
			{ width: 4000, height: 3000 },
			{ width: 400, height: 800 },
		);
		assert.equal(viewport.scale, 0.1);
		assert.equal(viewport.offsetX, 0);
		assert.equal(viewport.offsetY, 250);
	});

	test("reports scale 0 before the view has been measured", () => {
		assert.equal(
			fitDocumentToView({ width: 100, height: 100 }, { width: 0, height: 0 })
				.scale,
			0,
		);
	});
});

describe("viewPointToDocument", () => {
	test("maps view points back into document space", () => {
		const viewport = fitDocumentToView(
			{ width: 4000, height: 3000 },
			{ width: 400, height: 800 },
		);
		assert.deepEqual(viewPointToDocument(viewport, { x: 200, y: 400 }), {
			x: 2000,
			y: 1500,
		});
	});
});
