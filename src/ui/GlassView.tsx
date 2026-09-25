import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import {
	Platform,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import { colors, floatingShadow, radii } from "@/theme";

export type GlassViewProps = {
	// Its size, position, and corners; the glass is clipped to the corners.
	style?: StyleProp<ViewStyle>;
	// Laid out inside the glass.
	contentStyle?: StyleProp<ViewStyle>;
	children?: ReactNode;
};

/**
 * A frosted panel floating over the canvas: it blurs what's behind it on
 * iOS, and is nearly opaque on Android, where expo-blur only blurs views
 * wrapped in its own target. Web blurs with CSS; see `GlassView.web.tsx`.
 *
 * The shadow and the clipping sit on separate views, so clipping the blur
 * to the corners can't clip the shadow away too.
 */
export function GlassView({ style, contentStyle, children }: GlassViewProps) {
	const corners = cornersOf(style);
	return (
		<View style={[styles.shadow, corners, style]}>
			<View
				style={[
					styles.glass,
					corners,
					Platform.OS !== "ios" && styles.fallback,
					contentStyle,
				]}
			>
				{Platform.OS === "ios" && (
					<BlurView
						tint="systemChromeMaterialDark"
						intensity={60}
						style={StyleSheet.absoluteFill}
					/>
				)}
				{children}
			</View>
		</View>
	);
}

/**
 * Fills its parent, or what `style` leaves of it, dimming and blurring
 * what's behind, under modal UI like the text editor. Only dimmed where the
 * platform can't blur.
 */
export function FrostedBackdrop({ style }: { style?: StyleProp<ViewStyle> }) {
	const blurs = Platform.OS === "ios";
	return (
		<View
			style={[
				StyleSheet.absoluteFill,
				{ backgroundColor: blurs ? colors.frostedScrim : colors.scrim },
				style,
			]}
		>
			{blurs && (
				<BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} />
			)}
		</View>
	);
}

/** A style's corner radii, for the view inside it; `radii.panel` by default. */
function cornersOf(style: StyleProp<ViewStyle>): ViewStyle {
	const {
		borderRadius = radii.panel,
		borderTopLeftRadius,
		borderTopRightRadius,
		borderBottomLeftRadius,
		borderBottomRightRadius,
	} = StyleSheet.flatten(style) ?? {};
	return {
		borderRadius,
		borderTopLeftRadius,
		borderTopRightRadius,
		borderBottomLeftRadius,
		borderBottomRightRadius,
	};
}

const styles = StyleSheet.create({
	shadow: {
		borderCurve: "continuous",
		boxShadow: floatingShadow,
	},
	// Fills a panel of fixed size, or wraps its content in one sized by it.
	glass: {
		flexGrow: 1,
		overflow: "hidden",
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.glassBorder,
		backgroundColor: colors.glass,
	},
	fallback: {
		backgroundColor: colors.glassFallback,
	},
});
