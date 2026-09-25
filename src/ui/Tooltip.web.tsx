import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors } from "@/theme";
import type { TooltipAnchorProps } from "./Tooltip";

const SHOW_DELAY_MS = 500;
// After one tooltip hides, the next shows at once for this long, so running
// the pointer along a toolbar reads each button without waiting.
const WARM_MS = 400;
// From the control, and from the window's edges.
const GAP = 8;
const MARGIN = 8;

let warmUntil = 0;

const isMac =
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Shows the label after a moment of hover, below the control or above it
 * near the window's bottom. It's portaled to the page's body, so a scroll
 * view or a transformed parent can't clip it.
 */
export function useTooltip(
	text: string,
	shortcut?: string,
): { anchor: TooltipAnchorProps; tooltip: ReactNode } {
	const ref = useRef<View>(null);
	const [shown, setShown] = useState(false);
	const shownRef = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimer = useCallback(() => {
		if (timer.current !== null) clearTimeout(timer.current);
		timer.current = null;
	}, []);
	const setVisible = useCallback((visible: boolean) => {
		shownRef.current = visible;
		setShown(visible);
	}, []);

	const onHoverIn = useCallback(() => {
		clearTimer();
		if (Date.now() < warmUntil) setVisible(true);
		else timer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
	}, [clearTimer, setVisible]);
	const onHoverOut = useCallback(() => {
		clearTimer();
		if (shownRef.current) warmUntil = Date.now() + WARM_MS;
		setVisible(false);
	}, [clearTimer, setVisible]);
	// A click answers the question the tooltip would have.
	const onPressIn = useCallback(() => {
		clearTimer();
		setVisible(false);
	}, [clearTimer, setVisible]);

	useEffect(() => clearTimer, [clearTimer]);

	return {
		anchor: { ref, onHoverIn, onHoverOut, onPressIn },
		tooltip: shown ? (
			<Bubble anchor={ref} text={text} shortcut={shortcut} />
		) : null,
	};
}

function Bubble({
	anchor,
	text,
	shortcut,
}: {
	anchor: RefObject<View | null>;
	text: string;
	shortcut?: string;
}) {
	const bubbleRef = useRef<View>(null);
	const [position, setPosition] = useState<{ left: number; top: number }>();

	// Measured once drawn, still invisible, then placed and faded in.
	useLayoutEffect(() => {
		const target = anchor.current as unknown as HTMLElement | null;
		const bubble = bubbleRef.current as unknown as HTMLElement | null;
		if (!target || !bubble) return;
		const a = target.getBoundingClientRect();
		const b = bubble.getBoundingClientRect();
		const fitsBelow = a.bottom + GAP + b.height <= window.innerHeight - MARGIN;
		setPosition({
			left: Math.max(
				MARGIN,
				Math.min(
					a.left + a.width / 2 - b.width / 2,
					window.innerWidth - MARGIN - b.width,
				),
			),
			top: fitsBelow ? a.bottom + GAP : a.top - GAP - b.height,
		});
	}, [anchor]);

	return createPortal(
		<View
			ref={bubbleRef}
			style={[
				styles.bubble,
				fixed,
				position ? [styles.appear, position] : styles.measuring,
			]}
		>
			<Text style={styles.text}>{text}</Text>
			{shortcut && (
				<Text style={styles.shortcut}>{formatShortcut(shortcut)}</Text>
			)}
		</View>,
		document.body,
	);
}

const MAC_MODIFIERS: [string, string][] = [
	["alt", "⌥"],
	["shift", "⇧"],
	["mod", "⌘"],
];
const OTHER_MODIFIERS: [string, string][] = [
	["mod", "Ctrl"],
	["alt", "Alt"],
	["shift", "Shift"],
];
const MAC_KEYS: Record<string, string> = {
	Delete: "⌫",
	Enter: "↩",
	Escape: "esc",
};
const OTHER_KEYS: Record<string, string> = { Delete: "Del", Escape: "Esc" };

/** "mod+shift+Z" as this platform writes it: ⇧⌘Z on a Mac, Ctrl+Shift+Z elsewhere. */
function formatShortcut(shortcut: string) {
	const parts = shortcut.split("+");
	const key = parts[parts.length - 1];
	const modifiers = isMac ? MAC_MODIFIERS : OTHER_MODIFIERS;
	const held = modifiers
		.filter(([name]) => parts.includes(name))
		.map(([, symbol]) => symbol);
	const keyLabel = (isMac ? MAC_KEYS : OTHER_KEYS)[key] ?? key;
	return isMac ? [...held, keyLabel].join("") : [...held, keyLabel].join("+");
}

// React Native's style types lack fixed positioning, which only web has.
const fixed = { position: "fixed" } as unknown as ViewStyle;

const styles = StyleSheet.create({
	bubble: {
		top: 0,
		left: 0,
		zIndex: 1000,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 9,
		paddingVertical: 5,
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: "rgba(255, 255, 255, 0.1)",
		backgroundColor: "rgba(44, 44, 48, 0.78)",
		boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
		// React Native's style types lack backdrop filters, which only web has.
		backdropFilter: "blur(16px) saturate(160%)",
		pointerEvents: "none",
	} as unknown as ViewStyle,
	measuring: {
		opacity: 0,
	},
	appear: {
		animationKeyframes: [
			{
				from: { opacity: 0, transform: "translateY(-2px)" },
				to: { opacity: 1, transform: "translateY(0)" },
			},
		],
		animationDuration: "120ms",
		animationTimingFunction: "ease-out",
		animationFillMode: "both",
	} as unknown as ViewStyle,
	text: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	shortcut: {
		fontSize: 12,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
});
