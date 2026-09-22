import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Size, Transform } from "@/model/geometry";
import { type Handle, rotateByDrag, scaleByDrag } from "./handleGeometry";
import {
	clampScale,
	type LiveTransform,
	readLiveBox,
	readLiveTransform,
} from "./liveTransform";
import {
	continueTravel,
	type PointerTravel,
	startTravel,
} from "./pointerTravel";
import { handleUnder, hasFinePointer } from "./selectionHandles";
import { snapAngle, snapTo } from "./snapping";
import { type DocumentViewport, viewPointToDocument } from "./viewport";

// Rotation settles on upright and quarter turns when this close.
const ROTATION_SNAP = (4 * Math.PI) / 180;
// A dragged layer's center snaps to the document's center lines from this
// many screen pixels away.
const CENTER_SNAP_PX = 8;

const tick = () => {
	void Haptics.selectionAsync();
};

/**
 * Tap selects, and while a layer is selected pan / pinch / rotate transform
 * it about its center.
 *
 * A pan that starts on one of the selected layer's handles scales (corners)
 * or rotates (knob) it instead of moving it, about its center like a pinch.
 * That's decided at touch-down, on the UI thread, from the live values.
 *
 * A drag can also pick its own layer: `onDragStart` gets the touch-down point
 * and returns true when it selected a different layer. The drag then holds
 * still until that selection reaches `live`, so the previous layer doesn't
 * twitch in the meantime, and then applies the whole drag so far, keeping
 * the point the finger grabbed under the finger.
 *
 * Moving snaps the layer's center onto the document's center lines, and
 * rotating settles on quarter turns, with a haptic tick as each snap lands.
 *
 * However many gestures take part, the result is committed once, when the
 * last of them ends, and only if the layer actually moved. With a mouse,
 * hovering reports the pointer (`onHover`) so the canvas can show cursors.
 */
export function useLayerTransformGesture({
	live,
	viewport,
	documentSize,
	onTap,
	onDragStart,
	onCommit,
	onHover,
	onHoverEnd,
}: {
	live: LiveTransform;
	viewport: DocumentViewport;
	documentSize: Size;
	onTap: (screenX: number, screenY: number) => void;
	onDragStart: (screenX: number, screenY: number) => boolean;
	onCommit: (id: string, transform: Transform) => void;
	onHover: (screenX: number, screenY: number) => void;
	onHoverEnd: () => void;
}) {
	// Gesture-start snapshots. These must be shared values: plain `let`
	// variables captured by worklets are copied, so writes wouldn't persist.
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const startScale = useSharedValue(1);
	const startRotation = useSharedValue(0);
	// Where the pan began, and how far its pointers have moved since. Not the
	// pan's own translation: on iOS that skips the activation distance, and
	// it's measured from the fingers' midpoint, which jumps as a finger lands.
	const downX = useSharedValue(0);
	const downY = useSharedValue(0);
	const travel = useSharedValue<PointerTravel>(
		startTravel({ x: 0, y: 0, numberOfPointers: 0 }),
	);
	// The layer this drag is moving, and whether it's settled on one yet.
	const dragId = useSharedValue<string | null>(null);
	const dragReady = useSharedValue(false);
	// The handle this pan grabbed, if any, and the layer's state when it did.
	// Separate from the pinch/rotate snapshots, which run alongside.
	const dragHandle = useSharedValue<Handle | null>(null);
	const handleStartScale = useSharedValue(1);
	const handleStartRotation = useSharedValue(0);
	// How many of pan / pinch / rotate are running, and whether any moved.
	const activeCount = useSharedValue(0);
	const moved = useSharedValue(false);

	return useMemo(() => {
		// Runs on the JS thread, where hit-testing (and Skia text layout) lives.
		const handleDragStart = (screenX: number, screenY: number) => {
			if (!onDragStart(screenX, screenY)) dragReady.value = true;
		};

		const toDocument = (screenX: number, screenY: number) => {
			"worklet";
			return viewPointToDocument(viewport, { x: screenX, y: screenY });
		};

		// Ticks when a value lands on its snap, not on every frame it stays there.
		const settle = (
			value: SharedValue<number>,
			raw: number,
			snapped: number | null,
		) => {
			"worklet";
			if (snapped !== null && snapped !== value.value) scheduleOnRN(tick);
			value.value = snapped ?? raw;
			return snapped !== null;
		};

		const moveTo = (x: number, y: number) => {
			"worklet";
			const tolerance = CENTER_SNAP_PX / viewport.scale;
			live.centeredX.value = settle(
				live.x,
				x,
				snapTo(x, documentSize.width / 2, tolerance),
			);
			live.centeredY.value = settle(
				live.y,
				y,
				snapTo(y, documentSize.height / 2, tolerance),
			);
		};

		const rotateTo = (angle: number) => {
			"worklet";
			settle(
				live.rotation,
				angle,
				snapAngle(angle, Math.PI / 2, ROTATION_SNAP),
			);
		};

		const gestureStarted = () => {
			"worklet";
			if (activeCount.value === 0) moved.value = false;
			activeCount.value += 1;
		};

		const gestureEnded = () => {
			"worklet";
			activeCount.value = Math.max(0, activeCount.value - 1);
			const id = live.activeId.value;
			if (activeCount.value > 0 || !moved.value || id === null) return;
			scheduleOnRN(onCommit, id, readLiveTransform(live));
		};

		const tap = Gesture.Tap()
			.maxDistance(10)
			.onEnd((event, success) => {
				if (success) scheduleOnRN(onTap, event.x, event.y);
			});

		// Starts on activation (after the finger moves), not touch-down, so a tap
		// on an unselected layer stays a plain select.
		const pan = Gesture.Pan()
			.onBegin((event) => {
				downX.value = event.x;
				downY.value = event.y;
				travel.value = startTravel(event);
				dragHandle.value =
					live.activeId.value === null
						? null
						: handleUnder(
								readLiveTransform(live),
								readLiveBox(live),
								toDocument(event.x, event.y),
								viewport.scale,
							);
			})
			.onStart((event) => {
				travel.value = continueTravel(travel.value, event);
				gestureStarted();
				startX.value = live.x.value;
				startY.value = live.y.value;
				dragId.value = live.activeId.value;
				if (dragHandle.value !== null) {
					// The selected layer's own handle: no selection to wait for.
					handleStartScale.value = live.scale.value;
					handleStartRotation.value = live.rotation.value;
					dragReady.value = true;
					return;
				}
				dragReady.value = false;
				scheduleOnRN(handleDragStart, downX.value, downY.value);
			})
			.onUpdate((event) => {
				travel.value = continueTravel(travel.value, event);
				const { dx, dy } = travel.value;
				const id = live.activeId.value;
				if (id === null) return;

				const handle = dragHandle.value;
				if (handle !== null) {
					const center = { x: startX.value, y: startY.value };
					const from = toDocument(downX.value, downY.value);
					const to = toDocument(downX.value + dx, downY.value + dy);
					if (handle === "rotate") {
						rotateTo(rotateByDrag(center, from, to, handleStartRotation.value));
					} else {
						live.scale.value = clampScale(
							scaleByDrag(center, from, to, handleStartScale.value),
						);
					}
					moved.value = true;
					return;
				}

				// The drag's own selection just landed; anchor to that layer.
				if (id !== dragId.value) {
					dragId.value = id;
					startX.value = live.x.value;
					startY.value = live.y.value;
					dragReady.value = true;
				}
				if (!dragReady.value) return;
				moveTo(
					startX.value + dx / viewport.scale,
					startY.value + dy / viewport.scale,
				);
				moved.value = true;
			})
			.onEnd(gestureEnded)
			.onFinalize(() => {
				dragHandle.value = null;
				live.centeredX.value = false;
				live.centeredY.value = false;
			});

		// Pinch and rotate stand aside while a handle is being dragged, so a
		// second finger can't fight the handle over the same values.
		const pinch = Gesture.Pinch()
			.onStart(() => {
				gestureStarted();
				startScale.value = live.scale.value;
			})
			.onUpdate((event) => {
				if (live.activeId.value === null || dragHandle.value !== null) return;
				live.scale.value = clampScale(startScale.value * event.scale);
				moved.value = true;
			})
			.onEnd(gestureEnded);

		const rotate = Gesture.Rotation()
			.onStart(() => {
				gestureStarted();
				startRotation.value = live.rotation.value;
			})
			.onUpdate((event) => {
				if (live.activeId.value === null || dragHandle.value !== null) return;
				rotateTo(startRotation.value + event.rotation);
				moved.value = true;
			})
			.onEnd(gestureEnded);

		// Only a mouse hovers; the canvas turns positions into cursors.
		const hover = Gesture.Hover()
			.enabled(hasFinePointer)
			.onBegin((event) => {
				scheduleOnRN(onHover, event.x, event.y);
			})
			.onUpdate((event) => {
				scheduleOnRN(onHover, event.x, event.y);
			})
			.onEnd(() => {
				scheduleOnRN(onHoverEnd);
			});

		return Gesture.Simultaneous(
			hover,
			Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotate)),
		);
	}, [
		live,
		viewport,
		documentSize,
		onTap,
		onDragStart,
		onCommit,
		onHover,
		onHoverEnd,
		downX,
		downY,
		travel,
		dragId,
		dragReady,
		dragHandle,
		handleStartScale,
		handleStartRotation,
		activeCount,
		moved,
		startX,
		startY,
		startScale,
		startRotation,
	]);
}
