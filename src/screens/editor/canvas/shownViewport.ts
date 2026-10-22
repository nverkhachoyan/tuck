import { useLayoutEffect, useMemo } from "react";
import {
	Easing,
	type SharedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import type { DocumentViewport } from "../viewport";

// How the drawing eases to a new viewport.
const EASE = { duration: 250, easing: Easing.bezier(0.2, 0, 0, 1) };

/**
 * The viewport the canvas draws with, on the UI thread. It eases to each new
 * target, as when a tray opens, the keyboard rises, or a key zooms, while
 * gestures use the target at once. Zooming with fingers or the wheel moves
 * it directly (`showViewport`) as it goes, and commits once it stops.
 */
export type ShownViewport = {
	scale: SharedValue<number>;
	offsetX: SharedValue<number>;
	offsetY: SharedValue<number>;
};

export function useShownViewport(target: DocumentViewport): ShownViewport {
	const scale = useSharedValue(target.scale);
	const offsetX = useSharedValue(target.offsetX);
	const offsetY = useSharedValue(target.offsetY);
	const { scale: toScale, offsetX: toX, offsetY: toY } = target;
	useLayoutEffect(() => {
		// Not from the unmeasured view's zero scale.
		const ease = scale.value > 0 && toScale > 0;
		const to = (value: number) => (ease ? withTiming(value, EASE) : value);
		scale.value = to(toScale);
		offsetX.value = to(toX);
		offsetY.value = to(toY);
	}, [toScale, toX, toY, scale, offsetX, offsetY]);
	return useMemo(
		() => ({ scale, offsetX, offsetY }),
		[scale, offsetX, offsetY],
	);
}

export function readShownViewport(shown: ShownViewport): DocumentViewport {
	"worklet";
	return {
		scale: shown.scale.value,
		offsetX: shown.offsetX.value,
		offsetY: shown.offsetY.value,
	};
}

/** Shows `viewport` at once, stopping any easing. */
export function showViewport(
	shown: ShownViewport,
	viewport: DocumentViewport,
): void {
	"worklet";
	shown.scale.value = viewport.scale;
	shown.offsetX.value = viewport.offsetX;
	shown.offsetY.value = viewport.offsetY;
}
