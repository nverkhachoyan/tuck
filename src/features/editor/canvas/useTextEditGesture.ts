import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { hasFinePointer } from "../handles/handleMetrics";

export type TextPressPhase = "begin" | "move" | "end";

/**
 * Presses on the canvas while text is edited in place, reported in view
 * coordinates for the canvas to place the caret, select, or finish: where
 * one lands, each move, and where it lifts. A mouse's hover is reported too,
 * for the cursor.
 *
 * It reports the end when the gesture finishes, however it does: iOS only
 * activates a pan once the finger moves, so a tap would otherwise never end.
 */
export function useTextEditGesture({
	onPress,
	onHover,
	onHoverEnd,
}: {
	onPress: (phase: TextPressPhase, x: number, y: number) => void;
	onHover: (x: number, y: number) => void;
	onHoverEnd: () => void;
}) {
	return useMemo(() => {
		const press = Gesture.Pan()
			.minDistance(0)
			.onBegin((event) => {
				scheduleOnRN(onPress, "begin", event.x, event.y);
			})
			.onUpdate((event) => {
				scheduleOnRN(onPress, "move", event.x, event.y);
			})
			.onFinalize((event) => {
				scheduleOnRN(onPress, "end", event.x, event.y);
			});

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

		return Gesture.Simultaneous(hover, press);
	}, [onPress, onHover, onHoverEnd]);
}
