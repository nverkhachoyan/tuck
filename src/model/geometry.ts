export type Point = {
	x: number;
	y: number;
};

export type Size = {
	width: number;
	height: number;
};

/** A box centered on its layer's origin, in the layer's local units. */
export type Box = {
	halfWidth: number;
	halfHeight: number;
};

export type Transform = {
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
};

/** An axis-aligned rectangle from its top-left corner. */
export type Rect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

// Functions here are marked "worklet" so gestures can call them on the UI
// thread too. The directive is only a string: this stays plain TypeScript.

const QUARTER_TURN = Math.PI / 2;

/**
 * The cosine and sine of an angle, exact for quarter turns. `Math.cos(π/2)`
 * isn't quite 0, so turning a photo four times wouldn't land back on the
 * transform it started with.
 */
export function cosSin(angle: number): { cos: number; sin: number } {
	"worklet";
	const turns = angle / QUARTER_TURN;
	const quarters = Math.round(turns);
	if (Math.abs(turns - quarters) > 1e-12) {
		return { cos: Math.cos(angle), sin: Math.sin(angle) };
	}
	switch (((quarters % 4) + 4) % 4) {
		case 0:
			return { cos: 1, sin: 0 };
		case 1:
			return { cos: 0, sin: 1 };
		case 2:
			return { cos: -1, sin: 0 };
		default:
			return { cos: 0, sin: -1 };
	}
}

/** An angle in (−π, π], landing exactly on a quarter turn when within 1e-9. */
export function normalizeAngle(angle: number): number {
	"worklet";
	const turn = 2 * Math.PI;
	let normalized = angle - Math.ceil((angle - Math.PI) / turn) * turn;
	const quarter = Math.round(normalized / QUARTER_TURN) * QUARTER_TURN;
	if (Math.abs(normalized - quarter) < 1e-9) normalized = quarter;
	return normalized <= -Math.PI ? normalized + turn : normalized;
}

/**
 * Maps a document-space point into a layer's local space, where the layer's
 * center is the origin and its rotation/scale are undone. Inverse of the
 * translate → rotate → scale order used to draw the layer.
 */
export function toLayerSpace(transform: Transform, point: Point): Point {
	"worklet";
	const dx = point.x - transform.x;
	const dy = point.y - transform.y;
	const { cos, sin } = cosSin(transform.rotation);
	return {
		x: (dx * cos + dy * sin) / transform.scaleX,
		y: (dy * cos - dx * sin) / transform.scaleY,
	};
}

/** The upright rectangle with `a` and `b` at opposite corners. */
export function rectFromCorners(a: Point, b: Point): Rect {
	"worklet";
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		width: Math.abs(b.x - a.x),
		height: Math.abs(b.y - a.y),
	};
}

/** Whether a document-space point lands inside a layer's local-space box. */
export function hitTestBox(
	transform: Transform,
	box: Box,
	point: Point,
): boolean {
	"worklet";
	const local = toLayerSpace(transform, point);
	return (
		Math.abs(local.x) <= box.halfWidth && Math.abs(local.y) <= box.halfHeight
	);
}

/**
 * The smallest upright box around a layer's local-space box once its
 * transform scales and rotates it: in document units, centered on the
 * layer's position.
 */
export function boundingBox(transform: Transform, box: Box): Box {
	"worklet";
	const { cos, sin } = cosSin(transform.rotation);
	const halfWidth = box.halfWidth * transform.scaleX;
	const halfHeight = box.halfHeight * transform.scaleY;
	return {
		halfWidth: Math.abs(halfWidth * cos) + Math.abs(halfHeight * sin),
		halfHeight: Math.abs(halfWidth * sin) + Math.abs(halfHeight * cos),
	};
}

/** The inverse of `toLayerSpace`: a layer-local point in document space. */
export function toDocumentSpace(transform: Transform, point: Point): Point {
	"worklet";
	const x = point.x * transform.scaleX;
	const y = point.y * transform.scaleY;
	const { cos, sin } = cosSin(transform.rotation);
	return {
		x: transform.x + x * cos - y * sin,
		y: transform.y + x * sin + y * cos,
	};
}

/** An affine map: (x, y) → (a·x + c·y + tx, b·x + d·y + ty). */
export type Matrix = {
	a: number;
	b: number;
	c: number;
	d: number;
	tx: number;
	ty: number;
};

/** The matrix that draws a layer: `toDocumentSpace` as a matrix. */
export function transformMatrix(transform: Transform): Matrix {
	"worklet";
	const { cos, sin } = cosSin(transform.rotation);
	return {
		a: cos * transform.scaleX,
		b: sin * transform.scaleX,
		c: -sin * transform.scaleY,
		d: cos * transform.scaleY,
		tx: transform.x,
		ty: transform.y,
	};
}

/** `outer ∘ inner`: applies `inner`, then `outer`. */
export function multiplyMatrices(outer: Matrix, inner: Matrix): Matrix {
	"worklet";
	return {
		a: outer.a * inner.a + outer.c * inner.b,
		b: outer.b * inner.a + outer.d * inner.b,
		c: outer.a * inner.c + outer.c * inner.d,
		d: outer.b * inner.c + outer.d * inner.d,
		tx: outer.a * inner.tx + outer.c * inner.ty + outer.tx,
		ty: outer.b * inner.tx + outer.d * inner.ty + outer.ty,
	};
}

export function invertMatrix(m: Matrix): Matrix {
	"worklet";
	const det = m.a * m.d - m.b * m.c;
	const a = m.d / det;
	const b = -m.b / det;
	const c = -m.c / det;
	const d = m.a / det;
	return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}

export function applyMatrix(m: Matrix, point: Point): Point {
	"worklet";
	return {
		x: m.a * point.x + m.c * point.y + m.tx,
		y: m.b * point.x + m.d * point.y + m.ty,
	};
}

export function transformsEqual(left: Transform, right: Transform): boolean {
	"worklet";
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.scaleX === right.scaleX &&
		left.scaleY === right.scaleY &&
		left.rotation === right.rotation
	);
}
