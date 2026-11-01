import {
	usePanGesture,
	usePinchGesture,
	useSimultaneousGestures,
} from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { LiveTransform } from "./liveTransform";
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
import {
	type DocumentViewport,
	panViewport,
	type ViewFrame,
	zoomViewportAbout,
} from "./viewport";

/**
 * Two fingers zoom and pan the view: a pinch scales it about the fingers,
 * and moving them moves it. One finger pans it too where `dragAlone` says
 * so, from where it lands; without it, one finger is left to whatever else
 * the canvas does. Each frame applies only what changed since the last, so
 * a limit reached on the way (see `clampViewport`) gives way as soon as the
 * fingers turn back. Once they lift, `onCommit` gets the viewport they left,
 * if they moved it.
 *
 * Without `twoFingers`, as when two fingers transform the selected layer
 * instead, only one finger moves it, where `dragAlone` allows. While a
 * gesture holds a layer (`live`), it stands still.
 */
export function useViewGesture({
	shown,
	frame,
	live,
	twoFingers,
	dragAlone,
	onCommit,
}: {
	shown: ShownViewport;
	frame: ViewFrame;
	live: LiveTransform;
	twoFingers: boolean;
	dragAlone: ((x: number, y: number) => boolean) | null;
	onCommit: (viewport: DocumentViewport) => void;
}) {
	const lastScale = useSharedValue(1);
	const travel = useSharedValue<PointerTravel>(
		startTravel({ x: 0, y: 0, numberOfPointers: 0 }),
	);
	const alone = useSharedValue(false);
	const activeCount = useSharedValue(0);
	const moved = useSharedValue(false);

	const started = () => {
		"worklet";
		if (activeCount.value === 0) moved.value = false;
		activeCount.value += 1;
	};
	const ended = () => {
		"worklet";
		activeCount.value = Math.max(0, activeCount.value - 1);
		if (activeCount.value === 0 && moved.value) {
			scheduleOnRN(onCommit, readShownViewport(shown));
		}
	};
	const show = (viewport: DocumentViewport) => {
		"worklet";
		showViewport(shown, viewport);
		moved.value = true;
	};

	const pinch = usePinchGesture({
		enabled: twoFingers,
		onActivate: (event) => {
			lastScale.value = event.scale;
			started();
		},
		onUpdate: (event) => {
			const factor = event.scale / lastScale.value;
			lastScale.value = event.scale;
			if (live.heldId.value !== null) return;
			show(
				zoomViewportAbout(frame, readShownViewport(shown), factor, {
					x: event.focalX,
					y: event.focalY,
				}),
			);
		},
		onDeactivate: ended,
	});

	// The fingers' midpoint jumps as one lands or lifts, which `travel`
	// leaves out.
	const pan = usePanGesture({
		enabled: twoFingers || dragAlone !== null,
		minPointers: dragAlone ? 1 : 2,
		onBegin: (event) => {
			alone.value = dragAlone?.(event.x, event.y) ?? false;
		},
		onActivate: (event) => {
			travel.value = startTravel(event);
			started();
		},
		onUpdate: (event) => {
			const before = travel.value;
			const after = continueTravel(before, event);
			travel.value = after;
			const allowed = event.numberOfPointers < 2 ? alone.value : twoFingers;
			if (!allowed || live.heldId.value !== null) return;
			show(
				panViewport(
					frame,
					readShownViewport(shown),
					after.dx - before.dx,
					after.dy - before.dy,
				),
			);
		},
		onDeactivate: ended,
	});

	return useSimultaneousGestures(pinch, pan);
}
