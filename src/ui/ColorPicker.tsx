import { useMemo, useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	Platform,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { gradientBackground, HUE_GRADIENT } from "./gradient";
import { type Hsv, hexToHsv, hsvToHex, parseTypedHex } from "./hsv";
import { IconButton } from "./IconButton";
import { colors, radii, typography } from "./theme";

// As wide as a row of seven swatches, so a picker on its own in a card is
// the size of one under them.
const MIN_WIDTH = 290;
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
 * from outside too: the picker then shows it. With `onEyedropper`, a
 * button beside the hues sets out to pick a color from the canvas instead.
 */
export function ColorPicker({
	value,
	onChange,
	onChangeEnd,
	onEyedropper,
}: {
	value: string;
	onChange?: (color: string) => void;
	onChangeEnd: (color: string) => void;
	onEyedropper?: () => void;
}) {
	// The picker keeps HSV, not just `value`: a gray has no hue, and dragging
	// through white or black would otherwise lose it.
	const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? RED);
	// Only a change to `value` itself moves the picker: while a drag is under
	// way, `value` is still the color before it, unless `onChange` feeds it.
	const [lastValue, setLastValue] = useState(value);
	if (value !== lastValue) {
		setLastValue(value);
		if (value !== hsvToHex(hsv)) setHsv(hexToHsv(value, hsv.hue) ?? hsv);
	}

	// A drag can move more than once between renders, so its moves build on
	// the latest color rather than the rendered one.
	const latest = useRef(hsv);
	latest.current = hsv;
	const change = (next: Hsv) => {
		latest.current = next;
		setHsv(next);
		onChange?.(hsvToHex(next));
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
	const pickTyped = (hex: string) => {
		const next = hexToHsv(hex, hsv.hue);
		if (!next) return;
		change(next);
		onChangeEnd(hex);
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
			<View style={styles.row}>
				{onEyedropper && (
					<IconButton
						icon="eyedrop-outline"
						label="Pick a color from the canvas"
						onPress={onEyedropper}
					/>
				)}
				<GestureDetector gesture={bar.gesture}>
					<View
						onLayout={bar.onLayout}
						accessible
						accessibilityRole="adjustable"
						accessibilityLabel="Hue"
						accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.hue) }}
						accessibilityActions={[
							{ name: "increment" },
							{ name: "decrement" },
						]}
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
				{Platform.OS === "web" && <HexField color={color} onPick={pickTyped} />}
			</View>
		</View>
	);
}

/**
 * The color's hex code, to read or type over, on web: a desktop has the
 * keyboard for it, where on a phone the keyboard would cover the picker.
 * It picks what's typed on Enter or once it loses focus, and puts back the
 * picker's color if that isn't a color.
 */
function HexField({
	color,
	onPick,
}: {
	color: string;
	onPick: (hex: string) => void;
}) {
	// What's typed, until it's picked; the picker's color otherwise.
	const [typed, setTyped] = useState<string | null>(null);
	const pick = () => {
		if (typed === null) return;
		const hex = parseTypedHex(typed);
		if (hex && hex !== color) onPick(hex);
		setTyped(null);
	};
	return (
		<TextInput
			value={typed ?? color}
			onChangeText={setTyped}
			onSubmitEditing={pick}
			onBlur={pick}
			selectTextOnFocus
			autoCapitalize="characters"
			autoCorrect={false}
			spellCheck={false}
			maxLength={7}
			accessibilityLabel="Hex color"
			style={styles.hex}
		/>
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
		minWidth: MIN_WIDTH,
		gap: 14,
		paddingTop: 6,
		paddingBottom: 4,
	},
	field: {
		height: FIELD_HEIGHT,
		borderRadius: radii.small,
	},
	fill: {
		...StyleSheet.absoluteFill,
		borderRadius: radii.small,
	},
	// Explicitly white and black at no opacity: a gradient to `transparent`
	// can pass through gray.
	whiteAcross: gradientBackground(
		"linear-gradient(to right, #FFFFFF, rgba(255, 255, 255, 0))",
	),
	blackDown: gradientBackground(
		"linear-gradient(to bottom, rgba(0, 0, 0, 0), #000000)",
	),
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
	},
	bar: {
		flex: 1,
		height: BAR_HEIGHT,
		borderRadius: BAR_HEIGHT / 2,
	},
	hex: {
		...typography.label,
		width: 84,
		height: 30,
		paddingHorizontal: 8,
		borderRadius: radii.small,
		backgroundColor: colors.surfaceHover,
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
		textAlign: "center",
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
