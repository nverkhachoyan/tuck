import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	FadeIn,
	FadeOut,
	ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, floatingShadow, radii, webTransition } from "@/theme";
import { GlassView } from "@/ui/GlassView";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";

// Every panel shares one fixed height, so the canvas, fitted above the dock,
// never moves when the selection changes.
const DOCK_HEIGHT = 104;
// Wide enough for the text panel's tabs and actions side by side.
const DOCK_MAX_WIDTH = 520;
// From the canvas's sides, and from its bottom where nothing's in the way.
const DOCK_MARGIN = 10;
// Between the dock and the keyboard, while it's up.
const KEYBOARD_GAP = 8;
const BUTTON_SIZE = 52;
const BUTTON_GAP = 8;
const PANEL_IN = FadeIn.duration(220).easing(Easing.bezier(0.2, 0, 0, 1));
const PANEL_OUT = FadeOut.duration(120);
const BUTTON_IN = ZoomIn.duration(220).easing(Easing.bezier(0.2, 0, 0, 1));

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
 * The frosted dock floating over the bottom of the canvas, holding the panel
 * for the selection or tool. Changing `panel` cross-fades to the new one;
 * the same panel for another layer stays put. `start` and `end` hold
 * `DockButton`s beside it: a tool's Done, and Crop's Cancel, within reach
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

	return (
		<View
			style={[styles.area, { bottom: dockBottom(bottom, keyboardOverlap) }]}
		>
			{start && <Animated.View entering={BUTTON_IN}>{start}</Animated.View>}
			<GlassView style={styles.dock}>
				<Animated.View
					key={panel}
					entering={PANEL_IN}
					exiting={PANEL_OUT}
					style={[StyleSheet.absoluteFill, styles.content]}
				>
					{children}
				</Animated.View>
			</GlassView>
			{end && <Animated.View entering={BUTTON_IN}>{end}</Animated.View>}
		</View>
	);
}

type DockIconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A round button beside the dock. `primary` fills it with the accent, for
 * the action that finishes a tool; otherwise it's glass, like the dock.
 */
export function DockButton({
	icon,
	label,
	shortcut,
	primary = false,
	onPress,
}: {
	icon: DockIconName;
	label: string;
	shortcut?: string;
	primary?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const glyph = (
		<Ionicons
			name={icon}
			size={26}
			color={primary ? colors.onAccent : colors.textPrimary}
		/>
	);
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={8}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
			>
				{(state) => {
					const { pressed, hovered } = interaction(state);
					return primary ? (
						<View
							style={[
								styles.circle,
								styles.face,
								styles.primary,
								webTransition,
								hovered && styles.primaryHovered,
								pressed && styles.primaryPressed,
							]}
						>
							{glyph}
						</View>
					) : (
						<GlassView
							style={[styles.circle, pressed && styles.pressed]}
							contentStyle={[
								styles.face,
								webTransition,
								hovered && styles.hovered,
								pressed && styles.pressedFace,
							]}
						>
							{glyph}
						</GlassView>
					);
				}}
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	area: {
		position: "absolute",
		left: DOCK_MARGIN,
		right: DOCK_MARGIN,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: BUTTON_GAP,
		pointerEvents: "box-none",
	},
	// Takes what the buttons leave, up to its widest.
	dock: {
		flex: 1,
		maxWidth: DOCK_MAX_WIDTH,
		height: DOCK_HEIGHT,
		borderRadius: radii.panel,
	},
	content: {
		flexDirection: "row",
	},
	circle: {
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		borderRadius: BUTTON_SIZE / 2,
	},
	face: {
		alignItems: "center",
		justifyContent: "center",
	},
	hovered: {
		backgroundColor: colors.glassControlHover,
	},
	pressed: {
		transform: [{ scale: 0.92 }],
	},
	pressedFace: {
		backgroundColor: colors.pressedOverlay,
	},
	primary: {
		backgroundColor: colors.accent,
		boxShadow: floatingShadow,
	},
	primaryHovered: {
		backgroundColor: colors.accentHover,
	},
	primaryPressed: {
		backgroundColor: colors.accentPressed,
		transform: [{ scale: 0.92 }],
	},
});
