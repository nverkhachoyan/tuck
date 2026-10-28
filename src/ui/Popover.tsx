import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
	type ViewInstance,
} from "react-native";
import {
	type PopoverPlacement,
	type PopoverRect,
	placePopover,
} from "./popoverPlacement";
import { colors, floatingShadow, radii, space } from "./theme";

export type PopoverProps = {
	/** The control the card hangs from. */
	anchor: RefObject<ViewInstance | null>;
	open: boolean;
	onClose: () => void;
	/** Names the dialog for screen readers. */
	label: string;
	/**
	 * `below` hangs the card under the control. `beside` opens it to the
	 * control's right, for a button in the rail.
	 */
	placement?: PopoverPlacement;
	/**
	 * Where focus goes when the card closes, instead of back to `anchor`.
	 * Text editing uses it so the caret returns to the hidden input.
	 */
	restoreFocus?: () => void;
	/**
	 * Called once the card has gone and another screen can be shown, such as
	 * the photo picker. On iOS that's when its modal finishes dismissing.
	 */
	onDismiss?: () => void;
	children: ReactNode;
};

/**
 * A card anchored to a control and kept inside the window.
 * - `placement` is `below` by default: under the control, or above it near
 *   the window's bottom. `beside` puts it at the control's right, top-aligned,
 *   and moves it up to stay inside the window.
 * - An outside press closes it. It's a dialog for screen readers.
 * - On iOS its modal stays mounted while it closes, so `onDismiss` can wait
 *   for UIKit: a screen presented sooner goes down with the modal.
 * - On web, Escape closes it before the page's shortcuts see the key, and
 *   focus moves into it and back to `anchor` when it closes, or to
 *   `restoreFocus` when that's given (see `Popover.web.tsx`).
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
	useDismissElsewhere(open, onDismiss);
	return (
		<Modal
			transparent
			visible={open}
			animationType="none"
			onRequestClose={onClose}
			onDismiss={onDismiss}
			statusBarTranslucent
		>
			<PopoverFrame
				anchor={anchor}
				label={label}
				onClose={onClose}
				placement={placement}
				restoreFocus={restoreFocus}
			>
				{children}
			</PopoverFrame>
		</Modal>
	);
}

// Android's modal has no `onDismiss`, and closes before anything it would
// stand in the way of, so it's called as the popover closes.
function useDismissElsewhere(open: boolean, onDismiss?: () => void) {
	const wasOpen = useRef(open);
	useEffect(() => {
		if (wasOpen.current && !open && Platform.OS !== "ios") onDismiss?.();
		wasOpen.current = open;
	}, [open, onDismiss]);
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
	const viewport = useWindowDimensions();
	const [anchorRect, setAnchorRect] = useState<PopoverRect | null>(null);
	const [cardSize, setCardSize] = useState<{ width: number; height: number }>();
	useLayoutEffect(() => {
		anchor.current?.measureInWindow((x, y, width, height) => {
			setAnchorRect({ x, y, width, height });
		});
	}, [anchor]);
	const restoreRef = useRef(restoreFocus);
	restoreRef.current = restoreFocus;
	// The modal took the keyboard. Hand it back when the card goes, the same
	// moment the web card returns focus. The callback's identity changes with
	// every render, so it's read from a ref and the effect runs once.
	useEffect(() => {
		return () => restoreRef.current?.();
	}, []);
	const position =
		anchorRect && cardSize
			? placePopover(anchorRect, cardSize, viewport, placement)
			: undefined;
	return (
		<View style={styles.frame}>
			{/* Behind the card, not around it: a press on the card would
			    otherwise count as outside and close it. */}
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onClose}
				accessible={false}
			/>
			<View
				onLayout={(event) => {
					const { width, height } = event.nativeEvent.layout;
					setCardSize((size) =>
						size?.width === width && size.height === height
							? size
							: { width, height },
					);
				}}
				accessibilityViewIsModal
				accessibilityLabel={label}
				role="dialog"
				style={[styles.card, position ?? styles.measuring]}
			>
				{children}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	frame: {
		flex: 1,
	},
	card: {
		position: "absolute",
		maxWidth: "100%",
		padding: space.sm,
		borderRadius: radii.large,
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
		boxShadow: floatingShadow,
	},
	// Measured once drawn, still invisible, then placed.
	measuring: {
		opacity: 0,
	},
});
