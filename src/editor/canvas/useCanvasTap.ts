import { useTapGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { TAP_SLOP_PX } from "./strokeIntent";

/**
 * A tap on the canvas, short of a pinch's travel, so two fingers zooming
 * aren't one. `onTap` hears where it landed, in the view.
 */
export function useCanvasTap(
	onTap: (screenX: number, screenY: number) => void,
) {
	return useTapGesture({
		maxDistance: TAP_SLOP_PX,
		onDeactivate: (event) => {
			if (!event.canceled) scheduleOnRN(onTap, event.x, event.y);
		},
	});
}
