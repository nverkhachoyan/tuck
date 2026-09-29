import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Children, type ComponentProps, type ReactNode, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import {
	chosenOutline,
	colors,
	radii,
	typography,
	webTransition,
} from "@/theme";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";

// A tool's narrowest width, and the space a row of them leaves between them
// and at its ends while they fit.
const TOOL_WIDTH = 56;
const ROW_GAP = 12;

// Tools use MaterialCommunityIcons (photo-editor glyphs like format-text, crop,
// blur); small inline actions use Ionicons via IconButton.
type ToolIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * An editing tool in the dock: an icon with a label under it, and no tile
 * around it until it's hovered, pressed, or the tool in use, which a thin
 * outline marks.
 * `busy` swaps the icon for a spinner while the tool's work runs, and blocks
 * a second press meanwhile. With a `shortcut`, web shows it on hover.
 * `selected` marks the tool in use, and `open` a button whose tray is open,
 * by its label alone, so only the tool in use is outlined. `glyph`, when
 * given, is drawn in place of the icon (which still names the tool to the
 * type checker).
 */
export function ToolButton({
	label,
	icon,
	glyph,
	shortcut,
	tone = "default",
	disabled = false,
	selected,
	open = false,
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
	open?: boolean;
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
				accessibilityState={{
					disabled: inactive,
					busy,
					selected,
					expanded: open,
				}}
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
								style={[
									styles.label,
									(lit || selected || open) && styles.labelLit,
									open && styles.labelOpen,
								]}
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

/**
 * A dock panel's row of `ToolButton`s, centered while they fit. On a narrow
 * screen the space between them shrinks to fit them all, and only once
 * there's none left does the row scroll sideways.
 */
export function ToolRow({ children }: { children: ReactNode }) {
	const [width, setWidth] = useState(0);
	const count = Children.toArray(children).length;
	// Gaps between the tools, and one at each end. Until the row is measured,
	// it's laid out as though they fit.
	const spacing = ROW_GAP * (count + 1);
	const fit =
		width > 0
			? Math.min(1, Math.max(0, (width - count * TOOL_WIDTH) / spacing))
			: 1;
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={styles.rowScroll}
			contentContainerStyle={[
				styles.row,
				{ gap: ROW_GAP * fit, paddingHorizontal: ROW_GAP * fit },
			]}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{children}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	rowScroll: {
		flex: 1,
	},
	// Grows to fill the panel rather than flexing, which would hold it to the
	// panel's width, so it never scrolls.
	row: {
		flexGrow: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	container: {
		minWidth: TOOL_WIDTH,
		alignItems: "center",
		gap: 6,
	},
	disabled: {
		opacity: 0.35,
	},
	tile: {
		width: 48,
		height: 48,
		borderRadius: radii.small,
		borderCurve: "continuous",
		alignItems: "center",
		justifyContent: "center",
	},
	tileSelected: chosenOutline,
	tileHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	tileDanger: {
		backgroundColor: colors.dangerSoft,
	},
	tilePressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	label: {
		...typography.caption,
		letterSpacing: 0.1,
		color: colors.textSecondary,
	},
	labelLit: {
		color: colors.textPrimary,
	},
	labelOpen: {
		fontWeight: "700",
	},
});
