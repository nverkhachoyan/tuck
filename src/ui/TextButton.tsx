import { Pressable, StyleSheet, Text } from "react-native";
import { colors, webTransition } from "@/theme";
import { interaction } from "./interaction";
import { useTooltip } from "./Tooltip";

type TextButtonTone = "default" | "accent" | "danger";

// The highlight's reach past the label on each side, taken back by a
// negative margin, so the button lays out at the label's own size.
const PAD_X = 10;
const PAD_Y = 6;

/**
 * A borderless, label-only button for headers and inline panel actions. On
 * web, with `shortcut`, a hover shows the label with that key (see
 * `useTooltip`).
 */
export function TextButton({
	label,
	tone = "default",
	shortcut,
	onPress,
}: {
	label: string;
	tone?: TextButtonTone;
	shortcut?: string;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	return (
		<>
			<Pressable
				{...(shortcut ? anchor : {})}
				hitSlop={4}
				onPress={onPress}
				accessibilityRole="button"
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.target,
						webTransition,
						hovered && styles.hovered,
						pressed && styles.pressed,
					];
				}}
			>
				<Text style={[styles.label, tone !== "default" && styles[tone]]}>
					{label}
				</Text>
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	target: {
		paddingHorizontal: PAD_X,
		paddingVertical: PAD_Y,
		marginHorizontal: -PAD_X,
		marginVertical: -PAD_Y,
		borderRadius: 10,
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
	},
	label: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	accent: {
		color: colors.accent,
		fontWeight: "600",
	},
	danger: {
		color: colors.danger,
		fontWeight: "600",
	},
});
