/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../../model/layers/drawing.ts";
import { createImageLayer } from "../../../model/layers/image.ts";
import { createRedactionBox } from "../../../model/layers/redaction.ts";
import { createShapeLayer } from "../../../model/layers/shape.ts";
import { createTextLayer } from "../../../model/layers/text.ts";
import { layerActionsFor } from "../layerActions.ts";

const canvas = { width: 100, height: 100 };
const effect = { type: "solid", color: "#000000" } as const;
describe("layerActionsFor", () => {
	test("a photo can be redacted, adjusted, found, and cut out", () => {
		const photo = createImageLayer(canvas, "photo.jpg", 100, 100, true);
		assert.deepEqual(layerActionsFor(photo), [
			"redact",
			"adjust",
			"find",
			"cutOut",
		]);
		assert.deepEqual(layerActionsFor({ ...photo, hidden: true }), [
			"redact",
			"adjust",
		]);
	});

	test("a drawing or a shape is drawn, and a redaction is redacted", () => {
		assert.deepEqual(
			layerActionsFor(
				createDrawingLayer({
					type: "pen",
					color: "#FF3B30",
					width: 10,
					points: [0, 0, 10, 10],
				}),
			),
			["draw"],
		);
		assert.deepEqual(
			layerActionsFor(
				createShapeLayer(
					"rectangle",
					{ x: 0, y: 0, rotation: 0, width: 40, height: 20 },
					{ color: "#FF3B30", strokeWidth: 4 },
				),
			),
			["draw"],
		);
		assert.deepEqual(
			layerActionsFor(
				createRedactionBox({ x: 0, y: 0, width: 40, height: 20 }, effect),
			),
			["redact"],
		);
	});

	test("text offers none of these", () => {
		assert.deepEqual(layerActionsFor(createTextLayer(canvas, "Hello")), []);
	});
});
