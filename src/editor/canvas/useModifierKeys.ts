import { useEffect } from "react";
import { Platform } from "react-native";
import { useSharedValue } from "react-native-reanimated";

/**
 * Whether Shift and Alt (Option) are held, for gestures on the UI thread.
 * Gesture Handler does not expose keyboard modifiers on a pan, so gestures
 * read these shared values. Letting go of the window clears them.
 */
export function useModifierKeys() {
	const shift = useSharedValue(false);
	const alt = useSharedValue(false);
	useEffect(() => {
		// Native has a `window`, but no events on it.
		if (Platform.OS !== "web") return;
		const setKeys = (event: KeyboardEvent) => {
			shift.value = event.shiftKey;
			alt.value = event.altKey;
		};
		window.addEventListener("keydown", setKeys);
		window.addEventListener("keyup", setKeys);
		const clearKeys = () => {
			shift.value = false;
			alt.value = false;
		};
		window.addEventListener("blur", clearKeys);
		return () => {
			window.removeEventListener("keydown", setKeys);
			window.removeEventListener("keyup", setKeys);
			window.removeEventListener("blur", clearKeys);
		};
	}, [shift, alt]);
	return { shift, alt };
}
