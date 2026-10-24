import { useEffect } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { colors } from "./theme";

// A little off square, as a marker stroke is.
const TILT = "-2deg";
const SWIPE = { duration: 120, easing: Easing.out(Easing.cubic) };
// How far across the swipe starts. It starts opaque and already past the
// middle, so the chosen thing's ink has the highlight behind it on the first
// frame, before Reanimated starts the swipe (a frame or two late on web).
const SWIPE_START = 0.6;

/**
 * The highlighter swiped behind a chosen thing: a tool, a font, a size. It
 * fills its parent, so render it as the chosen control's first child, behind
 * the rest, and color what's drawn over it `colors.onHighlight`, which the
 * night palette needs. `style` can move its edges. Colors and swatches are
 * ringed instead (`RingChoice`).
 *
 * `under` draws a short, thick stroke along the parent's foot instead, for
 * the chosen tab: clear of the label, which keeps its own color.
 *
 * It swipes the rest of the way across from its left as it appears. That's
 * a shared value rather than an entering animation: on web, Reanimated pins
 * an entering view's position while a parent animates in, as a sheet does.
 */
export function Highlight({
	under = false,
	style,
}: {
	under?: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	const reduceMotion = useReducedMotion();
	const progress = useSharedValue(reduceMotion ? 1 : 0);
	useEffect(() => {
		progress.value = withTiming(1, SWIPE);
	}, [progress]);
	// On web, the first frame can be stamped before the swipe started, which
	// the easing turns into a step backward.
	const swiped = useAnimatedStyle(() => ({
		transform: [
			{ rotate: TILT },
			{
				scaleX: SWIPE_START + Math.max(0, progress.value) * (1 - SWIPE_START),
			},
		],
	}));
	return (
		<Animated.View
			style={[styles.swipe, under ? styles.under : styles.fill, style, swiped]}
		/>
	);
}

const styles = StyleSheet.create({
	swipe: {
		position: "absolute",
		left: 0,
		right: 0,
		backgroundColor: colors.highlight,
		transformOrigin: "left center",
	},
	fill: {
		top: 0,
		bottom: 0,
		borderTopLeftRadius: 4,
		borderTopRightRadius: 10,
		borderBottomRightRadius: 5,
		borderBottomLeftRadius: 12,
	},
	under: {
		bottom: 1,
		height: 4,
		marginHorizontal: -2,
		borderRadius: 2,
	},
});
