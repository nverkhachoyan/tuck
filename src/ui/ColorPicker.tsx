import { useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	Platform,
	type StyleProp,
	StyleSheet,
	TextInput,
	View,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { gradientBackground, HUE_GRADIENT } from "./gradient";
import { type Hsv, hexToHsv, hsvToHex, parseTypedHex } from "./hsv";
import { IconButton } from "./IconButton";
import { colors, radii, typography } from "./theme";

// Standard widths and heights for color picker controls.
const MIN_WIDTH = 290;
const FIELD_HEIGHT = 120;
const BAR_HEIGHT = 24;
const THUMB = 24;
const HUE_STEP = 10;

/**
 * 2D saturation/brightness field and 1D hue slider for picking colors.
 * - `value`: current hex color `#RRGGBB`.
 * - `onChange`: live color update during drag.
 * - `onChangeEnd`: committed color when touch releases.
 * - `onEyedropper`: optional canvas color picker callback.
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
	const { hsv, latest, change, end, nudge } = useHsvColor(
		value,
		onChange,
		onChangeEnd,
	);
	const field = useNormalizedDrag(
		(x, y) => change({ ...latest.current, saturation: x, value: 1 - y }),
		end,
	);

	const adjustHue = (step: 1 | -1) =>
		nudge({ ...hsv, hue: clampHue(hsv.hue + step * HUE_STEP) });
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
				<ColorSliderBar
					value={hsv.hue / 360}
					thumbColor={pure}
					background={styles.hues}
					onMove={(x) => change({ ...latest.current, hue: x * 360 })}
					onEnd={end}
					accessibilityLabel="Hue"
					accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.hue) }}
					onStep={adjustHue}
					style={styles.grow}
				/>
				{Platform.OS === "web" && <HexField color={color} onPick={pickTyped} />}
			</View>
		</View>
	);
}

export type ColorSliderBarProps = {
	value: number;
	thumbColor: string;
	background: StyleProp<ViewStyle>;
	onMove: (fraction: number) => void;
	onEnd?: () => void;
	accessibilityLabel: string;
	accessibilityValue?: {
		min?: number;
		max?: number;
		now?: number;
		text?: string;
	};
	onStep?: (step: 1 | -1) => void;
	style?: StyleProp<ViewStyle>;
};

type WebKeyDownEvent = {
	nativeEvent: { key: string };
	preventDefault: () => void;
	stopPropagation: () => void;
};

const STEP_ACTIONS = [{ name: "increment" }, { name: "decrement" }] as const;

// How far from the thumb's middle a touch takes hold of it, in pixels.
const THUMB_GRAB = THUMB / 2 + 8;

/**
 * 1D slider bar for hue, tone, or a tool's value, with a circular thumb.
 * - A touch on the thumb drags it from where it is, so a tap or a drag
 *   back to where it began leaves the value as it was; a touch elsewhere
 *   on the track jumps there.
 * - `onStep` steps it from screen readers and, on web, the arrow keys.
 */
export function ColorSliderBar({
	value,
	thumbColor,
	background,
	onMove,
	onEnd,
	accessibilityLabel,
	accessibilityValue,
	onStep,
	style,
}: ColorSliderBarProps) {
	// Where a drag that took hold of the thumb began: its value, and the touch.
	const grab = useRef<{ from: number; at: number } | null>(null);
	const drag = useNormalizedDrag(
		(x, _y, rawX) => {
			const held = grab.current;
			if (held) {
				onMove(Math.min(1, Math.max(0, held.from + (rawX - held.at))));
				return;
			}
			const onThumb =
				Math.abs(rawX - value) * drag.size.current.width <= THUMB_GRAB;
			grab.current = onThumb ? { from: value, at: rawX } : { from: x, at: x };
			if (!onThumb) onMove(x);
		},
		() => {
			grab.current = null;
			onEnd?.();
		},
	);
	const handleKeyDown = (event: WebKeyDownEvent) => {
		const { key } = event.nativeEvent;
		if (key === "ArrowRight" || key === "ArrowUp") onStep?.(1);
		else if (key === "ArrowLeft" || key === "ArrowDown") onStep?.(-1);
		else return;
		event.preventDefault();
		event.stopPropagation();
	};
	const webKeyProps =
		Platform.OS === "web" && onStep
			? ({ focusable: true, onKeyDown: handleKeyDown } as unknown as ViewProps)
			: undefined;
	return (
		<GestureDetector gesture={drag.gesture}>
			<View
				onLayout={drag.onLayout}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				// React Native Web drops `accessibilityValue`; both read these.
				aria-valuemin={accessibilityValue?.min}
				aria-valuemax={accessibilityValue?.max}
				aria-valuenow={accessibilityValue?.now}
				aria-valuetext={accessibilityValue?.text}
				accessibilityActions={onStep ? STEP_ACTIONS : undefined}
				onAccessibilityAction={
					onStep ? (event) => onStep(stepOf(event)) : undefined
				}
				{...webKeyProps}
				style={[styles.bar, background, style]}
			>
				<View
					style={[
						styles.thumb,
						styles.barThumb,
						{
							left: `${Math.min(100, Math.max(0, value * 100))}%`,
							backgroundColor: thumbColor,
						},
					]}
				/>
			</View>
		</GestureDetector>
	);
}

/** Editable hex code field for web viewports. */
function HexField({
	color,
	onPick,
}: {
	color: string;
	onPick: (hex: string) => void;
}) {
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
 * The HSV state behind a custom color control, kept in step with `value`.
 * - `hsv`: what the controls show; a gray from `value` keeps the last hue.
 * - `latest`: the newest color, for gesture callbacks between renders.
 * - `change`: shows a color and reports it to `onChange`.
 * - `end`: commits the newest color to `onChangeEnd`.
 * - `nudge`: changes and commits at once, for accessibility steps.
 */
export function useHsvColor(
	value: string,
	onChange: ((color: string) => void) | undefined,
	onChangeEnd: (color: string) => void,
) {
	const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? RED);
	const [lastValue, setLastValue] = useState(value);
	if (value !== lastValue) {
		setLastValue(value);
		if (value !== hsvToHex(hsv)) setHsv(hexToHsv(value, hsv.hue) ?? hsv);
	}

	const latest = useRef(hsv);
	latest.current = hsv;
	const change = (next: Hsv) => {
		latest.current = next;
		setHsv(next);
		onChange?.(hsvToHex(next));
	};
	const end = () => onChangeEnd(hsvToHex(latest.current));
	const nudge = (next: Hsv) => {
		change(next);
		end();
	};
	return { hsv, latest, change, end, nudge };
}

// +1 for an increment accessibility action, -1 for a decrement.
function stepOf(event: AccessibilityActionEvent): 1 | -1 {
	return event.nativeEvent.actionName === "increment" ? 1 : -1;
}

/** Keeps a hue within 0 to 360 degrees. */
export function clampHue(hue: number): number {
	return Math.min(360, Math.max(0, hue));
}

/**
 * Reports finger location across a view from (0, 0) to (1, 1), then the
 * same unclamped, for a drag measured from where it began.
 * Runs on the JS thread and commits on pan finalize.
 */
export function useNormalizedDrag(
	onMove: (x: number, y: number, rawX: number, rawY: number) => void,
	onEnd?: () => void,
) {
	const size = useRef({ width: 1, height: 1 });
	const handlers = useRef({ onMove, onEnd });
	handlers.current = { onMove, onEnd };
	const move = (x: number, y: number) => {
		const { width, height } = size.current;
		handlers.current.onMove(
			Math.min(1, Math.max(0, x / width)),
			Math.min(1, Math.max(0, y / height)),
			x / width,
			y / height,
		);
	};
	// On iOS a pan only activates once the finger moves, but a tap still
	// begins and finalizes it.
	const gesture = usePanGesture({
		runOnJS: true,
		minDistance: 0,
		onBegin: (event) => move(event.x, event.y),
		onUpdate: (event) => move(event.x, event.y),
		onFinalize: () => handlers.current.onEnd?.(),
	});
	const onLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		size.current = { width: Math.max(1, width), height: Math.max(1, height) };
	};
	return { gesture, onLayout, size };
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
	// Explicitly white and black at zero opacity to avoid gray midpoint.
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
	// No flex here: in a column sized by its content (the text panel's
	// sliders), flex collapses a bar to zero height.
	bar: {
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
	grow: {
		flex: 1,
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
