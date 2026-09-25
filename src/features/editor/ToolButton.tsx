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
 * An editing tool in the bottom panel: an icon tile with a label under it.
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
											size={24}
											color={danger ? colors.danger : colors.textPrimary}
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
		minWidth: 56,
		alignItems: "center",
		gap: 6,
	},
	disabled: {
		opacity: 0.35,
	},
	tile: {
		width: 48,
		height: 48,
		borderRadius: radii.large,
		borderCurve: "continuous",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.glassControl,
	},
	tileSelected: {
		backgroundColor: colors.chosenSoft,
		boxShadow: `inset 0 0 0 1px ${colors.chosenSoft}`,
	},
	tileHovered: {
		backgroundColor: colors.glassControlHover,
		transform: [{ translateY: -1 }],
	},
	tileDanger: {
		backgroundColor: colors.dangerSoft,
		transform: [{ translateY: -1 }],
	},
	tilePressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	label: {
		fontSize: 11,
		fontWeight: "500",
		letterSpacing: 0.1,
		color: colors.textSecondary,
	},
	labelLit: {
		color: colors.textPrimary,
	},
});
