import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
	Pressable,
	type PressableProps,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { colors, radii, space, typography, webTransition } from "@/theme";
import { interaction } from "./interaction";
import { useTooltip } from "./Tooltip";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ButtonVariant = "primary" | "secondary" | "danger";
// Small is for bars across the top of a screen, which it fits.
type ButtonSize = "large" | "medium" | "small";

type ButtonProps = Omit<PressableProps, "style" | "children"> & {
	label: string;
	icon?: IconName;
	variant?: ButtonVariant;
	size?: ButtonSize;
	// On web, a hover shows the label with this key (see `useTooltip`).
	shortcut?: string;
};

export function Button({
	label,
	icon,
	variant = "secondary",
	size = "medium",
	shortcut,
	...props
}: ButtonProps) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const enabled = !props.disabled;
	const labelColor =
		variant === "primary" ? colors.onAccent : colors.textPrimary;
	const tone = TONES[variant];

	return (
		<>
			<Pressable
				hitSlop={size === "small" ? 10 : 4}
				accessibilityRole="button"
				{...(shortcut ? anchor : {})}
				{...props}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.base,
						styles[size],
						tone.rest,
						webTransition,
						enabled && hovered && tone.hovered,
						enabled && pressed && [tone.pressed, styles.pressed],
						!enabled && styles.disabled,
					];
				}}
			>
				{icon && (
					<View style={styles.icon}>
						<Ionicons
							name={icon}
							size={size === "large" ? 20 : 18}
							color={labelColor}
						/>
					</View>
				)}
				<Text
					numberOfLines={1}
					style={[
						styles.label,
						size === "large" && styles.labelLarge,
						{ color: labelColor },
					]}
				>
					{label}
				</Text>
			</Pressable>
			{tooltip}
		</>
	);
}

const TONES = {
	primary: StyleSheet.create({
		rest: { backgroundColor: colors.accent },
		hovered: { backgroundColor: colors.accentHover },
		pressed: { backgroundColor: colors.accentPressed },
	}),
	secondary: StyleSheet.create({
		rest: { backgroundColor: colors.surface, borderColor: colors.border },
		hovered: {
			backgroundColor: colors.surfaceHover,
			borderColor: colors.borderStrong,
		},
		pressed: { backgroundColor: colors.surfacePressed },
	}),
	danger: StyleSheet.create({
		rest: { backgroundColor: colors.danger },
		hovered: { backgroundColor: colors.dangerHover },
		pressed: { backgroundColor: colors.dangerPressed },
	}),
};

const styles = StyleSheet.create({
	base: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		borderWidth: 1,
		borderColor: "transparent",
	},
	large: {
		height: 56,
		paddingHorizontal: 20,
		borderRadius: radii.medium,
	},
	medium: {
		height: 44,
		paddingHorizontal: 18,
		borderRadius: radii.medium,
	},
	small: {
		height: 34,
		paddingHorizontal: 14,
		borderRadius: 17,
	},
	pressed: {
		transform: [{ scale: 0.98 }],
	},
	disabled: {
		opacity: 0.4,
	},
	// Icons sit a touch low beside a label's capitals.
	icon: {
		marginTop: -1,
	},
	label: {
		...typography.bodyStrong,
	},
	labelLarge: {
		...typography.title,
	},
});
