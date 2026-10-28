import { Platform, type PressableStateCallbackType } from "react-native";

export type InteractionState = {
	pressed: boolean;
	// A mouse is over it. Only web reports this.
	hovered: boolean;
};

/**
 * A Pressable's state with the hover React Native Web reports at runtime,
 * which React Native's types leave out. On native, `hovered` stays false.
 */
export function interaction(
	state: PressableStateCallbackType,
): InteractionState {
	const { hovered = false } = state as PressableStateCallbackType & {
		hovered?: boolean;
	};
	return { pressed: state.pressed, hovered };
}

/**
 * Spread on a Pressable to show its pressed state as soon as it's pressed,
 * as native does. React Native Web otherwise holds it back 50ms, in case a
 * touch turns into a scroll.
 */
export const pressAtOnce = (
	Platform.OS === "web" ? { delayPressIn: 0 } : {}
) as object;

/**
 * Spread on a button that's one of a row of choices, so a screen reader on
 * web hears whether it's the chosen one; `undefined` for a button that isn't
 * a choice. React Native Web ignores `accessibilityState.selected`, and
 * `aria-selected` means nothing on a button. React Native's types leave out
 * `aria-pressed`.
 */
export function chosenOnWeb(chosen: boolean | undefined) {
	return (
		Platform.OS === "web" && chosen !== undefined
			? { "aria-pressed": chosen }
			: {}
	) as object;
}
