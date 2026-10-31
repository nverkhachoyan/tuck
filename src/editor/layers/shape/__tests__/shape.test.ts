/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { convertShape, createShapeLayer, restyleShape } from "../shape.ts";

const style = { color: "#FF3B30", strokeWidth: 12 };
const rectangle = () =>
	createShapeLayer(
		"rectangle",
		{ x: 500, y: 300, rotation: 0, width: 200, height: 100 },
		style,
	);
const arrow = () =>
	createShapeLayer(
		"arrow",
		{ x: 500, y: 300, rotation: Math.PI / 4, width: 400, height: 0 },
		style,
	);

describe("createShapeLayer", () => {
	test("places a box shape at its center, upright, at its size", () => {
		const shape = rectangle();
		assert.equal(shape.type, "shape");
		assert.equal(shape.shape, "rectangle");
		assert.deepEqual(shape.transform, {
			x: 500,
			y: 300,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		});
		assert.equal(shape.shape === "rectangle" && shape.width, 200);
		assert.equal(shape.shape === "rectangle" && shape.height, 100);
		assert.equal(shape.color, "#FF3B30");
		assert.equal(shape.strokeWidth, 12);
	});

	test("turns a line to its angle, and takes its width as its length", () => {
		const shape = arrow();
		assert.equal(shape.transform.rotation, Math.PI / 4);
		assert.equal(shape.shape === "arrow" && shape.length, 400);
		assert.equal("width" in shape, false);
	});
});

describe("restyleShape", () => {
	test("changes the color, thickness, or kind within its geometry", () => {
		const shape = rectangle();
		const restyled = restyleShape(shape, {
			shape: "ellipse",
			color: "#FFFFFF",
			strokeWidth: 4,
		});
		assert.deepEqual(restyled, {
			...shape,
			shape: "ellipse",
			color: "#FFFFFF",
			strokeWidth: 4,
		});
		assert.equal(restyleShape(arrow(), { shape: "line" }).shape, "line");
	});

	test("keeps a box a box and a line a line", () => {
		const box = rectangle();
		assert.equal(restyleShape(box, { shape: "arrow" }), box);
		const line = arrow();
		assert.equal(
			restyleShape(line, { shape: "ellipse", color: "#FFFFFF" }).shape,
			"arrow",
		);
	});

	test("returns the same layer when nothing changes", () => {
		const shape = rectangle();
		assert.equal(restyleShape(shape, {}), shape);
		assert.equal(restyleShape(shape, { ...style, shape: "rectangle" }), shape);
	});
});

describe("convertShape", () => {
	test("delegates to restyleShape within the same geometry family", () => {
		const box = rectangle();
		const converted = convertShape(box, { shape: "ellipse", color: "#0A84FF" });
		assert.equal(converted.shape, "ellipse");
		assert.equal(converted.color, "#0A84FF");
		assert.equal("width" in converted && converted.width, 200);

		const line = arrow();
		const convertedLine = convertShape(line, { shape: "line", strokeWidth: 8 });
		assert.equal(convertedLine.shape, "line");
		assert.equal(convertedLine.strokeWidth, 8);
		assert.equal("length" in convertedLine && convertedLine.length, 400);
	});

	test("converts BoxShape to LineShape, preserving base fields", () => {
		const box = rectangle();
		const converted = convertShape(box, { shape: "arrow", color: "#FFD60A" });
		assert.equal(converted.shape, "arrow");
		assert.equal(converted.color, "#FFD60A");
		assert.equal(converted.strokeWidth, box.strokeWidth);
		assert.equal(converted.id, box.id);
		assert.deepEqual(converted.transform, box.transform);
		assert.equal(converted.hidden, box.hidden);
		assert.equal(converted.locked, box.locked);
		assert.equal("length" in converted && converted.length, 200);
		assert.equal("width" in converted, false);
	});

	test("converts LineShape to BoxShape, preserving base fields", () => {
		const line = arrow();
		const converted = convertShape(line, { shape: "rectangle" });
		assert.equal(converted.shape, "rectangle");
		assert.equal(converted.color, line.color);
		assert.equal(converted.id, line.id);
		assert.deepEqual(converted.transform, line.transform);
		assert.equal("width" in converted && converted.width, 400);
		assert.equal(
			"height" in converted && converted.height,
			Math.round(400 * 0.65),
		);
		assert.equal("length" in converted, false);
	});
});
