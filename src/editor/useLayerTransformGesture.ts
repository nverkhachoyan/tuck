import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Transform } from "@/model/geometry";

export const MIN_LAYER_SCALE = 0.2;
export const MAX_LAYER_SCALE = 8;

/**
 * High-frequency transform state for the selected layer. Gestures write here
 * every frame (no React rerenders); the document only receives the final
 * value when the gesture ends. While `activeId` matches a layer, that layer's
 * node renders from these values instead of its document transform.
 */
export type LiveTransform = {
	activeId: SharedValue<string | null>;
	x: SharedValue<number>;
	y: SharedValue<number>;
	scale: SharedValue<number>;
	rotation: SharedValue<number>;
};

export function useLiveTransform(): LiveTransform {
	const activeId = useSharedValue<string | null>(null);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const scale = useSharedValue(1);
	const rotation = useSharedValue(0);
	return useMemo(
		() => ({ activeId, x, y, scale, rotation }),
		[activeId, x, y, scale, rotation],
	);
}

export function syncLiveTransform(
	live: LiveTransform,
	id: string | null,
	transform: Transform | undefined,
) {
	if (id && transform) {
		live.x.value = transform.x;
		live.y.value = transform.y;
		live.scale.value = transform.scaleX;
		live.rotation.value = transform.rotation;
	}
	live.activeId.value = id;
}

/**
 * Tap selects, and while a layer is selected pan / pinch / rotate transform
 * it about its center. `viewScale` converts screen-pixel pan distances into
 * document units.
 */
export function useLayerTransformGesture({
	live,
	viewScale,
	onTap,
	onCommit,
}: {
	live: LiveTransform;
	viewScale: number;
	onTap: (screenX: number, screenY: number) => void;
	onCommit: (transform: Transform) => void;
}) {
	// Gesture-start snapshots. These must be shared values: plain `let`
	// variables captured by worklets are copied, so writes wouldn't persist.
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const startScale = useSharedValue(1);
	const startRotation = useSharedValue(0);

	return useMemo(() => {
		const commit = () => {
			"worklet";
			scheduleOnRN(onCommit, {
				x: live.x.value,
				y: live.y.value,
				scaleX: live.scale.value,
				scaleY: live.scale.value,
				rotation: live.rotation.value,
			});
		};

		const tap = Gesture.Tap()
			.maxDistance(10)
			.onEnd((event, success) => {
				if (success) scheduleOnRN(onTap, event.x, event.y);
			});

		const pan = Gesture.Pan()
			.onStart(() => {
				startX.value = live.x.value;
				startY.value = live.y.value;
			})
			.onUpdate((event) => {
				if (live.activeId.value === null) return;
				live.x.value = startX.value + event.translationX / viewScale;
				live.y.value = startY.value + event.translationY / viewScale;
			})
			.onEnd(() => {
				if (live.activeId.value !== null) commit();
			});

		const pinch = Gesture.Pinch()
			.onStart(() => {
				startScale.value = live.scale.value;
			})
			.onUpdate((event) => {
				if (live.activeId.value === null) return;
				live.scale.value = Math.min(
					MAX_LAYER_SCALE,
					Math.max(MIN_LAYER_SCALE, startScale.value * event.scale),
				);
			})
			.onEnd(() => {
				if (live.activeId.value !== null) commit();
			});

		const rotate = Gesture.Rotation()
			.onStart(() => {
				startRotation.value = live.rotation.value;
			})
			.onUpdate((event) => {
				if (live.activeId.value === null) return;
				live.rotation.value = startRotation.value + event.rotation;
			})
			.onEnd(() => {
				if (live.activeId.value !== null) commit();
			});

		return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotate));
	}, [
		live,
		viewScale,
		onTap,
		onCommit,
		startX,
		startY,
		startScale,
		startRotation,
	]);
}
