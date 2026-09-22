import type { Transform } from "@/model/geometry";

export type TransformList = ReturnType<typeof toTransformList>;

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
