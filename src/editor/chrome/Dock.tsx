import { type ReactNode, useEffect, useRef } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	View,
	type ViewInstance,
} from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { compactControls } from "@/ui/density";
import { Surface } from "@/ui/Surface";
import { TextButton } from "@/ui/TextButton";
import { colors, radii, space, typography } from "@/ui/theme";
import { type ModeActionProps, modeActionButtons } from "../shell/modeActions";

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
	const { bottom } = useSafeAreaInsets();
	return (
		<View style={[styles.inspectorArea, { bottom: bottom + PANEL_GAP }]}>
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
	title: {
		...typography.bodyStrong,
		color: colors.textPrimary,
		textAlign: "center",
		paddingHorizontal: space.xs,
		flexShrink: 1,
	},
});
