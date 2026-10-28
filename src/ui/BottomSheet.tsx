import { type ReactNode, useMemo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import {
	Gesture,
	GestureDetector,
	type LegacyPanGesture,
} from "react-native-gesture-handler";
import Animated, {
	Easing,
	SlideInDown,
	SlideOutDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { IconButton } from "./IconButton";
import { Surface } from "./Surface";
import { colors, radii, typography } from "./theme";

// `webTransition`'s curve, for arriving, and its mirror for leaving.
const DECELERATE = Easing.bezier(0.2, 0, 0, 1);
const ACCELERATE = Easing.bezier(0.3, 0, 1, 1);
const SHEET_IN = SlideInDown.duration(280).easing(DECELERATE);
const SHEET_OUT = SlideOutDown.duration(200).easing(ACCELERATE);
// A released sheet closes if its drag, carried on at the release speed for
// this long (in seconds), would pass a third of its height.
const SWIPE_MOMENTUM = 0.15;
const SWIPE_SETTLE = { duration: 200, easing: DECELERATE };

/**
 * A card along the bottom of its parent, with a header that drags it down:
 * released, it closes or settles back. It slides in when mounted and out
 * when unmounted. `onClose` should be stable, or the swipe is rebuilt on
 * every render.
 *
 * The card moves inside the view that slides it in and out, so the two
 * animations don't fight over one transform, and once swiped away, the exit
 * slide runs out of sight. Its content pads the home indicator's area.
 */
export function BottomSheet({
	title,
	closeLabel,
	onClose,
	children,
}: {
	title: string;
	closeLabel: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();
	const drag = useSharedValue(0);
	const height = useSharedValue(0);

	const swipe = useMemo(
		() =>
			Gesture.Pan()
				.activeOffsetY([-8, 8])
				.onUpdate((event) => {
					drag.value = Math.max(0, event.translationY);
				})
				.onEnd((event, success) => {
					const coast = event.translationY + event.velocityY * SWIPE_MOMENTUM;
					if (success && coast > height.value / 3) {
						drag.value = withTiming(
							Math.max(drag.value, height.value),
							SWIPE_SETTLE,
							(finished) => {
								if (finished) scheduleOnRN(onClose);
							},
						);
					} else {
						drag.value = withTiming(0, SWIPE_SETTLE);
					}
				}),
		[drag, height, onClose],
	);
	const dragged = useAnimatedStyle(() => ({
		transform: [{ translateY: drag.value }],
	}));

	return (
		<Animated.View
			entering={SHEET_IN}
			exiting={SHEET_OUT}
			style={styles.sheetSlot}
		>
			<Animated.View
				onLayout={(event) => {
					height.value = event.nativeEvent.layout.height;
				}}
				style={[styles.sheet, dragged]}
			>
				<Surface
					style={styles.sheetCard}
					contentStyle={[styles.shrink, { paddingBottom: bottom }]}
				>
					<PanelHeader
						title={title}
						closeLabel={closeLabel}
						onClose={onClose}
						swipe={swipe}
					/>
					{children}
				</Surface>
			</Animated.View>
		</Animated.View>
	);
}

/**
 * A floating panel's title and close button, with a grabber when it can be
 * swiped.
 */
export function PanelHeader({
	title,
	closeLabel,
	onClose,
	swipe,
}: {
	title: string;
	closeLabel: string;
	onClose: () => void;
	swipe?: LegacyPanGesture;
}) {
	const header = (
		<View style={[styles.header, swipe && handleCursor]}>
			{swipe && <View style={styles.grabber} />}
			<Text style={styles.title} accessibilityRole="header">
				{title}
			</Text>
			<IconButton icon="close" label={closeLabel} onPress={onClose} />
		</View>
	);
	return swipe ? (
		<GestureDetector gesture={swipe}>{header}</GestureDetector>
	) : (
		header
	);
}

const handleCursor =
	Platform.OS === "web" ? ({ cursor: "grab" } as unknown as ViewStyle) : null;

const styles = StyleSheet.create({
	shrink: {
		flexShrink: 1,
	},
	sheetSlot: {
		maxHeight: "100%",
	},
	sheet: {
		flexShrink: 1,
	},
	sheetCard: {
		flexShrink: 1,
		borderTopLeftRadius: radii.large,
		borderTopRightRadius: radii.large,
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
	},
	header: {
		width: "100%",
		maxWidth: 560,
		alignSelf: "center",
		height: 52,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingLeft: 20,
		paddingRight: 22,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	grabber: {
		position: "absolute",
		top: 6,
		left: "50%",
		width: 36,
		height: 5,
		marginLeft: -18,
		borderRadius: 2.5,
		backgroundColor: colors.borderStrong,
	},
	title: {
		...typography.bodyStrong,
		color: colors.textPrimary,
	},
});
