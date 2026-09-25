import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { CheckerFill } from "@/ui/CheckerFill";
import { RingChoice } from "@/ui/RingChoice";

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
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		overflow: "hidden",
	},
});
