import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Surface } from "@/ui/Surface";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, typography, webTransition } from "@/ui/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Where Arrange moves a layer in the stack. */
export type ArrangeMove = "front" | "forward" | "backward" | "back";

/**
 * The actions every selected layer shares, in a small bar the canvas floats
 * by it (see `EditorCanvas`): Edit for text, Free resize for text and images,
 * Arrange, Duplicate, and Delete. Arrange shows its moves in the bar's
 * place, until Back. What only one kind of layer does stays in the dock.
 */
export function SelectionBar({
	canMoveForward,
	canMoveBackward,
	onEdit,
	stretched,
	onToggleStretch,
	onArrange,
	onDuplicate,
	onDelete,
}: {
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onEdit?: () => void;
	stretched?: boolean;
	onToggleStretch?: () => void;
	onArrange: (move: ArrangeMove) => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	const [arranging, setArranging] = useState(false);
	return (
		<Surface style={styles.bar} contentStyle={styles.content}>
			{arranging ? (
				<>
					<BarButton
						icon="chevron-left"
						label="Back"
						onPress={() => setArranging(false)}
					/>
					<View style={styles.divider} />
					<BarButton
						icon="arrange-bring-to-front"
						label="To front"
						disabled={!canMoveForward}
						onPress={() => onArrange("front")}
					/>
					<BarButton
						icon="arrange-bring-forward"
						label="Forward"
						shortcut="mod+]"
						disabled={!canMoveForward}
						onPress={() => onArrange("forward")}
					/>
					<BarButton
						icon="arrange-send-backward"
						label="Backward"
						shortcut="mod+["
						disabled={!canMoveBackward}
						onPress={() => onArrange("backward")}
					/>
					<BarButton
						icon="arrange-send-to-back"
						label="To back"
						disabled={!canMoveBackward}
						onPress={() => onArrange("back")}
					/>
				</>
			) : (
				<>
					{onEdit && (
						<BarButton icon="cursor-text" label="Edit" onPress={onEdit} />
					)}
					{onToggleStretch && (
						<BarButton
							icon="arrow-expand-horizontal"
							label="Free resize"
							selected={stretched}
							onPress={onToggleStretch}
						/>
					)}
					<BarButton
						icon="arrange-bring-forward"
						label="Arrange"
						disabled={!canMoveForward && !canMoveBackward}
						onPress={() => setArranging(true)}
					/>
					<BarButton
						icon="content-copy"
						label="Duplicate"
						shortcut="mod+D"
						onPress={onDuplicate}
					/>
					<BarButton
						icon="trash-can-outline"
						label="Delete"
						shortcut="Delete"
						danger
						onPress={onDelete}
					/>
				</>
			)}
		</Surface>
	);
}

/** An icon over its label; `selected` highlights a toggle that's on. */
function BarButton({
	icon,
	label,
	shortcut,
	selected,
	danger = false,
	disabled = false,
	onPress,
}: {
	icon: IconName;
	label: string;
	shortcut?: string;
	selected?: boolean;
	danger?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const color = danger
		? colors.danger
		: selected
			? colors.onHighlight
			: colors.textPrimary;
	return (
		<>
			<Pressable
				{...(shortcut ? anchor : undefined)}
				hitSlop={4}
				disabled={disabled}
				onPress={onPress}
				accessibilityRole={selected === undefined ? "button" : "switch"}
				accessibilityLabel={label}
				accessibilityState={
					selected === undefined
						? { disabled }
						: { disabled, checked: selected }
				}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.button,
						webTransition,
						!disabled && hovered && styles.hovered,
						!disabled && pressed && styles.pressed,
						disabled && styles.disabled,
					];
				}}
			>
				{selected && <Highlight />}
				<MaterialCommunityIcons name={icon} size={20} color={color} />
				<Text style={[styles.label, { color }]} numberOfLines={1}>
					{label}
				</Text>
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	bar: {
		borderRadius: radii.medium,
	},
	content: {
		flexDirection: "row",
		alignItems: "center",
		padding: 4,
		gap: 2,
	},
	button: {
		minWidth: 52,
		height: 48,
		paddingHorizontal: 6,
		borderRadius: radii.small,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.94 }],
	},
	disabled: {
		opacity: 0.35,
	},
	label: {
		...typography.caption,
	},
	divider: {
		width: StyleSheet.hairlineWidth,
		alignSelf: "stretch",
		marginVertical: 10,
		backgroundColor: colors.borderStrong,
	},
});
