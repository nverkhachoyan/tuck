import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme";

// The minimum comfortable touch target, and the swatch drawn inside it.
const TARGET = 44;
const SWATCH_SIZE = 28;

const BACKGROUNDS = [
	{ color: null, label: "Transparent background" },
	{ color: "#FFFFFF", label: "White background" },
	{ color: "#000000", label: "Black background" },
];

/** The canvas's fill: transparent (a checkerboard swatch), white, or black. */
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
						<View
							style={[
								styles.swatch,
								color !== null && { backgroundColor: color },
								selected && styles.swatchSelected,
							]}
						>
							{color === null && <Checker />}
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}

function Checker() {
	return (
		<View style={styles.checker}>
			<View style={styles.checkerRow}>
				<View style={[styles.cell, styles.light]} />
				<View style={styles.cell} />
			</View>
			<View style={styles.checkerRow}>
				<View style={styles.cell} />
				<View style={[styles.cell, styles.light]} />
			</View>
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
	swatch: {
		width: SWATCH_SIZE,
		height: SWATCH_SIZE,
		borderRadius: SWATCH_SIZE / 2,
		borderWidth: 1,
		borderColor: colors.border,
		overflow: "hidden",
	},
	swatchSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	checker: {
		flex: 1,
		backgroundColor: colors.checkerDark,
	},
	checkerRow: {
		flex: 1,
		flexDirection: "row",
	},
	cell: {
		flex: 1,
	},
	light: {
		backgroundColor: colors.checkerLight,
	},
});
