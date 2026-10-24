import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import type { PopoverProps } from "./Popover";
import { placePopover } from "./popoverPlacement";
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
	'[role="slider"]',
	'[role="switch"]',
].join(", ");

/**
 * A card anchored below a control, or above it near the window's bottom,
 * kept inside the window's edges.
 * - Portaled to the page's body, so a scroll view or a transformed parent
 *   can't clip it, and positioned from the anchor's box.
 * - An outside press closes it, through a layer behind the card: a pressable
 *   wrapping the card would close it on any click inside.
 * - Escape closes it in the capture phase, before the editor's shortcuts,
 *   which listen as the key bubbles, so Escape doesn't also finish a tool.
 * - It's a dialog: focus moves into it, Tab stays inside, and focus returns
 *   to `anchor` when it closes.
 */
export function Popover({
	anchor,
	open,
	onClose,
	label,
	children,
}: PopoverProps) {
	if (!open) return null;
	return (
		<PopoverFrame anchor={anchor} label={label} onClose={onClose}>
			{children}
		</PopoverFrame>
	);
}

function PopoverFrame({
	anchor,
	label,
	onClose,
	children,
}: {
	anchor: RefObject<View | null>;
	label: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const layerRef = useRef<View>(null);
	const cardRef = useRef<View>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const [position, setPosition] = useState<{ left: number; top: number }>();
	const placeRef = useRef<() => void>(() => {});

	useLayoutEffect(() => {
		const place = () => {
			const target = anchor.current as unknown as HTMLElement | null;
			const card = cardRef.current as unknown as HTMLElement | null;
			if (!target || !card) return;
			const box = target.getBoundingClientRect();
			const size = card.getBoundingClientRect();
			const next = placePopover(
				{ x: box.left, y: box.top, width: box.width, height: box.height },
				size,
				{ width: window.innerWidth, height: window.innerHeight },
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
	}, [anchor]);

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
			returnTo?.focus();
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
				style={[styles.card, fixed, position ?? styles.measuring]}
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
