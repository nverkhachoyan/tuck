import type { DerivedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/platform/haptics";

/**
 * How a dial's ruler measures its value: `step` is one unit of it, which
 * the readout counts and arrow keys move by, drawn `pxPerStep` apart. A
 * tick marks every `tickEvery` steps, and a long one every `majorEvery`.
 * The value settles on 0 within `snap` steps of it, and with `wholeSteps`
 * it only ever takes whole steps.
 */
export type DialScale = {
	step: number;
	pxPerStep: number;
	tickEvery: number;
	majorEvery: number;
	snap: number;
	wholeSteps?: boolean;
};

/**
 * A value a drag outside the dial can change too, as dragging over the photo
 * changes Adjust's: the dial's value, its scale and reach, and the worklets
 * that bracket each change.
 */
export type DialDrag = {
	value: DerivedValue<number>;
	scale: DialScale;
	max: number;
	onBegin: () => void;
	onChange: (value: number) => void;
	onEnd: () => void;
};

/**
 * Where a drag `travel` pixels along takes a dial's value from `start`,
 * `current` being where it is now: within ±`max`, in whole steps if the
 * scale takes only those, and settling on 0 near it with a haptic tick as it
 * lands. A worklet.
 */
export function draggedDialValue(
	start: number,
	travel: number,
	current: number,
	scale: DialScale,
	max: number,
): number {
	"worklet";
	const { step, pxPerStep, snap, wholeSteps } = scale;
	let next = Math.min(max, Math.max(-max, start + (travel / pxPerStep) * step));
	if (wholeSteps) next = Math.round(next / step) * step;
	if (Math.abs(next / step) < snap) {
		if (current !== 0) scheduleOnRN(hapticTick);
		next = 0;
	}
	return next;
}
