import { useEffect } from "react";
import { Platform } from "react-native";
import { useSharedValue } from "react-native-reanimated";

/**
 * Whether Shift is held, for the resize gesture. Gesture Handler does not
 * expose keyboard modifiers on a pan, so the UI thread reads this shared
 * value. Letting go of the window clears it.
 */
export function useShiftHeld() {
	const aspectLocked = useSharedValue(false);
	useEffect(() => {
		// Native has a `window`, but no events on it.
		if (Platform.OS !== "web") return;
		const setLock = (event: KeyboardEvent) => {
			aspectLocked.value = event.shiftKey;
		};
		window.addEventListener("keydown", setLock);
		window.addEventListener("keyup", setLock);
		const clearLock = () => {
			aspectLocked.value = false;
		};
		window.addEventListener("blur", clearLock);
		return () => {
			window.removeEventListener("keydown", setLock);
			window.removeEventListener("keyup", setLock);
			window.removeEventListener("blur", clearLock);
		};
	}, [aspectLocked]);
	return aspectLocked;
}
