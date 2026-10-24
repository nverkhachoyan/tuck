import { Platform } from "react-native";

/**
 * Whether controls are sized for a mouse or trackpad rather than a finger: a
 * web browser on a computer. Read once as the page loads, like the palette,
 * so styles take it when they're created. An iPad reports a coarse pointer
 * even with a trackpad, so it keeps touch sizes.
 */
export const compactControls =
	Platform.OS === "web" &&
	typeof matchMedia === "function" &&
	matchMedia("(pointer: fine)").matches;
