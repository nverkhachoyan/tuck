import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import { TextButton } from "./TextButton";

/**
 * Top bar with a Back action, an optional centered title, and an optional
 * trailing action (keep it text-sized so every header has the same height).
 */
export function ScreenHeader({
	title,
	onBack,
	action,
}: {
	title?: string;
	onBack: () => void;
	action?: ReactNode;
}) {
	return (
		<View style={styles.container}>
			{title && (
				<View style={styles.titleContainer} pointerEvents="none">
					<Text style={styles.title}>{title}</Text>
				</View>
			)}
			<TextButton label="Back" onPress={onBack} />
			{action}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		justifyContent: "space-between",
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
