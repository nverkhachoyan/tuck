import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, floatingShadow, restingShadow } from "./theme";

/**
 * An opaque panel over the canvas, like the selection bar or a sheet. It
 * reads the same over any photo: a frosted one took on the photo's colors.
 * `style` gives its size, position, and corners; `contentStyle` lays out
 * what's inside, clipped to the corners. A `resting` one lies beside the
 * canvas instead, like the wide editor's rail: the screen's own color, with
 * a fainter edge and shadow.
 */
export function Surface({
	resting = false,
	style,
	contentStyle,
	children,
}: {
	resting?: boolean;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	children?: ReactNode;
}) {
	return (
		<View style={[styles.shadow, resting && styles.restingShadow, style]}>
			<View
				style={[
					styles.surface,
					resting && styles.resting,
					cornersOf(style),
					contentStyle,
				]}
			>
				{children}
			</View>
		</View>
	);
}

// The shadow and the clipping sit on separate views, so clipping the content
// to the corners can't clip the shadow away too.
function cornersOf(style: StyleProp<ViewStyle>): ViewStyle {
	const {
		borderRadius,
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
	restingShadow: {
		boxShadow: restingShadow,
	},
	// Fills a panel of fixed size, or wraps its content in one sized by it.
	surface: {
		flexGrow: 1,
		overflow: "hidden",
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	resting: {
		borderColor: colors.border,
		backgroundColor: colors.background,
	},
});
