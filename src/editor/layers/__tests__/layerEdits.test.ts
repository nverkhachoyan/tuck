/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDocumentFromImage,
	type EditorDocument,
} from "../../document/document.ts";
import { identityTransform } from "../base.ts";
import type { ImageLayer } from "../image/image.ts";
import {
	deleteLayer,
	deleteLayerGroup,
	moveLayer,
	nudgeLayer,
	resizeBox,
	setLayerFlag,
	setLayerGroupFlag,
	setLayerResizable,
	transformLayer,
} from "../layerEdits.ts";
import { addRedactionBoxes } from "../redaction/redactionEdits.ts";
import type { TextLayer } from "../text/text.ts";
import { addTextLayer } from "../text/textEdits.ts";

// The photo, locked, under an unlocked text layer.
const document = () =>
	addTextLayer(
		createDocumentFromImage("file:///photo.jpg", 4000, 3000, true),
		"Hello",
	);
const text = (document: EditorDocument) =>
	document.layers.find((layer) => layer.type === "text") as TextLayer;
const textId = (document: EditorDocument) => text(document).id;

const black = { type: "solid", color: "#000000" } as const;
const placement = { width: 40, height: 20, transform: identityTransform };
// Two found boxes in a group, over the photo and text.
const found = () =>
	addRedactionBoxes(document(), [placement, placement], black, "Faces");
const groupOf = (document: EditorDocument) => document.groups?.[0]?.id ?? "";

describe("setLayerFlag", () => {
	test("hides and locks a layer", () => {
		const start = document();
		const hidden = setLayerFlag(start, textId(start), "hidden", true);
		assert.equal(text(hidden).hidden, true);
		const locked = setLayerFlag(hidden, textId(start), "locked", true);
		assert.equal(text(locked).locked, true);
	});

	test("leaves the document be when the flag is already set", () => {
		const start = document();
		assert.equal(setLayerFlag(start, "photo", "locked", true), start);
		assert.equal(setLayerFlag(start, textId(start), "hidden", false), start);
		assert.equal(setLayerFlag(start, "gone", "hidden", true), start);
	});
});

describe("setLayerGroupFlag", () => {
	test("sets the flag on every layer in the group", () => {
		const start = found();
		const hidden = setLayerGroupFlag(start, groupOf(start), "hidden", true);
		const boxes = hidden.layers.filter((layer) => layer.type === "redaction");
		assert.equal(boxes.length, 2);
		assert.ok(boxes.every((box) => box.hidden));
		assert.equal(text(hidden).hidden, false);
	});

	test("leaves the document be when nothing in the group changes", () => {
		const start = found();
		assert.equal(
			setLayerGroupFlag(start, groupOf(start), "hidden", false),
			start,
		);
		assert.equal(setLayerGroupFlag(start, "gone", "hidden", true), start);
	});
});

describe("deleteLayer", () => {
	test("removes the layer, and it from its group", () => {
		const start = found();
		const [box] = start.groups?.[0]?.layerIds ?? [];
		const next = deleteLayer(start, box);
		assert.equal(next.layers.length, 3);
		assert.equal(next.groups?.[0]?.layerIds.length, 1);
		const emptied = deleteLayer(next, next.groups?.[0]?.layerIds[0] ?? "");
		assert.deepEqual(emptied.groups, []);
	});

	test("leaves the document be for a layer that's gone", () => {
		const start = document();
		assert.equal(deleteLayer(start, "gone"), start);
	});
});

describe("deleteLayerGroup", () => {
	test("removes the group and its layers", () => {
		const start = found();
		const next = deleteLayerGroup(start, groupOf(start));
		assert.equal(next.layers.length, 2);
		assert.deepEqual(next.groups, []);
		assert.equal(deleteLayerGroup(start, "gone"), start);
	});
});

describe("moveLayer", () => {
	test("reorders the stack, and leaves it be in place", () => {
		const start = document();
		const moved = moveLayer(start, textId(start), 0);
		assert.equal(moved.layers[0].id, textId(start));
		assert.equal(moveLayer(start, textId(start), 1), start);
		assert.equal(moveLayer(start, "gone", 0), start);
	});
});

describe("transformLayer", () => {
	test("moves an unlocked layer", () => {
		const start = document();
		const transform = { ...text(start).transform, rotation: 1 };
		const next = transformLayer(start, textId(start), transform);
		assert.deepEqual(text(next).transform, transform);
		assert.equal(transformLayer(next, textId(start), { ...transform }), next);
	});

	test("leaves a locked layer where it is", () => {
		const start = document();
		const photo = start.layers[0] as ImageLayer;
		const transform = { ...photo.transform, x: 0 };
		assert.equal(transformLayer(start, "photo", transform), start);
	});
});

describe("resizeBox", () => {
	test("resizes an unlocked box", () => {
		const start = found();
		const [box] = start.groups?.[0]?.layerIds ?? [];
		const next = resizeBox(start, box, identityTransform, 80, 20);
		const resized = next.layers.find((layer) => layer.id === box);
		assert.equal(
			resized?.type === "redaction" && resized.shape === "box" && resized.width,
			80,
		);
	});

	test("leaves the document be for no change, no area, or a locked box", () => {
		const start = found();
		const [box] = start.groups?.[0]?.layerIds ?? [];
		assert.equal(resizeBox(start, box, identityTransform, 40, 20), start);
		assert.equal(resizeBox(start, box, identityTransform, 0, 20), start);
		const locked = setLayerFlag(start, box, "locked", true);
		assert.equal(resizeBox(locked, box, identityTransform, 80, 20), locked);
	});
});

describe("setLayerResizable", () => {
	test("lets text be resized, and leaves the document be when it can", () => {
		const start = document();
		const next = setLayerResizable(start, textId(start), true);
		assert.equal(text(next).resizable, true);
		assert.equal(setLayerResizable(next, textId(start), true), next);
	});

	test("changes only unlocked images and text", () => {
		const start = found();
		const [box] = start.groups?.[0]?.layerIds ?? [];
		assert.equal(setLayerResizable(start, box, true), start);
		assert.equal(setLayerResizable(start, "photo", true), start);
	});
});

describe("nudgeLayer", () => {
	test("moves an unlocked layer by the offset", () => {
		const start = document();
		const { x, y } = text(start).transform;
		const next = nudgeLayer(start, textId(start), 3, -4);
		assert.equal(text(next).transform.x, x + 3);
		assert.equal(text(next).transform.y, y - 4);
	});

	test("leaves the document be for no offset or a locked layer", () => {
		const start = document();
		assert.equal(nudgeLayer(start, textId(start), 0, 0), start);
		assert.equal(nudgeLayer(start, "photo", 3, 0), start);
	});
});
