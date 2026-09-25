import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/lib/haptics";
import { boundingBox, type Size, type Transform } from "@/model/geometry";
import {
	type Handle,
	rotateByDrag,
	scaleByDrag,
} from "../handles/handleGeometry";
import { handleUnder, hasFinePointer } from "../handles/handleMetrics";
import { type DocumentViewport, viewPointToDocument } from "../viewport";
import { findLayerAt, type LayerTarget } from "./hitTest";
import {
	clampScale,
	holdLayer,
	type LiveTransform,
	readLiveBox,
	readLiveTransform,
} from "./liveTransform";
import {
	continueTravel,
	type PointerTravel,
	startTravel,
} from "./pointerTravel";
import { type AxisLines, snapAngle, snapLinesFor, snapSpan } from "./snapping";

// Rotation settles on upright and quarter turns when this close.
const ROTATION_SNAP = (4 * Math.PI) / 180;
// A dragged layer snaps onto the document's and the other layers' edges and
// centers from this many screen pixels away.
const SNAP_PX = 8;

const NO_LINES: AxisLines = { edges: [], centers: [] };

/**
 * Tap selects, and while a layer is selected pan / pinch / rotate transform
 * it about its center.
 *
 * A pan that starts on one of the selected layer's handles scales (corners)
 * or rotates (knob) it instead of moving it, about its center like a pinch.
 * That's decided at touch-down, on the UI thread, from the live values.
 *
 * A drag that starts on another layer picks that layer up at once: it's
 * hit-tested here, on the UI thread, against `layers`, and `onSelect` tells
 * React. Dragging empty space keeps moving the selection, which helps with
 * small text.
 *
 * Moving snaps the layer's edges onto the edges of the document and the
 * other layers, or its center onto their centers, and rotating settles on
 * quarter turns, with a haptic tick as each snap lands.
 *
 * While any of pan / pinch / rotate runs, the layer it transforms is held
 * (`live.heldId`): a sync from the document leaves it be, and the gestures
 * stand still if the selection moves off it. The result is committed once,
 * when the last of them ends, and only if the layer actually moved. With a
 * mouse, hovering reports the pointer (`onHover`) so the canvas can show
 * cursors.
 */
export function useLayerTransformGesture({
	live,
	layers,
	viewport,
	documentSize,
	onTap,
	onSelect,
	onCommit,
	onHover,
	onHoverEnd,
}: {
	live: LiveTransform;
	layers: SharedValue<readonly LayerTarget[]>;
	viewport: DocumentViewport;
	documentSize: Size;
	onTap: (screenX: number, screenY: number) => void;
	// Without it, a drag only ever moves the current selection.
	onSelect?: (id: string) => void;
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
	// The handle this pan grabbed, if any, and the layer's state when it did.
	// Separate from the pinch/rotate snapshots, which run alongside.
	const dragHandle = useSharedValue<Handle | null>(null);
	const handleStartScale = useSharedValue(1);
	const handleStartRotation = useSharedValue(0);
	// How many of pan / pinch / rotate are running, and whether any moved.
	const activeCount = useSharedValue(0);
	const moved = useSharedValue(false);
	// What this drag's layer snaps onto, gathered when it starts.
	const snapLines = useSharedValue({ x: NO_LINES, y: NO_LINES });

	return useMemo(() => {
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
			if (snapped !== null && snapped !== value.value) scheduleOnRN(hapticTick);
			value.value = snapped ?? raw;
		};

		const moveTo = (x: number, y: number) => {
			"worklet";
			const tolerance = SNAP_PX / viewport.scale;
			const lines = snapLines.value;
			const extent = boundingBox(readLiveTransform(live), readLiveBox(live));
			const snapX = snapSpan(
				x,
				extent.halfWidth,
				lines.x.edges,
				lines.x.centers,
				tolerance,
			);
			const snapY = snapSpan(
				y,
				extent.halfHeight,
				lines.y.edges,
				lines.y.centers,
				tolerance,
			);
			settle(live.x, x, snapX?.center ?? null);
			settle(live.y, y, snapY?.center ?? null);
			live.guideX.value = snapX?.line ?? null;
			live.guideY.value = snapY?.line ?? null;
		};

		const rotateTo = (angle: number) => {
			"worklet";
			settle(
				live.rotation,
				angle,
				snapAngle(angle, Math.PI / 2, ROTATION_SNAP),
			);
		};

		// The first gesture to start holds the selected layer, if there is one.
		const gestureStarted = () => {
			"worklet";
			if (activeCount.value === 0) {
				moved.value = false;
				live.heldId.value = live.activeId.value;
			}
			activeCount.value += 1;
		};

		// Whether `live` still holds the layer the gestures started on.
		const holding = () => {
			"worklet";
			const id = live.heldId.value;
			return id !== null && id === live.activeId.value;
		};

		const gestureEnded = () => {
			"worklet";
			activeCount.value = Math.max(0, activeCount.value - 1);
			if (activeCount.value > 0) return;
			const id = live.heldId.value;
			if (moved.value && id !== null && holding()) {
				scheduleOnRN(onCommit, id, readLiveTransform(live));
			}
			live.heldId.value = null;
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
				// Picks up the layer under the touch-down point, unless it grabbed a
				// handle or another finger is already transforming the selection.
				if (onSelect && dragHandle.value === null && activeCount.value === 1) {
					const target = findLayerAt(
						layers.value,
						toDocument(downX.value, downY.value),
					);
					if (target && target.id !== live.activeId.value) {
						holdLayer(live, target.id, target.transform, target.box);
						scheduleOnRN(onSelect, target.id);
					}
				}
				startX.value = live.x.value;
				startY.value = live.y.value;
				handleStartScale.value = live.scale.value;
				handleStartRotation.value = live.rotation.value;
				snapLines.value = snapLinesFor(
					documentSize,
					layers.value.filter((target) => target.id !== live.heldId.value),
				);
			})
			.onUpdate((event) => {
				travel.value = continueTravel(travel.value, event);
				const { dx, dy } = travel.value;
				if (!holding()) return;

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

				moveTo(
					startX.value + dx / viewport.scale,
					startY.value + dy / viewport.scale,
				);
				moved.value = true;
			})
			.onEnd(gestureEnded)
			.onFinalize(() => {
				dragHandle.value = null;
				live.guideX.value = null;
				live.guideY.value = null;
			});

		// Pinch and rotate stand aside while a handle is being dragged, so a
		// second finger can't fight the handle over the same values.
		const pinch = Gesture.Pinch()
			.onStart(() => {
				gestureStarted();
				startScale.value = live.scale.value;
			})
			.onUpdate((event) => {
				if (!holding() || dragHandle.value !== null) return;
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
				if (!holding() || dragHandle.value !== null) return;
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
		layers,
		viewport,
		documentSize,
		onTap,
		onSelect,
		onCommit,
		onHover,
		onHoverEnd,
		downX,
		downY,
		travel,
		dragHandle,
		handleStartScale,
		handleStartRotation,
		activeCount,
		moved,
		snapLines,
		startX,
		startY,
		startScale,
		startRotation,
	]);
}
