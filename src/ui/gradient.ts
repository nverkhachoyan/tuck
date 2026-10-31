import { Platform, type ViewStyle } from "react-native";
import { toneGradientCss } from "./hsv";

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

/**
 * Fades from clear to `hex` (a `#RRGGBB` color) toward `direction`, such as
 * "bottom". It fades from the same color at zero alpha, since `transparent`
 * can pass through gray.
 */
export function fadeTo(direction: string, hex: string): ViewStyle {
	const [r, g, b] = [1, 3, 5].map((at) =>
		Number.parseInt(hex.slice(at, at + 2), 16),
	);
	return gradientBackground(
		`linear-gradient(to ${direction}, rgba(${r}, ${g}, ${b}, 0), ${hex})`,
	);
}

// Around the hue circle and back to red, as a color picker's hue bar is.
export const HUE_GRADIENT =
	"linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF00FF, #FF0000)";

/**
 * An opaque gradient background from white through pure hue to black for 1D tone sliders.
 */
export function toneGradient(pureHex: string): ViewStyle {
	return gradientBackground(toneGradientCss(pureHex));
}
