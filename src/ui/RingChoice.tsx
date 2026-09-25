import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";

// The minimum comfortable touch target, and the ring that marks the chosen
// option inside it.
export const RING_TARGET = 44;
const RING = 36;

/**
 * One of a row of round choices, like a color, ringed when it's the one
 * chosen. `children` is what it shows, at most `RING` across.
 */
export function RingChoice({
	label,
	selected,
	onPress,
	children,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	children: ReactNode;
}) {
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
							webTransition,
							hovered && styles.ringHovered,
							selected && styles.ringSelected,
							pressed && styles.ringPressed,
						]}
					>
						{children}
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
		borderColor: colors.accent,
	},
	ringPressed: {
		transform: [{ scale: 0.92 }],
	},
});
