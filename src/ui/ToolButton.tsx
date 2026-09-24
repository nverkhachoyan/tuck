import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { colors, radii, webTransition } from "@/theme";
import { interaction } from "./interaction";
import { useTooltip } from "./Tooltip";

// Tools use MaterialCommunityIcons (photo-editor glyphs like format-text, crop,
// blur); small inline actions use Ionicons via IconButton.
type ToolIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * An editing tool in the bottom toolbar: an icon tile with a label under it.
 * `busy` swaps the icon for a spinner while the tool's work runs, and blocks
 * a second press meanwhile. With a `shortcut`, web shows it on hover.
 */
export function ToolButton({
	label,
	icon,
	shortcut,
	tone = "default",
	disabled = false,
	busy = false,
	onPress,
}: {
	label: string;
	icon: ToolIconName;
	shortcut?: string;
	tone?: "default" | "danger";
	disabled?: boolean;
	busy?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const inactive = disabled || busy;
	const danger = tone === "danger";
	return (
		<>
			<Pressable
				{...(shortcut ? anchor : undefined)}
				hitSlop={8}
				disabled={inactive}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ disabled: inactive, busy }}
				style={[styles.container, disabled && styles.disabled]}
			>
				{(state) => {
					const { pressed, hovered } = interaction(state);
					const lit = !inactive && (hovered || pressed);
					return (
						<>
							<View
								style={[
									styles.tile,
									webTransition,
									lit && (danger ? styles.tileDanger : styles.tileHovered),
									!inactive && pressed && styles.tilePressed,
								]}
							>
								{busy ? (
									<ActivityIndicator color={colors.textPrimary} />
								) : (
									<MaterialCommunityIcons
										name={icon}
										size={26}
										color={danger ? colors.danger : colors.textPrimary}
									/>
								)}
							</View>
							<Text style={[styles.label, lit && styles.labelLit]}>
								{label}
							</Text>
						</>
					);
				}}
			</Pressable>
			{shortcut && tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: "center",
		gap: 7,
	},
	disabled: {
		opacity: 0.4,
	},
	tile: {
		width: 54,
		height: 54,
		borderRadius: radii.large,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	tileHovered: {
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceHover,
		transform: [{ translateY: -2 }],
	},
	tileDanger: {
		borderColor: colors.dangerSoft,
		backgroundColor: colors.dangerSoft,
		transform: [{ translateY: -2 }],
	},
	tilePressed: {
		backgroundColor: colors.surfacePressed,
		transform: [{ scale: 0.94 }],
	},
	label: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	labelLit: {
		color: colors.textPrimary,
	},
});
