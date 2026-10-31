import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
	ActivityIndicator,
	Pressable,
	type PressableProps,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { interaction } from "./interaction";
import { useTooltip } from "./Tooltip";
import { colors, radii, space, typography, webTransition } from "./theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ButtonVariant = "primary" | "secondary" | "danger";
// Small is for bars across the top of a screen, which it fits.
type ButtonSize = "large" | "medium" | "small";

type ButtonProps = Omit<PressableProps, "style" | "children"> & {
	label: string;
	icon?: IconName;
	iconPosition?: "start" | "end";
	variant?: ButtonVariant;
	size?: ButtonSize;
	// Swaps the icon for a spinner and ignores presses while keeping full contrast.
	busy?: boolean;
	// On web, a hover shows the label with this key (see `useTooltip`).
	shortcut?: string;
};

export function Button({
	label,
	icon,
	iconPosition = "start",
	variant = "secondary",
	size = "medium",
	busy = false,
	disabled = false,
	shortcut,
	...props
}: ButtonProps) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const inactive = Boolean(disabled) || busy;
	const labelColor =
		variant === "primary" || variant === "danger"
			? colors.onPrimary
			: colors.textPrimary;
	const tone = TONES[variant];

	const iconElement = busy ? (
		<ActivityIndicator size="small" color={labelColor} />
	) : (
		icon && (
			<View style={styles.icon}>
				<Ionicons
					name={icon}
					size={size === "large" ? 20 : 18}
					color={labelColor}
				/>
			</View>
		)
	);

	const labelElement = (
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
	);

	return (
		<>
			<Pressable
				hitSlop={size === "small" ? 10 : 4}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ disabled: inactive, busy: busy || undefined }}
				{...(shortcut ? anchor : {})}
				{...props}
				disabled={inactive}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.base,
						styles[size],
						tone.rest,
						webTransition,
						!inactive && hovered && tone.hovered,
						!inactive && pressed && [tone.pressed, styles.pressed],
						disabled && !busy && styles.disabled,
					];
				}}
			>
				{iconPosition === "start" && iconElement}
				{labelElement}
				{iconPosition === "end" && iconElement}
			</Pressable>
			{tooltip}
		</>
	);
}

const TONES = {
	primary: StyleSheet.create({
		rest: { backgroundColor: colors.primary },
		hovered: { backgroundColor: colors.primaryHover },
		pressed: { backgroundColor: colors.primaryPressed },
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
