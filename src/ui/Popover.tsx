import {
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useState,
} from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { type PopoverRect, placePopover } from "./popoverPlacement";
import { colors, floatingShadow, radii, space } from "./theme";

export type PopoverProps = {
	/** The control the card hangs from. */
	anchor: RefObject<View | null>;
	open: boolean;
	onClose: () => void;
	/** Names the dialog for screen readers. */
	label: string;
	children: ReactNode;
};

/**
 * A card anchored below a control, or above it near the window's bottom,
 * kept inside the window's edges. An outside press closes it. It's a dialog
 * for screen readers. On web, Escape closes it before the page's shortcuts
 * see the key, and focus moves into it and back to `anchor` (see
 * `Popover.web.tsx`).
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
		<Modal
			transparent
			visible
			animationType="none"
			onRequestClose={onClose}
			statusBarTranslucent
		>
			<PopoverFrame anchor={anchor} label={label} onClose={onClose}>
				{children}
			</PopoverFrame>
		</Modal>
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
	const viewport = useWindowDimensions();
	const [anchorRect, setAnchorRect] = useState<PopoverRect | null>(null);
	const [cardSize, setCardSize] = useState<{ width: number; height: number }>();
	useLayoutEffect(() => {
		anchor.current?.measureInWindow((x, y, width, height) => {
			setAnchorRect({ x, y, width, height });
		});
	}, [anchor]);
	const position =
		anchorRect && cardSize
			? placePopover(anchorRect, cardSize, viewport)
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
