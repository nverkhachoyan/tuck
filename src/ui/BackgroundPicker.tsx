import { StyleSheet, View } from "react-native";
import { CheckerFill } from "./CheckerFill";
import { RingChoice } from "./RingChoice";
import { colors } from "./theme";

const SWATCH_SIZE = 26;

const BACKGROUNDS = [
	{ color: null, label: "Transparent background" },
	{ color: "#FFFFFF", label: "White background" },
	{ color: "#000000", label: "Black background" },
];

/** What a screen reader calls the background `value`. */
export function backgroundLabel(value: string | null): string {
	return (
		BACKGROUNDS.find(({ color }) => color === value)?.label ??
		"Transparent background"
	);
}

export function BackgroundPicker({
	value,
	onPick,
}: {
	value: string | null;
	onPick: (background: string | null) => void;
}) {
	return (
		<View style={styles.row}>
			{BACKGROUNDS.map(({ color, label }) => (
				<RingChoice
					key={label}
					label={label}
					selected={color === value}
					onPress={() => onPick(color)}
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
				</RingChoice>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
	},
	swatch: {
		width: SWATCH_SIZE,
		height: SWATCH_SIZE,
		borderRadius: SWATCH_SIZE / 2,
		borderWidth: 1,
		borderColor: colors.swatchRing,
		overflow: "hidden",
	},
});
