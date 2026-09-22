import { useMemo } from "react";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import type { Box, Transform } from "@/model/geometry";

const MIN_LAYER_SCALE = 0.2;
const MAX_LAYER_SCALE = 8;

/**
 * High-frequency transform state for the selected layer. Gestures write here
 * every frame (no React rerenders); the document only receives the final
 * value when the gesture ends. While `activeId` matches a layer, that layer's
 * node renders from these values instead of its document transform.
 * `halfWidth`/`halfHeight` are its selection box, so the UI thread can find
 * and draw its handles without laying out text. `centeredX`/`centeredY` say
 * whether a drag has snapped its center onto the document's center lines.
 */
export type LiveTransform = {
	activeId: SharedValue<string | null>;
	x: SharedValue<number>;
	y: SharedValue<number>;
	scale: SharedValue<number>;
	rotation: SharedValue<number>;
	halfWidth: SharedValue<number>;
	halfHeight: SharedValue<number>;
	centeredX: SharedValue<boolean>;
	centeredY: SharedValue<boolean>;
};

export function useLiveTransform(): LiveTransform {
	const activeId = useSharedValue<string | null>(null);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const scale = useSharedValue(1);
	const rotation = useSharedValue(0);
	const halfWidth = useSharedValue(0);
	const halfHeight = useSharedValue(0);
	const centeredX = useSharedValue(false);
	const centeredY = useSharedValue(false);
	return useMemo(
		() => ({
			activeId,
			x,
			y,
			scale,
			rotation,
			halfWidth,
			halfHeight,
			centeredX,
			centeredY,
		}),
		[
			activeId,
			x,
			y,
			scale,
			rotation,
			halfWidth,
			halfHeight,
			centeredX,
			centeredY,
		],
	);
}

export function syncLiveTransform(
	live: LiveTransform,
	id: string | null,
	transform: Transform | undefined,
	box: Box | undefined,
) {
	if (id && transform && box) {
		live.x.value = transform.x;
		live.y.value = transform.y;
		live.scale.value = transform.scaleX;
		live.rotation.value = transform.rotation;
		live.halfWidth.value = box.halfWidth;
		live.halfHeight.value = box.halfHeight;
	}
	live.activeId.value = id;
}

/** The live values as a document transform (layers scale uniformly). */
export function readLiveTransform(live: LiveTransform): Transform {
	"worklet";
	return {
		x: live.x.value,
		y: live.y.value,
		scaleX: live.scale.value,
		scaleY: live.scale.value,
		rotation: live.rotation.value,
	};
}

export function readLiveBox(live: LiveTransform): Box {
	"worklet";
	return { halfWidth: live.halfWidth.value, halfHeight: live.halfHeight.value };
}

export function clampScale(scale: number) {
	"worklet";
	return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, scale));
}
