import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radii, webTransition } from "@/theme";
import { Highlight } from "./Highlight";
import { interaction } from "./interaction";

// The minimum comfortable touch target, and the ring that marks the chosen
// option inside it.
export const RING_TARGET = 44;
const RING = 36;

/**
 * One of a row of round choices, like a color, ringed when it's the one
 * chosen. `children` is what it shows, at most `RING` across. An icon
 * rather than a color or a dot takes the `highlight` variant, marked as
 * other options are; its `children` can be a function of the color to draw
 * the icon in, which changes while it's highlighted.
 */
export function RingChoice({
	label,
	selected,
	variant = "ring",
	onPress,
	children,
}: {
	label: string;
	selected: boolean;
	variant?: "ring" | "highlight";
	onPress: () => void;
	children: ReactNode | ((ink: string) => ReactNode);
}) {
	const highlight = variant === "highlight";
	const ink = highlight && selected ? colors.onHighlight : colors.textPrimary;
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected }}
			style={styles.target}
		>
			{(state) => {
				const { pressed, hovered } = interaction(state);
				return (
					<View
						style={[
							styles.ring,
							highlight && styles.plain,
							webTransition,
							hovered && (highlight ? styles.plainHovered : styles.ringHovered),
							selected && !highlight && styles.ringSelected,
							pressed && styles.ringPressed,
						]}
					>
						{highlight && selected && <Highlight />}
						{typeof children === "function" ? children(ink) : children}
					</View>
				);
			}}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	target: {
		width: RING_TARGET,
		height: RING_TARGET,
		borderRadius: RING_TARGET / 2,
		alignItems: "center",
		justifyContent: "center",
	},
	ring: {
		width: RING,
		height: RING,
		borderRadius: RING / 2,
		borderWidth: 2,
		borderColor: "transparent",
		alignItems: "center",
		justifyContent: "center",
	},
	ringHovered: {
		borderColor: colors.borderStrong,
	},
	ringSelected: {
		borderColor: colors.chosen,
	},
	plain: {
		borderWidth: 0,
		borderRadius: radii.small,
	},
	plainHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	ringPressed: {
		transform: [{ scale: 0.92 }],
	},
});
