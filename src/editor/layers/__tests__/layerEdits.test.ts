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
	arrangeLayers,
	canArrangeLayers,
	deleteLayer,
	deleteLayerGroup,
	deleteLayers,
	duplicateLayers,
	moveLayer,
	nudgeLayer,
	nudgeLayers,
	resizeBox,
	setLayerFlag,
	setLayerGroupFlag,
	setLayerResizable,
	transformLayer,
	transformLayers,
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

function stack() {
	let d = document();
	d = addTextLayer(d, "B");
	d = addTextLayer(d, "C");
	d = addTextLayer(d, "D");
	const [, a, b, c, dLayer] = d.layers as [
		ImageLayer,
		TextLayer,
		TextLayer,
		TextLayer,
		TextLayer,
	];
	return { document: d, a, b, c, d: dLayer };
}

describe("deleteLayers", () => {
	test("removes every listed layer and updates groups", () => {
		const start = found();
		const [boxA, boxB] = start.groups?.[0]?.layerIds ?? [];
		const next = deleteLayers(start, [textId(start), boxA, boxB]);
		assert.deepEqual(
			next.layers.map((layer) => layer.id),
			["photo"],
		);
		assert.deepEqual(next.groups, []);
	});

	test("returns the same document when nothing matches", () => {
		const start = document();
		assert.equal(deleteLayers(start, []), start);
		assert.equal(deleteLayers(start, ["missing"]), start);
	});
});

describe("duplicateLayers", () => {
	test("copies listed layers on top in document order and returns copy ids", () => {
		const { document: start, a, c } = stack();
		const { document: next, copyIds } = duplicateLayers(start, [c.id, a.id]);
		assert.equal(copyIds.length, 2);
		const copies = next.layers.slice(-2) as TextLayer[];
		assert.deepEqual(
			copies.map((layer) => layer.id),
			copyIds,
		);
		assert.deepEqual(
			copies.map((layer) => layer.text),
			[a.text, c.text],
		);
		assert.ok(copies[0].transform.x > a.transform.x);
		assert.ok(copies[1].transform.y > c.transform.y);
	});

	test("returns the same document when nothing matches", () => {
		const start = document();
		const empty = duplicateLayers(start, []);
		assert.equal(empty.document, start);
		assert.deepEqual(empty.copyIds, []);
		const missing = duplicateLayers(start, ["missing"]);
		assert.equal(missing.document, start);
		assert.deepEqual(missing.copyIds, []);
	});
});

describe("arrangeLayers", () => {
	const idsOf = (d: EditorDocument) => d.layers.map((layer) => layer.id);

	test("moves non-contiguous layers while keeping relative order and locked layers fixed", () => {
		const { document: start, a, b, c, d } = stack();
		// Order: [photo(locked), a, b, c, d]
		assert.deepEqual(idsOf(arrangeLayers(start, [a.id, c.id], "front")), [
			"photo",
			b.id,
			d.id,
			a.id,
			c.id,
		]);
		assert.deepEqual(idsOf(arrangeLayers(start, [b.id, d.id], "back")), [
			"photo",
			b.id,
			d.id,
			a.id,
			c.id,
		]);
		assert.deepEqual(idsOf(arrangeLayers(start, [a.id, c.id], "forward")), [
			"photo",
			b.id,
			a.id,
			d.id,
			c.id,
		]);
		assert.deepEqual(idsOf(arrangeLayers(start, [b.id, d.id], "backward")), [
			"photo",
			b.id,
			a.id,
			d.id,
			c.id,
		]);
	});

	test("keeps a locked layer in the middle at its index", () => {
		const { document: start, a, b, c, d } = stack();
		const withLockedMid = setLayerFlag(start, b.id, "locked", true);
		// Order: [photo(locked), a, b(locked), c, d]
		const moved = arrangeLayers(withLockedMid, [a.id], "forward");
		assert.deepEqual(idsOf(moved), ["photo", c.id, b.id, a.id, d.id]);
		assert.equal(arrangeLayers(withLockedMid, [b.id], "front"), withLockedMid);
	});

	test("returns the same document when already at the limit", () => {
		const { document: start, a, b, c, d } = stack();
		assert.equal(arrangeLayers(start, [c.id, d.id], "front"), start);
		assert.equal(arrangeLayers(start, [c.id, d.id], "forward"), start);
		assert.equal(arrangeLayers(start, [a.id, b.id], "back"), start);
		assert.equal(arrangeLayers(start, [a.id, b.id], "backward"), start);
		assert.equal(arrangeLayers(start, [], "front"), start);
		assert.equal(
			canArrangeLayers(start.layers, [c.id, d.id], "forward"),
			false,
		);
		assert.equal(
			canArrangeLayers(start.layers, [c.id, d.id], "backward"),
			true,
		);
		assert.equal(
			canArrangeLayers(start.layers, [a.id, b.id], "backward"),
			false,
		);
		assert.equal(canArrangeLayers(start.layers, [a.id, b.id], "forward"), true);
	});
});

describe("nudgeLayers", () => {
	test("nudges unlocked listed layers and ignores locked ones", () => {
		const { document: start, a, b } = stack();
		const next = nudgeLayers(start, ["photo", a.id, b.id], 10, -5);
		assert.equal(next.layers[0], start.layers[0]);
		assert.equal(next.layers[1].transform.x, a.transform.x + 10);
		assert.equal(next.layers[2].transform.y, b.transform.y - 5);
		assert.equal(next.layers[3], start.layers[3]);
	});

	test("returns the same document for zero offset or no unlocked targets", () => {
		const { document: start, a } = stack();
		assert.equal(nudgeLayers(start, [a.id], 0, 0), start);
		assert.equal(nudgeLayers(start, ["photo"], 5, 5), start);
		assert.equal(nudgeLayers(start, [], 5, 5), start);
	});
});

describe("transformLayers", () => {
	test("transforms unlocked listed layers about a pivot", () => {
		const { document: start, a, b } = stack();
		const placed = transformLayer(
			transformLayer(start, a.id, { ...a.transform, x: 100, y: 200 }),
			b.id,
			{ ...b.transform, x: 300, y: 200 },
		);
		const next = transformLayers(placed, ["photo", a.id, b.id], {
			pivot: { x: 200, y: 200 },
			dx: 20,
			dy: 10,
			scale: 2,
			rotation: Math.PI / 2,
		});
		assert.equal(next.layers[0], placed.layers[0]);
		assert.equal(next.layers[1].transform.x, 220);
		assert.equal(next.layers[1].transform.y, 10);
		assert.equal(next.layers[1].transform.scaleX, 2);
		assert.equal(next.layers[2].transform.x, 220);
		assert.equal(next.layers[2].transform.y, 410);
		assert.equal(next.layers[2].transform.rotation, Math.PI / 2);
	});

	test("returns the same document on a no-op change or locked layers", () => {
		const { document: start, a } = stack();
		assert.equal(
			transformLayers(start, [a.id], {
				pivot: { x: 0, y: 0 },
				dx: 0,
				dy: 0,
				scale: 1,
				rotation: 0,
			}),
			start,
		);
		assert.equal(
			transformLayers(start, ["photo"], {
				pivot: { x: 0, y: 0 },
				dx: 10,
				dy: 0,
				scale: 1,
				rotation: 0,
			}),
			start,
		);
	});
});
