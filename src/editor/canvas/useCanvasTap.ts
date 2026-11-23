import { useTapGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { TAP_SLOP_PX } from "./strokeIntent";

// A two-finger tap lifts this soon, so a pinch begun slowly isn't one.
const TWO_FINGER_TAP_MS = 300;

/**
 * A tap on the canvas, short of a pinch's travel, so two fingers zooming
 * aren't one. `onTap` hears where it landed, in the view.
 */
export function useCanvasTap(
	onTap: (screenX: number, screenY: number) => void,
	enabled: boolean = true,
) {
	return useTapGesture({
		enabled,
		maxDistance: TAP_SLOP_PX,
		onDeactivate: (event) => {
			if (!event.canceled) scheduleOnRN(onTap, event.x, event.y);
		},
	});
}

/**
 * Two fingers tapping the canvas together, quick and still, as drawing apps
 * take for undo. A second finger already cancels a stroke, so the tap draws
 * nothing first.
 */
export function useTwoFingerTap(onTap: () => void, enabled: boolean) {
	return useTapGesture({
		enabled,
		minPointers: 2,
		maxDistance: TAP_SLOP_PX,
		maxDuration: TWO_FINGER_TAP_MS,
		onDeactivate: (event) => {
			if (!event.canceled) scheduleOnRN(onTap);
		},
	});
}
