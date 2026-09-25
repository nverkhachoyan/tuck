import { Platform, type ViewStyle } from "react-native";

/**
 * A view's background as a CSS gradient, such as `linear-gradient(...)`:
 * React Native's experimental background image on native, and CSS itself on
 * web, which React Native Web passes through but its types leave out.
 */
export function gradientBackground(gradient: string): ViewStyle {
	return Platform.OS === "web"
		? ({ backgroundImage: gradient } as unknown as ViewStyle)
		: { experimental_backgroundImage: gradient };
}

// Around the hue circle and back to red, as a color picker's hue bar is.
export const HUE_GRADIENT =
	"linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)";
