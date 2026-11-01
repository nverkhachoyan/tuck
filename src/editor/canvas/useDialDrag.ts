import {
	type TapGesture,
	useCompetingGestures,
	usePanGesture,
} from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { type DialDrag, draggedDialValue } from "../shell/dialDrag";

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
export function useDialDrag(
	drag: DialDrag | null,
	tap: TapGesture,
	enabled: boolean = true,
) {
	const start = useSharedValue(0);
	const dragging = useSharedValue(false);

	const pan = usePanGesture({
		enabled: enabled && Boolean(drag),
		activeOffsetX: [-ACTIVE_PX, ACTIVE_PX],
		failOffsetY: [-FAIL_PX, FAIL_PX],
		onActivate: () => {
			if (!drag) return;
			dragging.value = true;
			start.value = drag.value.value;
			drag.onBegin();
		},
		onUpdate: (event) => {
			if (!drag || event.numberOfPointers > 1) return;
			drag.onChange(
				draggedDialValue(
					start.value,
					event.translationX,
					drag.value.value,
					drag.scale,
					drag.max,
				),
			);
		},
		onFinalize: () => {
			if (!dragging.value) return;
			dragging.value = false;
			drag?.onEnd();
		},
	});

	return useCompetingGestures(pan, tap);
}
