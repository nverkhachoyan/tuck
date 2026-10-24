/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDrawingLayer } from "../../../../model/layers/drawing.ts";
import { createImageLayer } from "../../../../model/layers/image.ts";
import { createRedactionBox } from "../../../../model/layers/redaction.ts";
import { createShapeLayer } from "../../../../model/layers/shape.ts";
import { createTextLayer } from "../../../../model/layers/text.ts";
import { layerActionsFor } from "../layerActions.ts";

const canvas = { width: 100, height: 100 };
const effect = { type: "solid", color: "#000000" } as const;
const start = {
	text: () => "text",
	draw: () => "draw",
	redact: () => "redact",
	find: () => "find",
	sticker: () => "sticker",
	photo: () => "photo",
	crop: () => "crop",
	adjust: () => "adjust",
	cutOut: () => "cutOut",
};

const offered = (layer: Parameters<typeof layerActionsFor>[0]["layer"]) => {
	const actions = layerActionsFor({
		layer,
		startTool: start,
		sticker: undefined,
		onSaveSticker: undefined,
	});
	return [
		actions.onDraw?.(),
		actions.onRedact?.(),
		actions.onAdjust?.(),
		actions.onFind?.(),
		actions.onCutOut?.(),
	].filter((action) => action !== undefined);
};

describe("layerActionsFor", () => {
	test("a photo can be redacted, adjusted, found, and cut out", () => {
		const photo = createImageLayer(canvas, "photo.jpg", 100, 100, true);
		assert.deepEqual(offered(photo), ["redact", "adjust", "find", "cutOut"]);
		assert.deepEqual(offered({ ...photo, hidden: true }), ["redact", "adjust"]);
	});

	test("a drawing or a shape is drawn, and a redaction is redacted", () => {
		assert.deepEqual(
			offered(
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
			offered(
				createShapeLayer(
					"rectangle",
					{ x: 0, y: 0, rotation: 0, width: 40, height: 20 },
					{ color: "#FF3B30", strokeWidth: 4 },
				),
			),
			["draw"],
		);
		assert.deepEqual(
			offered(
				createRedactionBox({ x: 0, y: 0, width: 40, height: 20 }, effect),
			),
			["redact"],
		);
	});

	test("text offers none of these, and a sticker save is passed through", () => {
		assert.deepEqual(offered(createTextLayer(canvas, "Hello")), []);
		const save = () => {};
		const actions = layerActionsFor({
			layer: createTextLayer(canvas, "Hello"),
			startTool: start,
			sticker: "saved",
			onSaveSticker: save,
		});
		assert.equal(actions.sticker, "saved");
		assert.equal(actions.onSaveSticker, save);
	});
});
