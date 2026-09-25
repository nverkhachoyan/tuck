import { useMemo, useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	StyleSheet,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { type Hsv, hexToHsv, hsvToHex } from "@/lib/color";
import { colors } from "@/theme";
import { gradientBackground, HUE_GRADIENT } from "@/ui/gradient";

const FIELD_HEIGHT = 120;
const BAR_HEIGHT = 24;
const THUMB = 24;
// How far one step of a screen reader's adjust moves the hue, in degrees.
const HUE_STEP = 10;

/**
 * Any color, picked from a field of the hue's shades (saturation across,
 * brightness down) and a bar of hues under it. It fills its parent's width.
 *
 * `onChange` follows the finger, for a preview; `onChangeEnd` has the color
 * the finger left, for what's worth keeping, like a brush's color, so
 * dragging doesn't redraw the editor on every move. `value` can change
 * from outside too: the picker then shows it.
 */
export function ColorPicker({
	value,
	onChange,
	onChangeEnd,
}: {
	value: string;
	onChange: (color: string) => void;
	onChangeEnd: (color: string) => void;
}) {
	// The picker keeps HSV, not just `value`: a gray has no hue, and dragging
	// through white or black would otherwise lose it.
	const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? RED);
	const [shown, setShown] = useState(value);
	if (value !== shown) {
		setShown(value);
		if (value !== hsvToHex(hsv)) setHsv(hexToHsv(value, hsv.hue) ?? hsv);
	}

	// A drag can move more than once between renders, so its moves build on
	// the latest color rather than the rendered one.
	const latest = useRef(hsv);
	latest.current = hsv;
	const change = (next: Hsv) => {
		const color = hsvToHex(next);
		latest.current = next;
		setHsv(next);
		setShown(color);
		onChange(color);
	};
	const end = () => onChangeEnd(hsvToHex(latest.current));
	const field = useDrag(
		(x, y) => change({ ...latest.current, saturation: x, value: 1 - y }),
		end,
	);
	const bar = useDrag((x) => change({ ...latest.current, hue: x * 360 }), end);

	const adjustHue = (event: AccessibilityActionEvent) => {
		const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
		const hue = Math.min(360, Math.max(0, hsv.hue + step * HUE_STEP));
		change({ ...hsv, hue });
		onChangeEnd(hsvToHex({ ...hsv, hue }));
	};

	const pure = hsvToHex({ hue: hsv.hue, saturation: 1, value: 1 });
	const color = hsvToHex(hsv);
	return (
		<View style={styles.picker}>
			<GestureDetector gesture={field.gesture}>
				<View
					onLayout={field.onLayout}
					accessible
					accessibilityLabel="Saturation and brightness"
					accessibilityValue={{ text: color }}
					style={[styles.field, { backgroundColor: pure }]}
				>
					<View style={[styles.fill, styles.whiteAcross]} />
					<View style={[styles.fill, styles.blackDown]} />
					<View
						style={[
							styles.thumb,
							{
								left: `${hsv.saturation * 100}%`,
								top: `${(1 - hsv.value) * 100}%`,
								backgroundColor: color,
							},
						]}
					/>
				</View>
			</GestureDetector>
			<GestureDetector gesture={bar.gesture}>
				<View
					onLayout={bar.onLayout}
					accessible
					accessibilityRole="adjustable"
					accessibilityLabel="Hue"
					accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.hue) }}
					accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
					onAccessibilityAction={adjustHue}
					style={[styles.bar, styles.hues]}
				>
					<View
						style={[
							styles.thumb,
							styles.barThumb,
							{ left: `${(hsv.hue / 360) * 100}%`, backgroundColor: pure },
						]}
					/>
				</View>
			</GestureDetector>
		</View>
	);
}

const RED: Hsv = { hue: 0, saturation: 1, value: 1 };

/**
 * A drag across a view, reported as where the finger is, each from 0 to 1
 * across and down the view, from touch-down to lift. A tap counts too. It
 * runs on the JS thread: it only moves the picker's own state.
 */
function useDrag(onMove: (x: number, y: number) => void, onEnd: () => void) {
	const size = useRef({ width: 1, height: 1 });
	const handlers = useRef({ onMove, onEnd });
	handlers.current = { onMove, onEnd };
	const gesture = useMemo(() => {
		const move = (x: number, y: number) => {
			const { width, height } = size.current;
			handlers.current.onMove(
				Math.min(1, Math.max(0, x / width)),
				Math.min(1, Math.max(0, y / height)),
			);
		};
		// On iOS a pan only activates once the finger moves, but a tap still
		// begins and finalizes it.
		return Gesture.Pan()
			.runOnJS(true)
			.minDistance(0)
			.onBegin((event) => move(event.x, event.y))
			.onUpdate((event) => move(event.x, event.y))
			.onFinalize(() => handlers.current.onEnd());
	}, []);
	const onLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		size.current = { width: Math.max(1, width), height: Math.max(1, height) };
	};
	return { gesture, onLayout };
}

const styles = StyleSheet.create({
	picker: {
		alignSelf: "stretch",
		gap: 14,
		paddingTop: 6,
		paddingBottom: 4,
	},
	field: {
		height: FIELD_HEIGHT,
		borderRadius: 10,
	},
	fill: {
		...StyleSheet.absoluteFill,
		borderRadius: 10,
	},
	// Explicitly white and black at no opacity: a gradient to `transparent`
	// can pass through gray.
	whiteAcross: gradientBackground(
		"linear-gradient(to right, #FFFFFF, rgba(255, 255, 255, 0))",
	),
	blackDown: gradientBackground(
		"linear-gradient(to bottom, rgba(0, 0, 0, 0), #000000)",
	),
	bar: {
		height: BAR_HEIGHT,
		borderRadius: BAR_HEIGHT / 2,
	},
	hues: gradientBackground(HUE_GRADIENT),
	thumb: {
		position: "absolute",
		width: THUMB,
		height: THUMB,
		marginLeft: -THUMB / 2,
		marginTop: -THUMB / 2,
		borderRadius: THUMB / 2,
		borderWidth: 3,
		borderColor: colors.textPrimary,
		boxShadow: "0 1px 4px rgba(0, 0, 0, 0.5)",
	},
	barThumb: {
		top: "50%",
	},
});
