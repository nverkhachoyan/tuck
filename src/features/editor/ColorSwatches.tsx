import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { gradientBackground } from "@/ui/gradient";
import { RING_TARGET, RingChoice } from "@/ui/RingChoice";

const SWATCH_SIZE = 26;
// The custom color's dot, inside the custom swatch's rainbow.
const CUSTOM_DOT = 14;

export const SWATCHES = [
	{ color: "#FFFFFF", name: "White" },
	{ color: "#000000", name: "Black" },
	{ color: "#FF3B30", name: "Red" },
	{ color: "#FFD60A", name: "Yellow" },
	{ color: "#34C759", name: "Green" },
	{ color: "#0A84FF", name: "Blue" },
];

/**
 * A swatch that opens a color picker: a rainbow, around the color picked
 * with it last (`color`) once there is one. It's chosen whenever the value
 * isn't one of the swatches'.
 */
export type CustomSwatch = { color: string | null; onPress: () => void };

/**
 * The color swatches, led by a "none" swatch when `noneLabel` is given, and
 * followed by a custom one when `custom` is.
 */
export function ColorSwatches({
	value,
	noneLabel,
	custom,
	onPick,
}: {
	value: string | null;
	noneLabel?: string;
	custom?: CustomSwatch;
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
			{custom && (
				<RingChoice
					label="Custom color"
					selected={
						value !== null && !SWATCHES.some((swatch) => swatch.color === value)
					}
					onPress={custom.onPress}
				>
					<View style={[styles.swatch, styles.rainbow]}>
						{custom.color && (
							<View
								style={[styles.customDot, { backgroundColor: custom.color }]}
							/>
						)}
					</View>
				</RingChoice>
			)}
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
	// Diagonal, so the small swatch shows every hue.
	rainbow: gradientBackground(
		"linear-gradient(135deg, #FF3B30, #FFD60A, #34C759, #0A84FF, #BF5AF2)",
	),
	customDot: {
		width: CUSTOM_DOT,
		height: CUSTOM_DOT,
		borderRadius: CUSTOM_DOT / 2,
		borderWidth: 1.5,
		borderColor: colors.surface,
	},
	swatchSlash: {
		width: 36,
		height: 2,
		backgroundColor: colors.textSecondary,
		transform: [{ rotate: "-45deg" }],
	},
});
