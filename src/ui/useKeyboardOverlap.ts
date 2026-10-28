import { type RefObject, useEffect, useState } from "react";
import {
	Keyboard,
	type KeyboardMetrics,
	Platform,
	type ViewInstance,
} from "react-native";

/**
 * How much of the view's bottom the software keyboard covers, in pixels,
 * while `enabled`. It measures the overlap rather than the keyboard's
 * height, so it's right wherever the view sits, and 0 where the system
 * already resized the window to clear the keyboard. Always 0 on web, which
 * reports no keyboard, and with a hardware keyboard, which shows none.
 */
export function useKeyboardOverlap(
	ref: RefObject<ViewInstance | null>,
	enabled: boolean,
): number {
	const [overlap, setOverlap] = useState(0);
	useEffect(() => {
		if (!enabled || Platform.OS === "web") return;
		const measure = (keyboard: KeyboardMetrics | null | undefined) => {
			if (!keyboard) {
				setOverlap(0);
				return;
			}
			ref.current?.measureInWindow((_x, y, _width, height) => {
				setOverlap(Math.max(0, y + height - keyboard.screenY));
			});
		};
		// iOS says where the keyboard is going as it starts to move; Android
		// only once it's there.
		const ios = Platform.OS === "ios";
		const shown = Keyboard.addListener(
			ios ? "keyboardWillShow" : "keyboardDidShow",
			(event) => measure(event.endCoordinates),
		);
		const hidden = Keyboard.addListener(
			ios ? "keyboardWillHide" : "keyboardDidHide",
			() => setOverlap(0),
		);
		// It may be up already.
		measure(Keyboard.isVisible() ? Keyboard.metrics() : undefined);
		return () => {
			shown.remove();
			hidden.remove();
			setOverlap(0);
		};
	}, [ref, enabled]);
	return overlap;
}
