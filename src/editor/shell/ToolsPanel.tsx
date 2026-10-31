import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type RefObject, useRef, useState } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewInstance,
} from "react-native";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";
import { ToolButton, ToolGrid, ToolRow } from "./ToolButton";
import type { ToolEntry } from "./toolList";

/**
 * The editing tools' buttons in the dock or rail:
 * - Two rows on a phone (ToolGrid), or a vertical column for wide rail.
 * - Shows subtool flyouts on right-click, long-press, or tap-when-active.
 * - Marks the active tool and spins for busy actions.
 */
export function ToolsPanel({
	tools: entries,
	vertical = false,
	tool,
	busy,
	hasImage,
	startTool,
	anchors,
}: {
	tools: readonly ToolEntry[];
	vertical?: boolean;
	tool?: string | null;
	busy: readonly string[];
	hasImage: boolean;
	startTool: ToolStarters;
	anchors?: Readonly<Record<string, RefObject<ViewInstance | null>>>;
}) {
	const compact = !vertical;
	const [flyoutOpenId, setFlyoutOpenId] = useState<string | null>(null);
	const localRefs = useRef<Record<string, RefObject<ViewInstance | null>>>({});

	const getRef = (id: string): RefObject<ViewInstance | null> => {
		if (anchors?.[id]) return anchors[id];
		if (!localRefs.current[id]) {
			localRefs.current[id] = { current: null };
		}
		return localRefs.current[id];
	};

	const tools = entries
		.filter((entry) => !entry.needsImage || hasImage)
		.map((entry) => {
			const open = entry.id === tool;
			const hasFlyout = Boolean(entry.variants && entry.variants.length > 0);
			return (
				<ToolButton
					key={entry.id}
					label={entry.label}
					icon={entry.icon}
					shortcut={entry.key}
					compact={compact}
					selected={vertical ? undefined : open}
					marked={vertical ? open : undefined}
					busy={busy.includes(entry.id)}
					buttonRef={getRef(entry.id)}
					hasFlyout={hasFlyout}
					onFlyout={hasFlyout ? () => setFlyoutOpenId(entry.id) : undefined}
					onPress={startTool[entry.id]}
				/>
			);
		});

	const activeFlyoutEntry = entries.find((e) => e.id === flyoutOpenId);

	return (
		<>
			{vertical ? (
				<ToolRow vertical>{tools}</ToolRow>
			) : (
				<ToolGrid>{tools}</ToolGrid>
			)}
			{activeFlyoutEntry?.variants && (
				<Popover
					anchor={getRef(activeFlyoutEntry.id)}
					open={true}
					onClose={() => setFlyoutOpenId(null)}
					label={`${activeFlyoutEntry.label} options`}
					placement={vertical ? "beside" : "above"}
				>
					<View style={styles.flyoutList}>
						{activeFlyoutEntry.variants.map((variant) => {
							const isSelected = variant.id === activeFlyoutEntry.activeVariant;
							return (
								<Pressable
									key={variant.id}
									style={(state) => {
										const { hovered, pressed } = interaction(state);
										return [
											styles.flyoutItem,
											webTransition,
											hovered && styles.flyoutItemHovered,
											pressed && styles.flyoutItemPressed,
										];
									}}
									onPress={() => {
										setFlyoutOpenId(null);
										activeFlyoutEntry.onSelectVariant?.(variant.id);
									}}
									accessibilityRole="menuitem"
									accessibilityState={{ selected: isSelected }}
								>
									{isSelected && <Highlight style={styles.flyoutHighlight} />}
									<MaterialCommunityIcons
										name={variant.icon}
										size={18}
										color={isSelected ? colors.onHighlight : colors.textPrimary}
									/>
									<Text
										style={[
											styles.flyoutLabel,
											isSelected && styles.flyoutLabelSelected,
										]}
									>
										{variant.label}
									</Text>
									{variant.shortcut && (
										<Text
											style={[
												styles.flyoutShortcut,
												isSelected && styles.flyoutShortcutSelected,
											]}
										>
											{variant.shortcut}
										</Text>
									)}
								</Pressable>
							);
						})}
					</View>
				</Popover>
			)}
		</>
	);
}

/** What picking up each tool or entry does, as its key would, by its id. */
export type ToolStarters = Record<string, () => void>;

/** Each starter passed through `wrap`, as the rail does with `fromRail`. */
export function mapStarters(
	starters: ToolStarters,
	wrap: (start: () => void) => () => void,
): ToolStarters {
	return Object.fromEntries(
		Object.entries(starters).map(([id, start]) => [id, wrap(start)]),
	);
}

const styles = StyleSheet.create({
	flyoutList: {
		paddingVertical: 4,
		minWidth: 140,
	},
	flyoutItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: space.sm,
		paddingVertical: 8,
		gap: space.xs,
		position: "relative",
	},
	flyoutItemHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	flyoutItemPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	flyoutHighlight: {
		borderRadius: radii.small,
	},
	flyoutLabel: {
		...typography.body,
		fontSize: 13,
		color: colors.textPrimary,
		flex: 1,
	},
	flyoutLabelSelected: {
		color: colors.onHighlight,
		fontWeight: "600",
	},
	flyoutShortcut: {
		...typography.caption,
		fontSize: 11,
		color: colors.textTertiary,
		marginLeft: space.sm,
	},
	flyoutShortcutSelected: {
		color: colors.onHighlight,
		opacity: 0.8,
	},
});
