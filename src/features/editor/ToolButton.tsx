import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps, ReactNode } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { colors, radii, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";

// Tools use MaterialCommunityIcons (photo-editor glyphs like format-text, crop,
// blur); small inline actions use Ionicons via IconButton.
type ToolIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * An editing tool in the bottom toolbar: an icon tile with a label under it.
 * `busy` swaps the icon for a spinner while the tool's work runs, and blocks
 * a second press meanwhile. With a `shortcut`, web shows it on hover.
 * `selected` marks the tool in use, and `glyph`, when given, is drawn in
 * place of the icon (which still names the tool to the type checker).
 */
export function ToolButton({
	label,
	icon,
	glyph,
	shortcut,
	tone = "default",
	disabled = false,
	selected,
	busy = false,
	onPress,
}: {
	label: string;
	icon: ToolIconName;
	glyph?: ReactNode;
	shortcut?: string;
	tone?: "default" | "danger";
	disabled?: boolean;
	selected?: boolean;
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
				accessibilityState={{ disabled: inactive, busy, selected }}
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
									// Over the hover's colors, keeping its lift.
									selected && styles.tileSelected,
									!inactive && pressed && styles.tilePressed,
								]}
							>
								{busy ? (
									<ActivityIndicator color={colors.textPrimary} />
								) : (
									(glyph ?? (
										<MaterialCommunityIcons
											name={icon}
											size={26}
											color={
												danger
													? colors.danger
													: selected
														? colors.accent
														: colors.textPrimary
											}
										/>
									))
								)}
							</View>
							<Text
								style={[styles.label, (lit || selected) && styles.labelLit]}
							>
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
	tileSelected: {
		borderColor: colors.accentBorder,
		backgroundColor: colors.accentSoft,
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
