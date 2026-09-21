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
 *
 * A drag can also pick its own layer: `onDragStart` gets the touch-down point
 * and returns true when it selected a different layer. The drag then holds
 * still until that selection reaches `live`, so the previous layer doesn't
 * twitch in the meantime, and then applies the whole drag so far, keeping
 * the point the finger grabbed under the finger.
 */
export function useLayerTransformGesture({
	live,
	viewScale,
	onTap,
	onDragStart,
	onCommit,
}: {
	live: LiveTransform;
	viewScale: number;
	onTap: (screenX: number, screenY: number) => void;
	onDragStart: (screenX: number, screenY: number) => boolean;
	onCommit: (transform: Transform) => void;
}) {
	// Gesture-start snapshots. These must be shared values: plain `let`
	// variables captured by worklets are copied, so writes wouldn't persist.
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const startScale = useSharedValue(1);
	const startRotation = useSharedValue(0);
	// The layer this drag is moving, and whether it's settled on one yet.
	const dragId = useSharedValue<string | null>(null);
	const dragReady = useSharedValue(false);

	return useMemo(() => {
		// Runs on the JS thread, where hit-testing (and Skia text layout) lives.
		const handleDragStart = (screenX: number, screenY: number) => {
			if (!onDragStart(screenX, screenY)) dragReady.value = true;
		};

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

		// Starts on activation (after the finger moves), not touch-down, so a tap
		// on an unselected layer stays a plain select.
		const pan = Gesture.Pan()
			.onStart((event) => {
				startX.value = live.x.value;
				startY.value = live.y.value;
				dragId.value = live.activeId.value;
				dragReady.value = false;
				scheduleOnRN(
					handleDragStart,
					event.x - event.translationX,
					event.y - event.translationY,
				);
			})
			.onUpdate((event) => {
				const id = live.activeId.value;
				if (id === null) return;
				// The drag's own selection just landed; anchor to that layer.
				if (id !== dragId.value) {
					dragId.value = id;
					startX.value = live.x.value;
					startY.value = live.y.value;
					dragReady.value = true;
				}
				if (!dragReady.value) return;
				live.x.value = startX.value + event.translationX / viewScale;
				live.y.value = startY.value + event.translationY / viewScale;
			})
			.onEnd(() => {
				if (live.activeId.value !== null && dragReady.value) commit();
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
		onDragStart,
		onCommit,
		dragId,
		dragReady,
		startX,
		startY,
		startScale,
		startRotation,
	]);
}
