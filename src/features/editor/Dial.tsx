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
import { colors, typography } from "@/theme";

/**
 * How a dial's ruler measures its value: `step` is one unit of it, which
 * the readout counts and arrow keys move by, drawn `pxPerStep` apart. A
 * tick marks every `tickEvery` steps, and a long one every `majorEvery`.
 * The value settles on 0 within `snap` steps of it, and with `wholeSteps`
 * it only ever takes whole steps.
 */
export type DialScale = {
	step: number;
	pxPerStep: number;
	tickEvery: number;
	majorEvery: number;
	snap: number;
	wholeSteps?: boolean;
};

type WebKeyDownEvent = {
	nativeEvent: { key: string };
	preventDefault: () => void;
	stopPropagation: () => void;
};

/**
 * A ruler dragged sideways to set a value within ±`max`, like a photo app's
 * straighten or adjustment dial. It settles on 0 with a haptic tick, and a
 * double tap returns it there. `value` is shown, above the ruler as
 * `readout` of its steps, and read out to assistive tech as `valueText`.
 * The callbacks run on the UI thread (they must be worklets), bracketing
 * each change.
 */
export function Dial({
	value,
	max,
	scale,
	label,
	increaseLabel,
	decreaseLabel,
	readout,
	valueText,
	onBegin,
	onChange,
	onEnd,
}: {
	value: DerivedValue<number>;
	max: number;
	scale: DialScale;
	label: string;
	increaseLabel: string;
	decreaseLabel: string;
	readout: (steps: number) => string;
	valueText: (steps: number) => string;
	onBegin: () => void;
	onChange: (value: number) => void;
	onEnd: () => void;
}) {
	const { step, pxPerStep, tickEvery, majorEvery, snap, wholeSteps } = scale;
	const [width, setWidth] = useState(0);
	const [steps, setSteps] = useState(0);
	const start = useSharedValue(0);
	const dragging = useSharedValue(false);
	const maxSteps = Math.round(max / step);

	useAnimatedReaction(
		() => Math.round(value.value / step),
		(shown, previous) => {
			if (shown !== previous) scheduleOnRN(setSteps, shown);
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
				const raw = start.value - (event.translationX / pxPerStep) * step;
				let next = Math.min(max, Math.max(-max, raw));
				if (wholeSteps) next = Math.round(next / step) * step;
				if (Math.abs(next / step) < snap) {
					if (value.value !== 0) scheduleOnRN(hapticTick);
					next = 0;
				}
				onChange(next);
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
	}, [
		value,
		start,
		dragging,
		max,
		step,
		pxPerStep,
		snap,
		wholeSteps,
		onBegin,
		onChange,
		onEnd,
	]);

	const ruler = useAnimatedStyle(() => ({
		transform: [{ translateX: width / 2 - (value.value / step) * pxPerStep }],
	}));

	const ticks = useMemo(() => {
		const last = Math.floor(maxSteps / tickEvery);
		return Array.from(
			{ length: last * 2 + 1 },
			(_, index) => (index - last) * tickEvery,
		);
	}, [maxSteps, tickEvery]);

	// Accessibility actions and web arrow keys originate on the JS thread;
	// run the same worklet callbacks as a gesture on the UI thread.
	const setFromControl = useCallback(
		(target: number) => {
			const next = Math.min(max, Math.max(-max, target));
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
		(direction: 1 | -1) =>
			setFromControl((Math.round(value.value / step) + direction) * step),
		[value, step, setFromControl],
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
			<Text style={[styles.readout, steps !== 0 && styles.readoutActive]}>
				{readout(steps)}
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
						min: -maxSteps,
						max: maxSteps,
						now: steps,
						text: valueText(steps),
					}}
					accessibilityActions={[
						{ name: "increment", label: increaseLabel },
						{ name: "decrement", label: decreaseLabel },
					]}
					onAccessibilityAction={handleAccessibilityAction}
				>
					<Animated.View style={[styles.ruler, ruler]}>
						{ticks.map((tick) => (
							<View
								key={tick}
								style={[
									styles.tick,
									{ left: tick * pxPerStep },
									tick % majorEvery === 0 && styles.majorTick,
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
		...typography.labelStrong,
		fontVariant: ["tabular-nums"],
		color: colors.textPrimary,
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
