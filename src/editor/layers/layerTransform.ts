import type { Transform } from "../document/geometry";

/**
 * Skia's transform list for a layer's document-space transform. A worklet,
 * so a `useDerivedValue` can build it from live gesture values on the UI
 * thread.
 */
export function toTransformList(t: Transform) {
	"worklet";
	return [
		{ translateX: t.x },
		{ translateY: t.y },
		{ rotate: t.rotation },
		{ scaleX: t.scaleX },
		{ scaleY: t.scaleY },
	];
}

/**
 * Undoes `toTransformList`: inside a layer, draws in document space again.
 */
export function toInverseTransformList(t: Transform) {
	return [
		{ scaleX: 1 / t.scaleX },
		{ scaleY: 1 / t.scaleY },
		{ rotate: -t.rotation },
		{ translateX: -t.x },
		{ translateY: -t.y },
	];
}
