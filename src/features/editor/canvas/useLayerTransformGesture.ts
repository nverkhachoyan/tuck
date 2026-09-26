import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/lib/haptics";
import {
	type Box,
	boundingBox,
	type Point,
	type Size,
	type Transform,
	toLayerSpace,
} from "@/model/geometry";
import {
	type Handle,
	handleSides,
	type ResizeHandle,
	resizeByDrag,
	resizeLockedByDrag,
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
import { dragLineEnd } from "./shapeDrag";
import {
	type AxisLines,
	ROTATION_SNAP,
	snapAngle,
	snapLinesFor,
	snapSide,
	snapSpan,
} from "./snapping";

// A dragged layer snaps onto the document's and the other layers' edges and
// centers from this many screen pixels away.
const SNAP_PX = 8;
// How thin a box resizing freely can get, in screen pixels.
const MIN_BOX_PX = 12;

const NO_LINES: AxisLines = { edges: [], centers: [] };

/**
 * Tap selects, and while a layer is selected pan / pinch / rotate transform
 * it about its center.
 *
 * A pan that starts on one of the selected layer's handles scales (corners)
 * or rotates (knob) it instead of moving it, about its center like a pinch.
 * A layer with a resize mode has side handles too, and
 * its corners and sides resize it instead, keeping the opposite sides put;
 * that commits through `onResize`. A line has handles only at its ends,
 * which drag that end anywhere, turning the line about the other; that
 * commits through `onResize` too. Which handle is decided at touch-down,
 * on the UI thread, from the live values.
 *
 * A drag that starts on another layer picks that layer up at once: it's
 * hit-tested here, on the UI thread, against `layers`, and `onSelect` tells
 * React. Dragging empty space keeps moving the selection, which helps with
 * small text.
 *
 * Moving snaps the layer's edges onto the edges of the document and the
 * other layers, or its center onto their centers; a side being resized
 * snaps onto any of those lines; and rotating settles on quarter turns,
 * with a haptic tick as each snap lands.
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
	aspectLocked,
	layers,
	viewport,
	documentSize,
	onTap,
	onSelect,
	onCommit,
	onResize,
	onHover,
	onHoverEnd,
}: {
	live: LiveTransform;
	aspectLocked: SharedValue<boolean>;
	layers: SharedValue<readonly LayerTarget[]>;
	viewport: DocumentViewport;
	documentSize: Size;
	onTap: (screenX: number, screenY: number) => void;
	// Without it, a drag only ever moves the current selection.
	onSelect?: (id: string) => void;
	onCommit: (id: string, transform: Transform) => void;
	// A resized box: its transform, and its new size in its own units.
	onResize: (id: string, transform: Transform, box: Box) => void;
	onHover: (screenX: number, screenY: number) => void;
	onHoverEnd: () => void;
}) {
	// Gesture-start snapshots. These must be shared values: plain `let`
	// variables captured by worklets are copied, so writes wouldn't persist.
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const startScaleX = useSharedValue(1);
	const startScaleY = useSharedValue(1);
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
	const handleStartScaleX = useSharedValue(1);
	const handleStartScaleY = useSharedValue(1);
	const handleStartRotation = useSharedValue(0);
	const handleStartBox = useSharedValue<Box>({ halfWidth: 0, halfHeight: 0 });
	// How many of pan / pinch / rotate are running, whether any moved, and
	// whether a handle resized the box.
	const activeCount = useSharedValue(0);
	const moved = useSharedValue(false);
	const resizedBox = useSharedValue(false);
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

		// Resizes the held box by dragging `handle` from `from` to `to`, in the
		// frame it had when the drag began, snapping each side it moves.
		const resizeTo = (handle: ResizeHandle, from: Point, to: Point) => {
			"worklet";
			const start = {
				x: startX.value,
				y: startY.value,
				scaleX: handleStartScaleX.value,
				scaleY: handleStartScaleY.value,
				rotation: handleStartRotation.value,
			};
			const box = handleStartBox.value;
			const minSize =
				MIN_BOX_PX / (viewport.scale * Math.min(start.scaleX, start.scaleY));
			const a = toLayerSpace(start, from);
			const b = toLayerSpace(start, to);
			const offset = { x: b.x - a.x, y: b.y - a.y };
			const sides = handleSides(handle);
			const tolerance = SNAP_PX / viewport.scale;
			let guideX: number | null = null;
			let guideY: number | null = null;
			for (const axis of ["x", "y"] as const) {
				const side = sides[axis];
				if (side === 0) continue;
				const half = axis === "x" ? box.halfWidth : box.halfHeight;
				const position = side * half + offset[axis];
				const snap = snapSide(
					start,
					axis,
					position,
					snapLines.value,
					tolerance,
				);
				if (!snap) continue;
				// Unless that takes the box under its minimum (see `resizeByDrag`).
				if (side * snap.position + half < Math.min(minSize, half * 2)) continue;
				offset[axis] += snap.position - position;
				if (snap.guide === "x") guideX = snap.line;
				else guideY = snap.line;
			}
			if (
				(guideX !== null && guideX !== live.guideX.value) ||
				(guideY !== null && guideY !== live.guideY.value)
			) {
				scheduleOnRN(hapticTick);
			}
			live.guideX.value = guideX;
			live.guideY.value = guideY;
			const next = aspectLocked.value
				? resizeLockedByDrag(start, box, handle, offset, minSize)
				: resizeByDrag(start, box, handle, offset, minSize);
			live.x.value = next.transform.x;
			live.y.value = next.transform.y;
			if (live.resizeMode.value === "stretch") {
				live.scaleX.value = start.scaleX * (next.box.halfWidth / box.halfWidth);
				live.scaleY.value =
					start.scaleY * (next.box.halfHeight / box.halfHeight);
			} else {
				live.halfWidth.value = next.box.halfWidth;
				live.halfHeight.value = next.box.halfHeight;
			}
			resizedBox.value = live.resizeMode.value === "box";
		};

		// Drags a line's end, as `handle` grabbed it, from `from` to `to`, in the
		// frame it had when the drag began. Its other end stays put, and it
		// settles on quarter turns as a rotation does.
		const dragEndTo = (handle: ResizeHandle, from: Point, to: Point) => {
			"worklet";
			const start = {
				x: startX.value,
				y: startY.value,
				scaleX: handleStartScaleX.value,
				scaleY: handleStartScaleY.value,
				rotation: handleStartRotation.value,
			};
			const line = dragLineEnd(
				start,
				handleStartBox.value.halfWidth,
				handleSides(handle).x < 0 ? -1 : 1,
				{ x: to.x - from.x, y: to.y - from.y },
				MIN_BOX_PX / viewport.scale,
			);
			settle(live.rotation, line.rotation, line.snapped ? line.rotation : null);
			live.x.value = line.x;
			live.y.value = line.y;
			live.halfWidth.value = line.width / 2 / start.scaleX;
			resizedBox.value = true;
		};

		// The first gesture to start holds the selected layer, if there is one.
		const gestureStarted = () => {
			"worklet";
			if (activeCount.value === 0) {
				moved.value = false;
				resizedBox.value = false;
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
				if (resizedBox.value) {
					scheduleOnRN(
						onResize,
						id,
						readLiveTransform(live),
						readLiveBox(live),
					);
				} else {
					scheduleOnRN(onCommit, id, readLiveTransform(live));
				}
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
								live.resizeMode.value,
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
						holdLayer(live, target.id, target);
						scheduleOnRN(onSelect, target.id);
					}
				}
				startX.value = live.x.value;
				startY.value = live.y.value;
				handleStartScaleX.value = live.scaleX.value;
				handleStartScaleY.value = live.scaleY.value;
				handleStartRotation.value = live.rotation.value;
				handleStartBox.value = readLiveBox(live);
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
					} else if (live.resizeMode.value === "endpoints") {
						dragEndTo(handle, from, to);
					} else if (live.resizeMode.value !== "none") {
						resizeTo(handle, from, to);
					} else {
						const scale = clampScale(
							scaleByDrag(center, from, to, handleStartScaleX.value),
						);
						live.scaleX.value = scale;
						live.scaleY.value =
							handleStartScaleY.value * (scale / handleStartScaleX.value);
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
				startScaleX.value = live.scaleX.value;
				startScaleY.value = live.scaleY.value;
			})
			.onUpdate((event) => {
				if (!holding() || dragHandle.value !== null) return;
				const scale = clampScale(startScaleX.value * event.scale);
				live.scaleX.value = scale;
				live.scaleY.value = startScaleY.value * (scale / startScaleX.value);
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
		aspectLocked,
		layers,
		viewport,
		documentSize,
		onTap,
		onSelect,
		onCommit,
		onResize,
		onHover,
		onHoverEnd,
		downX,
		downY,
		travel,
		dragHandle,
		handleStartScaleX,
		handleStartScaleY,
		handleStartRotation,
		handleStartBox,
		activeCount,
		moved,
		resizedBox,
		snapLines,
		startX,
		startY,
		startScaleX,
		startScaleY,
		startRotation,
	]);
}
