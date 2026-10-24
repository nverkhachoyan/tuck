import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { compactControls } from "@/ui/density";
import { interaction } from "@/ui/interaction";
import { Surface } from "@/ui/Surface";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";

// The dock's one fixed height, shared by every panel, so the canvas, fitted
// above the dock, never moves when the selection or tool changes. A mode's
// panel takes the top, and its footer the rest. The main tools, with no
// footer, take it all for their two rows.
const CONTENT_HEIGHT = 100;
const FOOTER_HEIGHT = 44;
const DOCK_HEIGHT = CONTENT_HEIGHT + FOOTER_HEIGHT;
// Wide enough for the text panel's tabs and actions side by side.
const DOCK_MAX_WIDTH = 520;
// Under the dock's content where nothing's in the way.
const DOCK_MARGIN = 10;
// Between the dock and the keyboard, while it's up.
const KEYBOARD_GAP = 8;
const BUTTON_SIZE = compactControls ? 36 : 44;
const BUTTON_ICON_SIZE = compactControls ? 24 : 28;
// A wide screen's inspector, along the right, which the dock becomes. Wide
// enough for a row of five tools at their full spacing (see `ToolRow`), the
// most a tool's panel shows.
export const INSPECTOR_WIDTH = 352;
// Between a wide screen's panels, the rail and the inspector, and the edges
// of the canvas they rest beside, and their corners. Closer and tighter
// where controls are sized for a mouse.
export const PANEL_GAP = compactControls ? space.xs : space.sm;
export const PANEL_RADIUS = compactControls ? radii.medium : radii.large;
const PANEL_IN = FadeIn.duration(220).easing(Easing.bezier(0.2, 0, 0, 1));
const PANEL_OUT = FadeOut.duration(120);

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
 * same panel for another layer stays put. Every mode, a tool or a selected
 * layer, puts a `DockFooter` in `footer`, under its panel. It rises above
 * the keyboard by `keyboardOverlap`, taking the footer along. A wide screen
 * has no dock: its tools live in the header, and `Inspector` holds the layers.
 */
export function Dock({
	panel,
	footer,
	keyboardOverlap = 0,
	children,
}: {
	panel: string;
	footer?: ReactNode;
	keyboardOverlap?: number;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();
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
			<View style={styles.column}>
				<View style={footer ? styles.content : styles.fullContent}>
					<Animated.View
						key={panel}
						entering={PANEL_IN}
						exiting={PANEL_OUT}
						style={[StyleSheet.absoluteFill, styles.panel]}
					>
						{children}
					</Animated.View>
				</View>
				{footer}
			</View>
		</View>
	);
}

/**
 * The wide editor's column, a card down the right beside the canvas. It
 * holds the layers, and, above them, Find's results or Adjust's dial. A
 * tool's options live in the header's context bar, not in this card.
 */
export function Inspector({ children }: { children: ReactNode }) {
	return (
		<Surface
			resting
			style={styles.inspectorCard}
			contentStyle={styles.inspectorFill}
		>
			{children}
		</Surface>
	);
}

type ModeActionProps = {
	onCancel?: () => void;
	cancelShortcut?: string;
	onDone: () => void;
	// What Done does, for its tooltip and screen readers, when it's more.
	doneLabel?: string;
	doneShortcut?: string;
};

/**
 * Cancel, when the mode has one, and Done. The dock's footer puts them at
 * its ends; the wide editor's context bar groups them. The labels, shortcuts,
 * and which of the two show live here, so the two layouts can't disagree.
 */
export function ModeActions(props: ModeActionProps) {
	const { cancel, done } = modeActionButtons(props);
	return (
		<View style={styles.modeActions}>
			{cancel}
			{done}
		</View>
	);
}

function modeActionButtons({
	onCancel,
	cancelShortcut,
	onDone,
	doneLabel = "Done",
	doneShortcut,
}: ModeActionProps) {
	return {
		cancel: onCancel ? (
			<DockButton
				icon="close-outline"
				label="Cancel"
				shortcut={cancelShortcut}
				onPress={onCancel}
			/>
		) : null,
		done: (
			<DockButton
				icon="checkmark-outline"
				label={doneLabel}
				shortcut={doneShortcut}
				onPress={onDone}
			/>
		),
	};
}

/**
 * A mode's last row: Cancel at the left, the mode's name in the middle, and
 * Done at the right, all within reach of the thumb that's using it. Without
 * `onCancel`, Cancel's place stays empty, so the name stays centered.
 */
export function DockFooter({
	title,
	...actions
}: { title: string } & ModeActionProps) {
	const { cancel, done } = modeActionButtons(actions);
	return (
		<View style={styles.footer}>
			<View style={styles.footerEnd}>{cancel}</View>
			<Text style={styles.title} numberOfLines={1} accessibilityRole="header">
				{title}
			</Text>
			<View style={[styles.footerEnd, styles.footerEndRight]}>{done}</View>
		</View>
	);
}

type DockIconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A glyph at one end of the footer, with no fill: the footer's ends are
 * where a mode's Done and Cancel always are, so their place names them.
 */
function DockButton({
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
				<Ionicons
					name={icon}
					size={BUTTON_ICON_SIZE}
					color={colors.textPrimary}
				/>
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
	column: {
		width: "100%",
		maxWidth: DOCK_MAX_WIDTH,
		height: DOCK_HEIGHT,
		alignSelf: "center",
	},
	content: {
		height: CONTENT_HEIGHT,
	},
	fullContent: {
		height: DOCK_HEIGHT,
	},
	inspectorCard: {
		position: "absolute",
		top: PANEL_GAP,
		right: PANEL_GAP,
		bottom: PANEL_GAP,
		width: INSPECTOR_WIDTH,
		borderRadius: PANEL_RADIUS,
	},
	inspectorFill: {
		flex: 1,
	},
	panel: {
		flexDirection: "row",
	},
	footer: {
		height: FOOTER_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 8,
	},
	footerEnd: {
		width: BUTTON_SIZE,
	},
	footerEndRight: {
		alignItems: "flex-end",
	},
	modeActions: {
		flexDirection: "row",
		alignItems: "center",
	},
	title: {
		flex: 1,
		...typography.bodyStrong,
		color: colors.textPrimary,
		textAlign: "center",
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
