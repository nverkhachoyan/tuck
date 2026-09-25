import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { RING_TARGET, RingChoice } from "@/ui/RingChoice";

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
export function ColorSwatches({
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

const styles = StyleSheet.create({
	// Lines the first swatch up with the panel's edge, past its target's margin.
	swatches: {
		flexDirection: "row",
		marginHorizontal: -(RING_TARGET - SWATCH_SIZE) / 2,
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
