import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";

// Every panel shares one fixed height, so the canvas, fitted above the dock,
// never moves when the selection changes.
const DOCK_HEIGHT = 104;
// Wide enough for the text panel's tabs and actions side by side.
const DOCK_MAX_WIDTH = 520;
// Under the dock's content where nothing's in the way.
const DOCK_MARGIN = 10;
// Between the dock and the keyboard, while it's up.
const KEYBOARD_GAP = 8;
const BUTTON_SIZE = 48;
const PANEL_IN = FadeIn.duration(220).easing(Easing.bezier(0.2, 0, 0, 1));
const PANEL_OUT = FadeOut.duration(120);
const BUTTON_IN = FadeIn.duration(160);

/**
 * How far up from the canvas's bottom edge the dock reaches, space under it
 * included. The canvas fits the document above this, and anything placed
 * along the canvas's bottom sits over it. `keyboardOverlap` is how much of
 * the canvas the keyboard covers (see `useKeyboardOverlap`), which the dock
 * rises above.
 */
export function useDockInset(keyboardOverlap = 0): number {
	const { bottom } = useSafeAreaInsets();
	return dockBottom(bottom, keyboardOverlap) + DOCK_HEIGHT;
}

// Over the home indicator's area, though clear of the indicator itself.
function dockBottom(safeAreaBottom: number, keyboardOverlap: number) {
	if (keyboardOverlap > 0) return keyboardOverlap + KEYBOARD_GAP;
	return Math.max(DOCK_MARGIN, safeAreaBottom - 8);
}

/**
 * The bar across the bottom of the canvas, holding the panel for the
 * selection or tool. It's the screen's own color, so the photo is the only
 * thing that stands out. Changing `panel` cross-fades to the new one; the
 * same panel for another layer stays put. `start` and `end` hold
 * `DockButton`s at its ends: a tool's Done, and Crop's Cancel, within reach
 * of the thumb that's using the tool. It rises above the keyboard by
 * `keyboardOverlap`, taking them along.
 */
export function Dock({
	panel,
	start,
	end,
	keyboardOverlap = 0,
	children,
}: {
	panel: string;
	start?: ReactNode;
	end?: ReactNode;
	keyboardOverlap?: number;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();
	// Both ends, even with one button, keep the panel centered.
	const ends = start !== undefined || end !== undefined;

	return (
		<View
			style={[
				styles.bar,
				keyboardOverlap > 0 && { bottom: keyboardOverlap },
				{
					paddingBottom: dockBottom(bottom, keyboardOverlap) - keyboardOverlap,
				},
			]}
		>
			<View style={styles.row}>
				{ends && (
					<View style={styles.end}>
						{start && (
							<Animated.View entering={BUTTON_IN}>{start}</Animated.View>
						)}
					</View>
				)}
				<View style={styles.dock}>
					<Animated.View
						key={panel}
						entering={PANEL_IN}
						exiting={PANEL_OUT}
						style={[StyleSheet.absoluteFill, styles.content]}
					>
						{children}
					</Animated.View>
				</View>
				{ends && (
					<View style={styles.end}>
						{end && <Animated.View entering={BUTTON_IN}>{end}</Animated.View>}
					</View>
				)}
			</View>
		</View>
	);
}

type DockIconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A glyph at one end of the dock, with no fill: the dock's ends are where a
 * tool's Done and Cancel always are, so their place names them.
 */
export function DockButton({
	icon,
	label,
	shortcut,
	onPress,
}: {
	icon: DockIconName;
	label: string;
	shortcut?: string;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={8}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.button,
						webTransition,
						hovered && styles.hovered,
						pressed && styles.pressed,
					];
				}}
			>
				<Ionicons name={icon} size={30} color={colors.textPrimary} />
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	// Down to the screen's edge, under the home indicator, so nothing shows
	// beneath it.
	bar: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: colors.background,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		height: DOCK_HEIGHT,
	},
	// Holds its button, or keeps the panel centered without one.
	end: {
		width: BUTTON_SIZE + 12,
		alignItems: "center",
	},
	// Takes what the ends leave, up to its widest.
	dock: {
		flex: 1,
		maxWidth: DOCK_MAX_WIDTH,
		height: DOCK_HEIGHT,
	},
	content: {
		flexDirection: "row",
	},
	button: {
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		borderRadius: BUTTON_SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
});
