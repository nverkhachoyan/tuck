import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";

// The minimum comfortable touch target, and the ring that marks the chosen
// option inside it.
const TARGET = 44;
const RING = 36;
const SWATCH_SIZE = 26;

export const SWATCHES = [
	{ color: "#FFFFFF", name: "White" },
	{ color: "#000000", name: "Black" },
	{ color: "#FF3B30", name: "Red" },
	{ color: "#FFD60A", name: "Yellow" },
	{ color: "#34C759", name: "Green" },
	{ color: "#0A84FF", name: "Blue" },
];

/** The color swatches, led by a "none" swatch when `noneLabel` is given. */
export function Swatches({
	value,
	noneLabel,
	onPick,
}: {
	value: string | null;
	noneLabel?: string;
	onPick: (color: string | null) => void;
}) {
	return (
		<View style={styles.swatches}>
			{noneLabel && (
				<RingChoice
					label={noneLabel}
					selected={value === null}
					onPress={() => onPick(null)}
				>
					<View style={styles.swatch}>
						<View style={styles.swatchSlash} />
					</View>
				</RingChoice>
			)}
			{SWATCHES.map(({ color, name }) => (
				<RingChoice
					key={color}
					label={name}
					selected={value === color}
					onPress={() => onPick(color)}
				>
					<View style={[styles.swatch, { backgroundColor: color }]} />
				</RingChoice>
			))}
		</View>
	);
}

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
	// Lines the first swatch up with the panel's edge, past its target's margin.
	swatches: {
		flexDirection: "row",
		marginHorizontal: -(TARGET - SWATCH_SIZE) / 2,
	},
	target: {
		width: TARGET,
		height: TARGET,
		borderRadius: TARGET / 2,
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
	swatch: {
		width: SWATCH_SIZE,
		height: SWATCH_SIZE,
		borderRadius: SWATCH_SIZE / 2,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	swatchSlash: {
		width: 36,
		height: 2,
		backgroundColor: colors.textSecondary,
		transform: [{ rotate: "-45deg" }],
	},
});
