import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Surface } from "@/ui/Surface";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";
import type { ArrangeMove } from "../layers/layerEdits";
import {
	BarChip,
	BarGroup,
	BarButton as HeaderButton,
} from "../shell/ContextBar";

export type { ArrangeMove };

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** What the selection bar offers, in either place it shows. */
export type SelectionActions = {
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onEdit?: () => void;
	stretched?: boolean;
	onToggleStretch?: () => void;
	onSeparate?: () => void;
	onArrange: (move: ArrangeMove) => void;
	onDuplicate: () => void;
	onDelete: () => void;
};

// Arrange's moves, in the order both bars list them. `forward` moves need
// a layer above.
const ARRANGE_MOVES: readonly {
	move: ArrangeMove;
	label: string;
	icon: IconName;
	shortcut?: string;
	forward: boolean;
}[] = [
	{
		move: "front",
		label: "To front",
		icon: "arrange-bring-to-front",
		forward: true,
	},
	{
		move: "forward",
		label: "Forward",
		icon: "arrange-bring-forward",
		shortcut: "mod+]",
		forward: true,
	},
	{
		move: "backward",
		label: "Backward",
		icon: "arrange-send-backward",
		shortcut: "mod+[",
		forward: false,
	},
	{
		move: "back",
		label: "To back",
		icon: "arrange-send-to-back",
		forward: false,
	},
];

/**
 * The actions every selected layer shares, in a small bar the canvas floats
 * by it on a phone (see `EditorCanvas`): Edit for text, Free resize for text
 * and images, Separate for a drawing in pieces, Arrange, Duplicate, and
 * Delete. Arrange shows its moves in the bar's place, until Back. What only
 * one kind of layer does stays in the dock. A wide window shows them in the
 * header instead (`SelectionBarItems`).
 */
export function SelectionBar({
	canMoveForward,
	canMoveBackward,
	onEdit,
	stretched,
	onToggleStretch,
	onSeparate,
	onArrange,
	onDuplicate,
	onDelete,
}: SelectionActions) {
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
					{ARRANGE_MOVES.map(({ move, label, icon, shortcut, forward }) => (
						<BarButton
							key={move}
							icon={icon}
							label={label}
							shortcut={shortcut}
							disabled={forward ? !canMoveForward : !canMoveBackward}
							onPress={() => onArrange(move)}
						/>
					))}
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
					{onSeparate && (
						<BarButton
							icon="call-split"
							label="Separate"
							onPress={onSeparate}
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

/**
 * The same actions as one group of the wide header's context bar, after the
 * selected layer's style or tools, so nothing floats over the photo.
 * Duplicate and Delete are icons, so the group fits beside text's options at
 * 1440 points. Arrange opens its moves in a popover, left open so a layer
 * can step several places.
 */
export function SelectionBarItems({
	canMoveForward,
	canMoveBackward,
	onEdit,
	stretched,
	onToggleStretch,
	onSeparate,
	onArrange,
	onDuplicate,
	onDelete,
}: SelectionActions) {
	return (
		<BarGroup>
			{onEdit && (
				<HeaderButton icon="cursor-text" label="Edit" onPress={onEdit} />
			)}
			{onToggleStretch && (
				<HeaderButton
					icon="arrow-expand-horizontal"
					label="Free resize"
					checked={stretched === true}
					onPress={onToggleStretch}
				/>
			)}
			{onSeparate && (
				<HeaderButton icon="call-split" label="Separate" onPress={onSeparate} />
			)}
			{canMoveForward || canMoveBackward ? (
				<BarChip label="Arrange" icon="arrange-bring-forward" text="Arrange">
					<View style={styles.moves}>
						{ARRANGE_MOVES.map(({ move, label, icon, shortcut, forward }) => (
							<HeaderButton
								key={move}
								icon={icon}
								label={label}
								shortcut={shortcut}
								disabled={forward ? !canMoveForward : !canMoveBackward}
								onPress={() => onArrange(move)}
							/>
						))}
					</View>
				</BarChip>
			) : (
				<HeaderButton
					icon="arrange-bring-forward"
					label="Arrange"
					disabled
					onPress={() => {}}
				/>
			)}
			<HeaderButton
				icon="content-copy"
				label="Duplicate"
				shortcut="mod+D"
				iconOnly
				onPress={onDuplicate}
			/>
			<HeaderButton
				icon="trash-can-outline"
				label="Delete"
				shortcut="Delete"
				iconOnly
				onPress={onDelete}
			/>
		</BarGroup>
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
				aria-checked={selected}
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
	moves: {
		flexDirection: "row",
		gap: 2,
		padding: space.xs,
	},
	divider: {
		width: StyleSheet.hairlineWidth,
		alignSelf: "stretch",
		marginVertical: 10,
		backgroundColor: colors.borderStrong,
	},
});
