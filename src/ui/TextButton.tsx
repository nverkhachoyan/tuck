import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme";

type TextButtonTone = "default" | "accent" | "danger";

/** A borderless, label-only button for headers and inline panel actions. */
export function TextButton({
	label,
	tone = "default",
	onPress,
}: {
	label: string;
	tone?: TextButtonTone;
	onPress: () => void;
}) {
	return (
		<Pressable hitSlop={8} onPress={onPress}>
			<Text style={[styles.label, tone !== "default" && styles[tone]]}>
				{label}
			</Text>
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
	danger: {
		color: colors.danger,
		fontWeight: "600",
	},
});
