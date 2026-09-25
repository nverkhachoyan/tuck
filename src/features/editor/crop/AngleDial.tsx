import { useCallback, useMemo, useState } from "react";
import {
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	Platform,
	StyleSheet,
	Text,
	View,
	type ViewProps,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	type DerivedValue,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { hapticTick } from "@/lib/haptics";
import { colors } from "@/theme";

// Screen pixels per degree along the ruler.
const PX_PER_DEGREE = 8;
// A tick every degree, a long one every MAJOR degrees.
const MAJOR = 15;
// Settles on 0 from this many degrees away.
const ZERO_SNAP = 1;
const ACCESSIBLE_STEP = Math.PI / 180;

type WebKeyDownEvent = {
	nativeEvent: { key: string };
	preventDefault: () => void;
	stopPropagation: () => void;
};

const toDegrees = (radians: number) => {
	"worklet";
	return (radians * 180) / Math.PI;
};

/**
 * A ruler dragged sideways to set an angle, in radians within ±`max`, like a
 * photo app's straighten dial. It settles on 0 with a haptic tick, and a
 * double tap returns it there. `value` is shown; the callbacks run on the UI
 * thread (they must be worklets), bracketing each change.
 */
export function AngleDial({
	value,
	max,
	label,
	onBegin,
	onChange,
	onEnd,
}: {
	value: DerivedValue<number>;
	max: number;
	label: string;
	onBegin: () => void;
	onChange: (angle: number) => void;
	onEnd: () => void;
}) {
	const [width, setWidth] = useState(0);
	const [degrees, setDegrees] = useState(0);
	const start = useSharedValue(0);
	const dragging = useSharedValue(false);
	const maxDegrees = Math.round(toDegrees(max));

	useAnimatedReaction(
		() => Math.round(toDegrees(value.value)),
		(shown, previous) => {
			if (shown !== previous) scheduleOnRN(setDegrees, shown);
		},
	);

	// A drag starts after a couple of pixels, leaving a double tap to reset.
	const gesture = useMemo(() => {
		const pan = Gesture.Pan()
			.minDistance(2)
			.onStart(() => {
				dragging.value = true;
				start.value = value.value;
				onBegin();
			})
			.onUpdate((event) => {
				const raw =
					start.value - ((event.translationX / PX_PER_DEGREE) * Math.PI) / 180;
				let angle = Math.min(max, Math.max(-max, raw));
				if (Math.abs(toDegrees(angle)) < ZERO_SNAP) {
					if (value.value !== 0) scheduleOnRN(hapticTick);
					angle = 0;
				}
				onChange(angle);
			})
			.onFinalize(() => {
				if (!dragging.value) return;
				dragging.value = false;
				onEnd();
			});
		const reset = Gesture.Tap()
			.numberOfTaps(2)
			.onEnd((_event, success) => {
				if (!success) return;
				onBegin();
				onChange(0);
				onEnd();
			});
		return Gesture.Race(pan, reset);
	}, [value, start, dragging, max, onBegin, onChange, onEnd]);

	const ruler = useAnimatedStyle(() => ({
		transform: [
			{ translateX: width / 2 - toDegrees(value.value) * PX_PER_DEGREE },
		],
	}));

	const ticks = useMemo(
		() =>
			Array.from(
				{ length: maxDegrees * 2 + 1 },
				(_, index) => index - maxDegrees,
			),
		[maxDegrees],
	);

	// Accessibility actions and web arrow keys originate on the JS thread;
	// run the same worklet callbacks as a gesture on the UI thread.
	const setFromControl = useCallback(
		(angle: number) => {
			const next = Math.min(max, Math.max(-max, angle));
			scheduleOnUI(() => {
				"worklet";
				onBegin();
				onChange(next);
				onEnd();
			});
		},
		[max, onBegin, onChange, onEnd],
	);
	const adjust = useCallback(
		(step: number) => setFromControl(value.value + step * ACCESSIBLE_STEP),
		[value, setFromControl],
	);
	const handleAccessibilityAction = useCallback(
		(event: AccessibilityActionEvent) => {
			if (event.nativeEvent.actionName === "increment") adjust(1);
			else if (event.nativeEvent.actionName === "decrement") adjust(-1);
		},
		[adjust],
	);
	const handleKeyDown = useCallback(
		(event: WebKeyDownEvent) => {
			const { key } = event.nativeEvent;
			if (key === "ArrowRight" || key === "ArrowUp") adjust(1);
			else if (key === "ArrowLeft" || key === "ArrowDown") adjust(-1);
			else if (key === "Home") setFromControl(0);
			else return;
			event.preventDefault();
			event.stopPropagation();
		},
		[adjust, setFromControl],
	);
	const webKeyProps =
		Platform.OS === "web"
			? ({ onKeyDown: handleKeyDown } as unknown as ViewProps)
			: undefined;

	return (
		<View style={styles.container}>
			<Text style={[styles.readout, degrees !== 0 && styles.readoutActive]}>
				{degrees}°
			</Text>
			<GestureDetector gesture={gesture}>
				<View
					{...webKeyProps}
					style={styles.track}
					onLayout={(event: LayoutChangeEvent) =>
						setWidth(event.nativeEvent.layout.width)
					}
					accessible
					focusable
					accessibilityRole="adjustable"
					accessibilityLabel={label}
					accessibilityValue={{
						min: -maxDegrees,
						max: maxDegrees,
						now: degrees,
						text: `${degrees} degrees`,
					}}
					accessibilityActions={[
						{ name: "increment", label: "Increase angle" },
						{ name: "decrement", label: "Decrease angle" },
					]}
					onAccessibilityAction={handleAccessibilityAction}
				>
					<Animated.View style={[styles.ruler, ruler]}>
						{ticks.map((tick) => (
							<View
								key={tick}
								style={[
									styles.tick,
									{ left: tick * PX_PER_DEGREE },
									tick % MAJOR === 0 && styles.majorTick,
								]}
							/>
						))}
					</Animated.View>
					<View style={[styles.indicator, { left: width / 2 - 1 }]} />
				</View>
			</GestureDetector>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: "center",
		gap: 2,
	},
	readout: {
		fontSize: 12,
		fontWeight: "600",
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	readoutActive: {
		color: colors.accent,
	},
	// Tall enough to grab comfortably, though the ticks are short.
	track: {
		alignSelf: "stretch",
		height: 36,
		overflow: "hidden",
	},
	ruler: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 0,
	},
	tick: {
		position: "absolute",
		top: 12,
		width: 1,
		height: 12,
		backgroundColor: colors.textSecondary,
	},
	majorTick: {
		top: 8,
		height: 20,
		backgroundColor: colors.textPrimary,
	},
	indicator: {
		position: "absolute",
		top: 4,
		width: 2,
		height: 28,
		borderRadius: 1,
		backgroundColor: colors.accent,
	},
});
