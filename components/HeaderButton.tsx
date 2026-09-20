import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "./theme";

export function HeaderButton({
	label,
	accent,
	onPress,
}: {
	label: string;
	accent?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable hitSlop={8} onPress={onPress}>
			<Text style={[styles.label, accent && styles.accent]}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	label: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	accent: {
		color: colors.accent,
		fontWeight: "600",
	},
});
