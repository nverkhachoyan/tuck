import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import { TextButton } from "./TextButton";

/** Top bar with a Back action and an optional centered title. */
export function ScreenHeader({
	title,
	onBack,
}: {
	title?: string;
	onBack: () => void;
}) {
	return (
		<View style={styles.container}>
			{title && (
				<View style={styles.titleContainer} pointerEvents="none">
					<Text style={styles.title}>{title}</Text>
				</View>
			)}
			<TextButton label="Back" onPress={onBack} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	// Centered on the whole bar rather than the space left of Back.
	titleContainer: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
	},
});
