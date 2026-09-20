import { Pressable, type PressableProps, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "large" | "medium";

type ButtonProps = Omit<PressableProps, "style"> & {
	label: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
};

export function Button({
	label,
	variant = "secondary",
	size = "medium",
	...props
}: ButtonProps) {
	const isPrimary = variant === "primary";
	const isLarge = size === "large";

	return (
		<Pressable
			hitSlop={8}
			{...props}
			style={({ pressed }) => [
				styles.base,
				isLarge ? styles.large : styles.medium,
				isPrimary ? styles.primary : styles.secondary,
				pressed && styles.pressed,
			]}
		>
			<Text
				style={[
					styles.label,
					isLarge && styles.labelLarge,
					isPrimary && styles.labelPrimary,
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		alignItems: "center",
		justifyContent: "center",
	},
	large: {
		borderRadius: 16,
		paddingVertical: 18,
	},
	medium: {
		borderRadius: 12,
		paddingHorizontal: 18,
		paddingVertical: 10,
	},
	primary: {
		backgroundColor: colors.accent,
	},
	secondary: {
		backgroundColor: colors.surface,
	},
	pressed: {
		opacity: 0.8,
	},
	label: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	labelLarge: {
		fontSize: 17,
	},
	labelPrimary: {
		color: colors.onAccent,
	},
});
