import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewInstance,
} from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/ui/Button";
import { compactControls } from "@/ui/density";
import { interaction } from "@/ui/interaction";
import { Surface } from "@/ui/Surface";
import { TextButton } from "@/ui/TextButton";
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
const BAR_BUTTON_SIZE = compactControls ? 32 : 36;
const BAR_ICON_SIZE = 20;
// A wide screen's inspector card along the right, which holds the layers.
export const INSPECTOR_WIDTH = 352;
// Minimum height of a wide screen's bottom tool card, sized for the tallest
// tool card (Find's scopes and results, or Adjust's choices and dial).
export const CARD_HEIGHT = 172;
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
	rightInset = 0,
	keepFocus = false,
	children,
}: {
	panel: string;
	footer?: ReactNode;
	keyboardOverlap?: number;
	rightInset?: number;
	// While text is being typed, a press in the dock must not take the caret
	// from the hidden input. Canceling the press's default leaves it there.
	keepFocus?: boolean;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();
	const dockRef = useRef<ViewInstance>(null);
	useEffect(() => {
		if (!keepFocus || Platform.OS !== "web") return;
		const node = dockRef.current as unknown as HTMLElement | null;
		const keep = (event: MouseEvent) => event.preventDefault();
		node?.addEventListener("mousedown", keep, true);
		return () => node?.removeEventListener("mousedown", keep, true);
	}, [keepFocus]);
	return (
		<View
			ref={dockRef}
			style={[
				styles.bar,
				keyboardOverlap > 0 && { bottom: keyboardOverlap },
				{
					paddingBottom: dockBottom(bottom, keyboardOverlap) - keyboardOverlap,
					paddingRight: rightInset,
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

/** The wide editor's right-hand card beside the canvas, holding the layers. */
export function Inspector({ children }: { children: ReactNode }) {
	return (
		<View style={styles.inspectorArea}>
			<Surface
				resting
				style={styles.inspectorCard}
				contentStyle={styles.inspectorFill}
			>
				{children}
			</Surface>
		</View>
	);
}

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

function modeActionButtons(
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

/**
 * A mode's last row: Cancel (and Reset, when the mode has one) at the left,
 * the mode's name in the middle, and Done at the right, all within reach of
 * the thumb that's using it. Without `onCancel`, the left end stays empty, so
 * the name stays centered.
 */
export function DockFooter({
	title,
	...actions
}: { title: string } & ModeActionProps) {
	const { cancel, done } = modeActionButtons(actions, "dock");
	return (
		<View style={styles.footer}>
			<View style={styles.footerEnd}>
				{cancel}
				{actions.onReset && (
					<TextButton label="Reset" onPress={actions.onReset} />
				)}
			</View>
			<Text style={styles.title} numberOfLines={1} accessibilityRole="header">
				{title}
			</Text>
			<View style={[styles.footerEnd, styles.footerEndRight]}>{done}</View>
		</View>
	);
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
	inspectorArea: {
		position: "absolute",
		top: PANEL_GAP,
		right: PANEL_GAP,
		bottom: PANEL_GAP,
		width: INSPECTOR_WIDTH,
		pointerEvents: "box-none",
	},
	inspectorCard: {
		maxHeight: "100%",
		borderRadius: PANEL_RADIUS,
	},
	inspectorFill: {
		flexShrink: 1,
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
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: space.xxs,
	},
	footerEndRight: {
		justifyContent: "flex-end",
	},
	modeActions: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 0,
		gap: 6,
		marginLeft: space.xs,
	},
	title: {
		...typography.bodyStrong,
		color: colors.textPrimary,
		textAlign: "center",
		paddingHorizontal: space.xs,
		flexShrink: 1,
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
