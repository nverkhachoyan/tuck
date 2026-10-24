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
