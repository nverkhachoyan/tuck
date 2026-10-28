import type { ReactNode } from "react";
import {
	type Insets,
	Pressable,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import { Highlight } from "./Highlight";
import { chosenOnWeb, interaction } from "./interaction";
import { colors, radii, webTransition } from "./theme";

/**
 * A small choice in a row of them, highlighted while `selected`.
 * - `style` is the touch target around the chip, and `frameStyle` the chip
 *   itself: its height, and its layout when it holds more than a label.
 * - The content is the caller's, which switches its own color to
 *   `colors.onHighlight` while selected.
 */
export function Chip({
	selected,
	onPress,
	accessibilityLabel,
	hitSlop,
	style,
	frameStyle,
	children,
}: {
	selected: boolean;
	onPress: () => void;
	accessibilityLabel: string;
	hitSlop?: number | Insets;
	style?: StyleProp<ViewStyle>;
	frameStyle?: StyleProp<ViewStyle>;
	children: ReactNode;
}) {
	return (
		<Pressable
			hitSlop={hitSlop}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ selected }}
			{...chosenOnWeb(selected)}
			style={style}
		>
			{(state) => {
				const { pressed, hovered } = interaction(state);
				return (
					<View
						style={[
							styles.frame,
							frameStyle,
							webTransition,
							hovered && styles.hovered,
							pressed && styles.pressed,
						]}
					>
						{selected && <Highlight />}
						{children}
					</View>
				);
			}}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	frame: {
		paddingHorizontal: 12,
		borderRadius: radii.small,
		justifyContent: "center",
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	pressed: {
		transform: [{ scale: 0.96 }],
	},
});
