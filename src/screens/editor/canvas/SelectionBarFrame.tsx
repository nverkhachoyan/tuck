import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { handleMetrics } from "./handleMetrics";
import {
	type LiveTransform,
	readLiveBox,
	readLiveTransform,
} from "./liveTransform";
import {
	placeSelectionBar,
	selectionScreenBounds,
} from "./selectionBarPlacement";
import { readShownViewport, type ShownViewport } from "./shownViewport";

// The selection bar's distance from the selection, above it past the rotate
// knob or below it past the handles, and from the view's edges.
const SELECTION_BAR_GAPS = {
	above: handleMetrics.knobOffset + handleMetrics.size / 2 + 10,
	below: handleMetrics.size / 2 + 12,
	margin: 8,
};

/**
 * Places `children` by the selection (see `placeSelectionBar`), within
 * `width` and `height`, as the live values move it. It's hidden until it has
 * a size to place, and while a gesture holds the layer.
 */
export function SelectionBarFrame({
	live,
	shown,
	width,
	height,
	children,
}: {
	live: LiveTransform;
	shown: ShownViewport;
	width: number;
	height: number;
	children: ReactNode;
}) {
	const barSize = useSharedValue({ width: 0, height: 0 });
	const style = useAnimatedStyle(() => {
		const { x, y } = placeSelectionBar(
			selectionScreenBounds(
				readLiveTransform(live),
				readLiveBox(live),
				readShownViewport(shown),
			),
			barSize.value,
			{ width, height },
			SELECTION_BAR_GAPS,
		);
		const visible =
			barSize.value.width > 0 &&
			live.activeId.value !== null &&
			live.heldId.value === null;
		return {
			transform: [{ translateX: x }, { translateY: y }],
			opacity: withTiming(visible ? 1 : 0, { duration: visible ? 160 : 80 }),
		};
	}, [live, shown, width, height]);
	return (
		// A plain view, since Reanimated drops `box-none` on web.
		<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
			<Animated.View
				style={[styles.selectionBar, style]}
				onLayout={(event) => {
					const { width, height } = event.nativeEvent.layout;
					barSize.value = { width, height };
				}}
			>
				{children}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	selectionBar: {
		position: "absolute",
		top: 0,
		left: 0,
	},
});
