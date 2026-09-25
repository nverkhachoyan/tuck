import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, webTransition } from "@/theme";
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
const PANEL_IN = FadeIn.duration(220).easing(Easing.bezier(0.2, 0, 0, 1));
const PANEL_OUT = FadeOut.duration(120);

/**
 * How far up from the canvas's bottom edge the dock reaches, space under it
 * included. The canvas fits the document above this, and anything placed
 * along the canvas's bottom sits over it.
 */
export function useDockInset(): number {
	const { bottom } = useSafeAreaInsets();
	return dockBottom(bottom) + DOCK_HEIGHT;
}

// Over the home indicator's area, though clear of the indicator itself.
function dockBottom(safeAreaBottom: number) {
	return Math.max(DOCK_MARGIN, safeAreaBottom - 8);
}

/**
 * The frosted dock floating over the bottom of the canvas, holding the panel
 * for the selection or tool. Changing `panel` cross-fades to the new one;
 * the same panel for another layer stays put. `start` and `end` hold
 * `DockButton`s at its ends, set off from the panel: a tool's way back, or
 * Cancel and Done, within reach of the thumb that's using it.
 */
export function Dock({
	panel,
	start,
	end,
	children,
}: {
	panel: string;
	start?: ReactNode;
	end?: ReactNode;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();

	return (
		<View style={[styles.area, { bottom: dockBottom(bottom) }]}>
			<GlassView style={styles.dock}>
				<Animated.View
					key={panel}
					entering={PANEL_IN}
					exiting={PANEL_OUT}
					style={[StyleSheet.absoluteFill, styles.content]}
				>
					{start && <View style={[styles.end, styles.startEnd]}>{start}</View>}
					{children}
					{end && <View style={[styles.end, styles.endEnd]}>{end}</View>}
				</Animated.View>
			</GlassView>
		</View>
	);
}

type DockIconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A round button for one end of the dock. `primary` fills it with the
 * accent, for the action that finishes a tool.
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
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={6}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.button,
						webTransition,
						primary && styles.primary,
						hovered && (primary ? styles.primaryHovered : styles.hovered),
						pressed && (primary ? styles.primaryPressed : styles.pressed),
					];
				}}
			>
				<Ionicons
					name={icon}
					size={24}
					color={primary ? colors.onAccent : colors.textPrimary}
				/>
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
		alignItems: "center",
		pointerEvents: "box-none",
	},
	dock: {
		width: "100%",
		maxWidth: DOCK_MAX_WIDTH,
		height: DOCK_HEIGHT,
		borderRadius: radii.panel,
	},
	content: {
		flexDirection: "row",
	},
	// Set off from the panel by a hairline, and wide enough to be easy to hit.
	end: {
		width: 56,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 20,
		borderColor: colors.borderStrong,
	},
	startEnd: {
		borderRightWidth: StyleSheet.hairlineWidth,
	},
	endEnd: {
		borderLeftWidth: StyleSheet.hairlineWidth,
	},
	button: {
		width: 44,
		height: 44,
		borderRadius: 22,
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
	primary: {
		backgroundColor: colors.accent,
	},
	primaryHovered: {
		backgroundColor: colors.accentHover,
	},
	primaryPressed: {
		backgroundColor: colors.accentPressed,
		transform: [{ scale: 0.92 }],
	},
});
