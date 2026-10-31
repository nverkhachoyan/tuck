import {
	type ReactNode,
	type RefObject,
	useContext,
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
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { PopoverPlacementContext } from "./popoverContext";
import {
	type PopoverPlacement,
	type PopoverRect,
	placePopover,
} from "./popoverPlacement";
import { colors, floatingShadow, radii, space } from "./theme";

export type PopoverProps = {
	anchor: RefObject<ViewInstance | null>;
	open: boolean;
	onClose: () => void;
	label: string;
	placement?: PopoverPlacement;
	restoreFocus?: () => void;
	onDismiss?: () => void;
	children: ReactNode;
};

const DECELERATE = Easing.bezier(0.2, 0, 0, 1);
const ENTRANCE_MS = 160;

/**
 * A card anchored to a control and kept inside the window.
 * - `placement` defaults to `PopoverPlacementContext` or `below`.
 * - Outside press closes the card.
 * - Animates in with a 160ms ease toward anchor once measured.
 */
export function Popover({
	anchor,
	open,
	onClose,
	label,
	placement,
	restoreFocus,
	onDismiss,
	children,
}: PopoverProps) {
	const contextPlacement = useContext(PopoverPlacementContext);
	const resolvedPlacement = placement ?? contextPlacement;
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
				placement={resolvedPlacement}
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
	useEffect(() => {
		return () => restoreRef.current?.();
	}, []);

	const position =
		anchorRect && cardSize
			? placePopover(anchorRect, cardSize, viewport, placement)
			: undefined;

	const reduceMotion = useReducedMotion();
	const progress = useSharedValue(reduceMotion ? 1 : 0);
	useEffect(() => {
		if (position) {
			progress.value = reduceMotion
				? 1
				: withTiming(1, { duration: ENTRANCE_MS, easing: DECELERATE });
		}
	}, [position, reduceMotion, progress]);

	const animatedStyle = useAnimatedStyle(() => {
		if (!position) return {};
		const p = progress.value;
		const isAbove = anchorRect
			? position.top < anchorRect.y
			: placement === "above";
		const isBeside = placement === "beside";
		return {
			opacity: p,
			transform: [
				isBeside
					? { translateX: (1 - p) * -4 }
					: { translateY: (1 - p) * (isAbove ? 4 : -4) },
			],
		};
	});

	return (
		<View style={styles.frame}>
			{/* Behind the card, not around it: a press on the card would
			    otherwise count as outside and close it. */}
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onClose}
				accessible={false}
			/>
			<Animated.View
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
				style={[
					styles.card,
					position ?? styles.measuring,
					position ? animatedStyle : null,
				]}
			>
				{children}
			</Animated.View>
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
