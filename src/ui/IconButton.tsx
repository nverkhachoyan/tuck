import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";
import { chosenOutline, colors, webTransition } from "@/theme";
import { interaction } from "./interaction";
import { useTooltip } from "./Tooltip";

type IconName = ComponentProps<typeof Ionicons>["name"];
type IconButtonTone = "default" | "danger";

const ICON_SIZE = 22;
// The round highlight drawn behind the icon on hover and press.
const HALO = 36;
const HALO_INSET = (HALO - ICON_SIZE) / 2;

/**
 * A borderless icon-only button. `label` is required because it's the only
 * name a screen reader gets, and on web it's the tooltip, with `shortcut`
 * (see `useTooltip`). `selected` shows a toggle that's on.
 *
 * Its halo overhangs by a negative margin, so the button lays out at the
 * icon's own size wherever it's placed.
 */
export function IconButton({
	icon,
	label,
	shortcut,
	tone = "default",
	disabled = false,
	selected = false,
	onPress,
}: {
	icon: IconName;
	label: string;
	shortcut?: string;
	tone?: IconButtonTone;
	disabled?: boolean;
	selected?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const color = disabled
		? colors.textTertiary
		: tone === "danger"
			? colors.danger
			: colors.textPrimary;
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={4}
				disabled={disabled}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ disabled, selected }}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.halo,
						webTransition,
						selected && styles.selected,
						hovered &&
							!disabled &&
							(tone === "danger" ? styles.dangerHovered : styles.hovered),
						pressed && styles.pressed,
					];
				}}
			>
				<Ionicons name={icon} size={ICON_SIZE} color={color} />
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	halo: {
		width: HALO,
		height: HALO,
		margin: -HALO_INSET,
		borderRadius: HALO / 2,
		alignItems: "center",
		justifyContent: "center",
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	dangerHovered: {
		backgroundColor: colors.dangerSoft,
	},
	selected: chosenOutline,
	pressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
});
