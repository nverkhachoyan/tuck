import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import type { Point } from "@/model/geometry";
import type { Handle } from "./handleGeometry";
import { TAP_SLOP_PX } from "./strokeIntent";

// What the canvas's gestures ask about a point from the view. The hooks that
// handle a tap, a stroke, or a hover take this instead of the viewport, the
// targets, and the selection each.
export type CanvasLookups = {
	handleAt: (screenX: number, screenY: number) => Handle | null;
	layerAt: (screenX: number, screenY: number) => string | null;
	toDocument: (screenX: number, screenY: number) => Point;
	tapAway: (point: Point) => void;
};

/**
 * A tap on the canvas, short of a pinch's travel, so two fingers zooming
 * aren't one. `onTap` hears where it landed, in the view.
 */
export function useCanvasTap(
	onTap: (screenX: number, screenY: number) => void,
) {
	return useMemo(
		() =>
			Gesture.Tap()
				.maxDistance(TAP_SLOP_PX)
				.onEnd((event, success) => {
					if (success) scheduleOnRN(onTap, event.x, event.y);
				}),
		[onTap],
	);
}
