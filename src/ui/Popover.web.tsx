import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	Pressable,
	StyleSheet,
	View,
	type ViewInstance,
	type ViewStyle,
} from "react-native";
import type { PopoverProps } from "./Popover";
import { type PopoverPlacement, placePopover } from "./popoverPlacement";
import { colors, floatingShadow, radii, space } from "./theme";

// What Tab cycles through. A React Native pressable is a `role="button"`,
// not a `<button>`.
const FOCUSABLE = [
	"button",
	"a[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[role="button"]:not([aria-disabled="true"])',
	'[role="radio"]:not([aria-disabled="true"])',
	'[role="slider"]',
	'[role="switch"]',
].join(", ");

/**
 * A card anchored to a control and kept inside the window.
 * - Portaled to document.body, outside transformed ancestors.
 * - `placement` defaults to `below` (under the control, or above near the window's bottom).
 * - Escape closes in the capture phase before editor shortcuts run.
 * - Animates in with a 160ms ease toward anchor once measured.
 */
export function Popover({
	anchor,
	open,
	onClose,
	label,
	placement = "below",
	restoreFocus,
	onDismiss,
	children,
}: PopoverProps) {
	const wasOpen = useRef(open);
	useEffect(() => {
		if (wasOpen.current && !open) onDismiss?.();
		wasOpen.current = open;
	}, [open, onDismiss]);
	if (!open) return null;
	return (
		<PopoverFrame
			anchor={anchor}
			label={label}
			onClose={onClose}
			placement={placement}
			restoreFocus={restoreFocus}
		>
			{children}
		</PopoverFrame>
	);
}

function PopoverFrame({
	anchor,
	label,
	onClose,
	placement,
	restoreFocus,
	children,
}: {
	anchor: RefObject<ViewInstance | null>;
	label: string;
	onClose: () => void;
	placement: PopoverPlacement;
	restoreFocus?: () => void;
	children: ReactNode;
}) {
	const layerRef = useRef<ViewInstance>(null);
	const cardRef = useRef<ViewInstance>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const restoreRef = useRef(restoreFocus);
	restoreRef.current = restoreFocus;
	const [position, setPosition] = useState<{ left: number; top: number }>();
	const [anchorBox, setAnchorBox] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [entered, setEntered] = useState(false);
	const placeRef = useRef<() => void>(() => {});

	useLayoutEffect(() => {
		const place = () => {
			const target = anchor.current as unknown as HTMLElement | null;
			const card = cardRef.current as unknown as HTMLElement | null;
			if (!target || !card) return;
			const box = target.getBoundingClientRect();
			const size = card.getBoundingClientRect();
			setAnchorBox({ x: box.left, y: box.top });
			const next = placePopover(
				{ x: box.left, y: box.top, width: box.width, height: box.height },
				size,
				{ width: window.innerWidth, height: window.innerHeight },
				placement,
			);
			setPosition((current) =>
				current?.left === next.left && current.top === next.top
					? current
					: next,
			);
		};
		placeRef.current = place;
		place();
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [anchor, placement]);

	useEffect(() => {
		if (position && !entered) {
			const prefersReduced =
				typeof window !== "undefined" &&
				window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
			if (prefersReduced) {
				setEntered(true);
			} else {
				const frame = requestAnimationFrame(() => setEntered(true));
				return () => cancelAnimationFrame(frame);
			}
		}
	}, [position, entered]);

	useEffect(() => {
		const card = cardRef.current as unknown as HTMLElement | null;
		const returnTo = anchor.current as unknown as HTMLElement | null;
		if (!card) return;
		const items = focusableIn(card);
		(items[0] ?? card).focus();

		// Capture, so this runs before a shortcut listening on the window as
		// the key bubbles. Stopping it here keeps that shortcut from seeing it.
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				onCloseRef.current();
				return;
			}
			if (event.key !== "Tab") return;
			const all = focusableIn(card);
			if (all.length === 0) {
				card.focus();
			} else {
				const at = all.indexOf(document.activeElement as HTMLElement);
				const step = event.shiftKey ? -1 : 1;
				const next = at === -1 ? 0 : (at + step + all.length) % all.length;
				all[next]?.focus();
			}
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => {
			window.removeEventListener("keydown", handleKeyDown, true);
			const restore = restoreRef.current;
			if (restore) restore();
			else returnTo?.focus();
		};
	}, [anchor]);

	// After the control has seen the key: other keys stay in the dialog, so a
	// shortcut listening on the window doesn't act on what's behind it.
	useEffect(() => {
		const layer = layerRef.current as unknown as HTMLElement | null;
		if (!layer) return;
		const stop = (event: KeyboardEvent) => event.stopPropagation();
		layer.addEventListener("keydown", stop);
		return () => layer.removeEventListener("keydown", stop);
	}, []);

	const isAbove =
		anchorBox && position ? position.top < anchorBox.y : placement === "above";
	const isBeside = placement === "beside";
	const motionOffset = isBeside
		? [{ translateX: -4 }]
		: [{ translateY: isAbove ? 4 : -4 }];

	const prefersReduced =
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

	const animatedStyle = position
		? ({
				opacity: entered ? 1 : 0,
				transform:
					entered || prefersReduced
						? [{ translateY: 0 }, { translateX: 0 }]
						: motionOffset,
				transitionProperty: "opacity, transform",
				transitionDuration: prefersReduced ? "0ms" : "160ms",
				transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
			} as unknown as ViewStyle)
		: styles.measuring;

	return createPortal(
		<View ref={layerRef} style={[styles.layer, fixed]}>
			<Pressable
				style={StyleSheet.absoluteFill}
				focusable={false}
				accessible={false}
				onPress={() => onCloseRef.current()}
			/>
			<View
				ref={cardRef}
				role="dialog"
				aria-modal
				aria-label={label}
				tabIndex={-1}
				onLayout={() => placeRef.current()}
				style={[styles.card, fixed, position, animatedStyle]}
			>
				{children}
			</View>
		</View>,
		document.body,
	);
}

function focusableIn(card: HTMLElement) {
	return [...card.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

// React Native's style types lack fixed positioning, which only web has.
const fixed = { position: "fixed" } as unknown as ViewStyle;

const styles = StyleSheet.create({
	layer: {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		// Above the editor, below a tooltip (1000) and an alert (2000), so a
		// control in the card can still show its hover label.
		zIndex: 900,
	},
	card: {
		maxWidth: "100%",
		padding: space.sm,
		borderRadius: radii.large,
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
		boxShadow: floatingShadow,
	},
	measuring: {
		top: 0,
		left: 0,
		opacity: 0,
		pointerEvents: "none",
	},
});
