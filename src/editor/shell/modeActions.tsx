import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/ui/Button";
import { compactControls } from "@/ui/density";
import { interaction } from "@/ui/interaction";
import { TextButton } from "@/ui/TextButton";
import { useTooltip } from "@/ui/Tooltip";
import { colors, space, webTransition } from "@/ui/theme";

const BUTTON_SIZE = compactControls ? 36 : 44;
const BUTTON_ICON_SIZE = compactControls ? 24 : 28;
const BAR_BUTTON_SIZE = compactControls ? 32 : 36;
const BAR_ICON_SIZE = 20;

export type ModeActionProps = {
	onReset?: () => void;
	onCancel?: () => void;
	cancelShortcut?: string;
	onDone?: () => void;
	// What Done does, for its tooltip and screen readers, when it's more.
	doneLabel?: string;
	doneShortcut?: string;
	doneVariant?: "primary" | "secondary";
};

/**
 * Cancel, when the mode has one, and Done. The dock's footer puts them at
 * its ends; the wide editor's context bar groups them. The labels, shortcuts,
 * and which of the two show live here, so the two layouts can't disagree.
 */
export function ModeActions(props: ModeActionProps) {
	const { cancel, done } = modeActionButtons(props, "bar");
	return (
		<View style={styles.modeActions}>
			{props.onReset && <TextButton label="Reset" onPress={props.onReset} />}
			{cancel}
			{done}
		</View>
	);
}

export function modeActionButtons(
	{
		onCancel,
		cancelShortcut,
		onDone,
		doneLabel = "Done",
		doneShortcut,
		doneVariant,
	}: ModeActionProps,
	place: "dock" | "bar",
) {
	const isDoneWord = !doneLabel || doneLabel === "Done";
	return {
		cancel: onCancel ? (
			<DockButton
				icon="close-outline"
				label="Cancel"
				shortcut={cancelShortcut}
				place={place}
				onPress={onCancel}
			/>
		) : null,
		done: onDone ? (
			doneVariant === "primary" ? (
				<Button
					size="small"
					variant="primary"
					label={doneLabel}
					icon="checkmark-outline"
					iconPosition="end"
					shortcut={doneShortcut}
					onPress={onDone}
				/>
			) : isDoneWord ? (
				<DockButton
					icon="checkmark-outline"
					label={doneLabel}
					shortcut={doneShortcut}
					place={place}
					onPress={onDone}
				/>
			) : (
				<TextButton
					label={doneLabel}
					shortcut={doneShortcut}
					onPress={onDone}
				/>
			)
		) : null,
	};
}

type DockIconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A glyph at one end of the footer or in the header's context bar, with no
 * fill: the ends are where a mode's Done and Cancel always are, so their
 * place names them.
 */
function DockButton({
	icon,
	label,
	shortcut,
	place,
	onPress,
}: {
	icon: DockIconName;
	label: string;
	shortcut?: string;
	place: "dock" | "bar";
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const inBar = place === "bar";
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={inBar ? 6 : 8}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						inBar ? styles.barButton : styles.button,
						webTransition,
						hovered && styles.hovered,
						pressed && styles.pressed,
					];
				}}
			>
				<Ionicons
					name={icon}
					size={inBar ? BAR_ICON_SIZE : BUTTON_ICON_SIZE}
					color={colors.textPrimary}
				/>
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	modeActions: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 0,
		gap: 6,
		marginLeft: space.xs,
	},
	button: {
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		borderRadius: BUTTON_SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	barButton: {
		width: BAR_BUTTON_SIZE,
		height: BAR_BUTTON_SIZE,
		borderRadius: BAR_BUTTON_SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
});
