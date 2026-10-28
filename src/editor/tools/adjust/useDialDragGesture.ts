import { useMemo } from "react";
import { Gesture, type TapGesture } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { type DialDrag, draggedDialValue } from "../../shell/dialDrag";

// How far a finger moves sideways before it turns the dial, and up or down
// before the drag is left alone.
const ACTIVE_PX = 8;
const FAIL_PX = 16;

/**
 * A sideways drag anywhere on the canvas that turns `drag`'s dial, rightward
 * raising it, at the dial's own rate. It races `tap`, so a tap stays a tap.
 * A second finger holds the value, leaving the view's pinch to it. Without
 * a `drag`, just the tap.
 */
export function useDialDragGesture(drag: DialDrag | null, tap: TapGesture) {
	const start = useSharedValue(0);
	const dragging = useSharedValue(false);
	return useMemo(() => {
		if (!drag) return tap;
		const { value, scale, max, onBegin, onChange, onEnd } = drag;
		const pan = Gesture.Pan()
			.activeOffsetX([-ACTIVE_PX, ACTIVE_PX])
			.failOffsetY([-FAIL_PX, FAIL_PX])
			.onStart(() => {
				dragging.value = true;
				start.value = value.value;
				onBegin();
			})
			.onUpdate((event) => {
				if (event.numberOfPointers > 1) return;
				onChange(
					draggedDialValue(
						start.value,
						event.translationX,
						value.value,
						scale,
						max,
					),
				);
			})
			.onFinalize(() => {
				if (!dragging.value) return;
				dragging.value = false;
				onEnd();
			});
		return Gesture.Race(pan, tap);
	}, [drag, tap, start, dragging]);
}
