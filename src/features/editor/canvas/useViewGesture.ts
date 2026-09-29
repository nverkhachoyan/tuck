import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
	type DocumentViewport,
	panViewport,
	type ViewFrame,
	zoomViewportAbout,
} from "../viewport";
import {
	continueTravel,
	type PointerTravel,
	startTravel,
} from "./pointerTravel";
import {
	readShownViewport,
	type ShownViewport,
	showViewport,
} from "./shownViewport";

/**
 * Two fingers zoom and pan the view: a pinch scales it about the fingers,
 * and moving them moves it. Each frame applies only what changed since the
 * last, so a limit reached on the way (see `clampViewport`) gives way as soon
 * as the fingers turn back. Once they lift, `onCommit` gets the viewport
 * they left. It runs beside whatever one finger does on the canvas.
 *
 * While not `enabled`, as when two fingers transform the selected layer
 * instead, it doesn't start.
 */
export function useViewGesture({
	shown,
	frame,
	enabled,
	onCommit,
}: {
	shown: ShownViewport;
	frame: ViewFrame;
	enabled: boolean;
	onCommit: (viewport: DocumentViewport) => void;
}) {
	const lastScale = useSharedValue(1);
	const travel = useSharedValue<PointerTravel>(
		startTravel({ x: 0, y: 0, numberOfPointers: 0 }),
	);
	const activeCount = useSharedValue(0);

	return useMemo(() => {
		const started = () => {
			"worklet";
			activeCount.value += 1;
		};
		const ended = () => {
			"worklet";
			activeCount.value = Math.max(0, activeCount.value - 1);
			if (activeCount.value === 0) {
				scheduleOnRN(onCommit, readShownViewport(shown));
			}
		};

		const pinch = Gesture.Pinch()
			.enabled(enabled)
			.onStart((event) => {
				lastScale.value = event.scale;
				started();
			})
			.onUpdate((event) => {
				const factor = event.scale / lastScale.value;
				lastScale.value = event.scale;
				showViewport(
					shown,
					zoomViewportAbout(frame, readShownViewport(shown), factor, {
						x: event.focalX,
						y: event.focalY,
					}),
				);
			})
			.onEnd(ended);

		// The fingers' midpoint jumps as one lands or lifts, which `travel`
		// leaves out.
		const pan = Gesture.Pan()
			.enabled(enabled)
			.minPointers(2)
			.onStart((event) => {
				travel.value = startTravel(event);
				started();
			})
			.onUpdate((event) => {
				const before = travel.value;
				const after = continueTravel(before, event);
				travel.value = after;
				showViewport(
					shown,
					panViewport(
						frame,
						readShownViewport(shown),
						after.dx - before.dx,
						after.dy - before.dy,
					),
				);
			})
			.onEnd(ended);

		return Gesture.Simultaneous(pinch, pan);
	}, [shown, frame, enabled, onCommit, lastScale, travel, activeCount]);
}
