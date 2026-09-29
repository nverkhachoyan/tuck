/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	blendViewports,
	clampViewport,
	fitDocumentToView,
	fitRectToView,
	fitToFrame,
	panViewport,
	type ViewFrame,
	viewPointToDocument,
	viewportForZoom,
	viewRectToDocument,
	zoomForViewport,
	zoomViewportAbout,
} from "./viewport.ts";

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

	test("keeps the inset clear around the photo", () => {
		const viewport = fitDocumentToView(
			{ width: 4000, height: 3000 },
			{ width: 432, height: 800 },
			16,
		);
		assert.equal(viewport.scale, 0.1);
		assert.equal(viewport.offsetX, 16);
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

describe("fitRectToView", () => {
	test("fits a rectangle that doesn't start at the origin", () => {
		const viewport = fitRectToView(
			{ x: -2000, y: -1500, width: 4000, height: 3000 },
			{ width: 400, height: 800 },
		);
		assert.equal(viewport.scale, 0.1);
		// The rectangle's center lands in the view's.
		assert.equal(viewport.offsetX, 200);
		assert.equal(viewport.offsetY, 400);
	});

	test("leaves the fit inset available as outward drag room", () => {
		const bounds = { x: -2000, y: -1500, width: 4000, height: 3000 };
		const viewSize = { width: 440, height: 800 };
		const viewport = fitRectToView(bounds, viewSize, 20);
		const visible = viewRectToDocument(viewport, viewSize);
		assert.ok(visible.x < bounds.x);
		assert.ok(visible.x + visible.width > bounds.x + bounds.width);
	});
});

describe("blendViewports", () => {
	test("goes from the first viewport to the second", () => {
		const from = { scale: 1, offsetX: 0, offsetY: 100 };
		const to = { scale: 3, offsetX: 40, offsetY: 0 };
		assert.deepEqual(blendViewports(from, to, 0), from);
		assert.deepEqual(blendViewports(from, to, 1), to);
		assert.deepEqual(blendViewports(from, to, 0.5), {
			scale: 2,
			offsetX: 20,
			offsetY: 50,
		});
	});
});

// A 4000 × 3000 photo in a 432 × 800 area, 100 down the view: fitted at 0.1,
// 400 × 300 on screen, from (16, 350).
const frame: ViewFrame = {
	documentSize: { width: 4000, height: 3000 },
	area: { x: 0, y: 100, width: 432, height: 800 },
	inset: 16,
};

function assertClose(actual: number, expected: number) {
	assert.ok(
		Math.abs(actual - expected) < 1e-9,
		`expected ${actual} to be ${expected}`,
	);
}

describe("fitToFrame", () => {
	test("fits the document to the area, wherever it is in the view", () => {
		assert.deepEqual(fitToFrame(frame), {
			scale: 0.1,
			offsetX: 16,
			offsetY: 350,
		});
	});
});

describe("zoomViewportAbout", () => {
	test("keeps the point still while the document grows past the area", () => {
		// Where the browser showed it slipping: a third of the way down a
		// photo shorter than the area, which reaches the area's bottom first.
		const fit = fitToFrame(frame);
		const point = { x: 216, y: 450 };
		const under = viewPointToDocument(fit, point);
		let zoomed = fit;
		for (let i = 0; i < 12; i++) {
			zoomed = zoomViewportAbout(frame, zoomed, Math.exp(0.1), point);
		}
		const after = viewPointToDocument(zoomed, point);
		assertClose(after.x, under.x);
		assertClose(after.y, under.y);
	});

	test("keeps the point still while the document is smaller than the area", () => {
		const fit = fitToFrame(frame);
		const point = { x: 116, y: 420 };
		const under = viewPointToDocument(fit, point);
		const zoomed = zoomViewportAbout(frame, fit, 1.5, point);
		const after = viewPointToDocument(zoomed, point);
		assertClose(after.x, under.x);
		assertClose(after.y, under.y);
	});

	test("keeps the document point under the zoom's center", () => {
		const fit = fitToFrame(frame);
		const point = { x: 116, y: 450 };
		const under = viewPointToDocument(fit, point);
		const zoomed = zoomViewportAbout(frame, fit, 4, point);
		assert.equal(zoomed.scale, 0.4);
		const after = viewPointToDocument(zoomed, point);
		assertClose(after.x, under.x);
		assertClose(after.y, under.y);
	});

	test("doesn't zoom out past the fit", () => {
		assert.deepEqual(
			zoomViewportAbout(frame, fitToFrame(frame), 0.5, { x: 100, y: 400 }),
			fitToFrame(frame),
		);
	});

	test("stops at eight screen pixels to a document pixel", () => {
		const zoomed = zoomViewportAbout(frame, fitToFrame(frame), 1000, {
			x: 216,
			y: 500,
		});
		assert.equal(zoomed.scale, 8);
	});

	test("allows four fits of a document smaller than the view", () => {
		const small = { ...frame, documentSize: { width: 40, height: 30 } };
		const zoomed = zoomViewportAbout(small, fitToFrame(small), 1000, {
			x: 216,
			y: 500,
		});
		assert.equal(zoomed.scale, 40);
	});
});

describe("clampViewport", () => {
	test("keeps a zoomed document covering the area up to the inset", () => {
		const zoomed = zoomViewportAbout(frame, fitToFrame(frame), 4, {
			x: 216,
			y: 500,
		});
		// 1600 × 1200 on screen: taller than the area's 768 inside the inset.
		const dragged = panViewport(frame, zoomed, 5000, 5000);
		assert.equal(dragged.offsetX, 16);
		assert.equal(dragged.offsetY, 116);
		const back = panViewport(frame, zoomed, -5000, -5000);
		assert.equal(back.offsetX, 432 - 16 - 1600);
		assert.equal(back.offsetY, 900 - 16 - 1200);
	});

	test("settles a document that fits one way in the area's middle", () => {
		// 800 × 600 on screen: wider than the area, but not taller. Zoomed
		// about a point low down, it sits low until it settles.
		const zoomed = zoomViewportAbout(frame, fitToFrame(frame), 2, {
			x: 216,
			y: 600,
		});
		assert.notEqual(zoomed.offsetY, 200);
		assert.equal(clampViewport(frame, zoomed).offsetY, 100 + (800 - 600) / 2);
	});

	test("returns the fit before the view has been measured", () => {
		const unmeasured = { ...frame, area: { x: 0, y: 0, width: 0, height: 0 } };
		assert.equal(
			clampViewport(unmeasured, { scale: 1, offsetX: 0, offsetY: 0 }).scale,
			0,
		);
	});
});

describe("panViewport", () => {
	test("doesn't move a document along an axis where it fits", () => {
		const zoomed = clampViewport(
			frame,
			zoomViewportAbout(frame, fitToFrame(frame), 2, { x: 216, y: 500 }),
		);
		assert.equal(panViewport(frame, zoomed, 30, 50).offsetY, zoomed.offsetY);
	});

	test("moves a document a zoom left off back, but not further off", () => {
		const low = zoomViewportAbout(frame, fitToFrame(frame), 2, {
			x: 216,
			y: 600,
		});
		const settledY = clampViewport(frame, low).offsetY;
		assert.ok(low.offsetY < settledY);
		assert.equal(panViewport(frame, low, 0, -20).offsetY, low.offsetY);
		assert.equal(panViewport(frame, low, 0, 5).offsetY, low.offsetY + 5);
		assert.equal(panViewport(frame, low, 0, 500).offsetY, settledY);
	});
});

describe("viewportForZoom and zoomForViewport", () => {
	test("show the fit without a zoom", () => {
		assert.deepEqual(viewportForZoom(frame, null), fitToFrame(frame));
		assert.equal(zoomForViewport(frame, fitToFrame(frame)), null);
	});

	test("round-trip a settled zoom", () => {
		const zoomed = clampViewport(
			frame,
			zoomViewportAbout(frame, fitToFrame(frame), 3, { x: 100, y: 420 }),
		);
		const zoom = zoomForViewport(frame, zoomed);
		assert.ok(zoom);
		assertClose(zoom.zoom, 3);
		const shown = viewportForZoom(frame, zoom);
		assertClose(shown.scale, zoomed.scale);
		assertClose(shown.offsetX, zoomed.offsetX);
		assertClose(shown.offsetY, zoomed.offsetY);
	});

	test("refit around the same spot when the area shrinks", () => {
		const zoom = { zoom: 4, center: { x: 1000, y: 1500 } };
		const shorter = { ...frame, area: { ...frame.area, height: 300 } };
		const shown = viewportForZoom(shorter, zoom);
		assertClose(shown.scale, fitToFrame(shorter).scale * 4);
		const middle = viewPointToDocument(shown, { x: 216, y: 250 });
		assertClose(middle.x, 1000);
		assertClose(middle.y, 1500);
	});

	test("take a zoom barely past the fit as the fit", () => {
		const nearly = zoomViewportAbout(frame, fitToFrame(frame), 1.005, {
			x: 216,
			y: 500,
		});
		assert.equal(zoomForViewport(frame, nearly), null);
	});
});
