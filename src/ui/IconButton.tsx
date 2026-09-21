import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
type IconButtonTone = "default" | "danger";

/**
 * A borderless icon-only button. `label` is required because it's the only
 * name a screen reader gets.
 */
export function IconButton({
	icon,
	label,
	tone = "default",
	onPress,
}: {
	icon: IconName;
	label: string;
	tone?: IconButtonTone;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={10}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={({ pressed }) => pressed && styles.pressed}
		>
			<Ionicons
				name={icon}
				size={22}
				color={tone === "danger" ? colors.danger : colors.textPrimary}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	pressed: {
		opacity: 0.5,
	},
});
