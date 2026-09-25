import { Pressable, StyleSheet, View } from "react-native";
import { colors, webTransition } from "@/theme";
import { CheckerFill } from "@/ui/CheckerFill";
import { interaction } from "@/ui/interaction";

const TARGET = 44;
const RING = 36;
const SWATCH_SIZE = 26;

const BACKGROUNDS = [
	{ color: null, label: "Transparent background" },
	{ color: "#FFFFFF", label: "White background" },
	{ color: "#000000", label: "Black background" },
];

export function BackgroundPicker({
	value,
	onPick,
}: {
	value: string | null;
	onPick: (background: string | null) => void;
}) {
	return (
		<View style={styles.row}>
			{BACKGROUNDS.map(({ color, label }) => {
				const selected = color === value;
				return (
					<Pressable
						key={label}
						onPress={() => onPick(color)}
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
									<View
										style={[
											styles.swatch,
											color !== null && { backgroundColor: color },
										]}
									>
										{color === null && (
											<CheckerFill
												width={SWATCH_SIZE}
												height={SWATCH_SIZE}
												cell={SWATCH_SIZE / 2}
											/>
										)}
									</View>
								</View>
							);
						}}
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
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
		overflow: "hidden",
	},
});
