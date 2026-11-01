import { useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	Platform,
	type StyleProp,
	StyleSheet,
	TextInput,
	View,
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
	const field = useNormalizedDrag(
		(x, y) => change({ ...latest.current, saturation: x, value: 1 - y }),
		end,
	);

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
				<ColorSliderBar
					value={hsv.hue / 360}
					thumbColor={pure}
					background={styles.hues}
					onMove={(x) => change({ ...latest.current, hue: x * 360 })}
					onEnd={end}
					accessibilityLabel="Hue"
					accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.hue) }}
					accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
					onAccessibilityAction={adjustHue}
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
	accessibilityActions?: { name: "increment" | "decrement" }[];
	onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
	style?: StyleProp<ViewStyle>;
};

/**
 * 1D slider bar for hue or tone picking.
 * Uses normalized drag gesture and places a circular thumb along the track.
 */
export function ColorSliderBar({
	value,
	thumbColor,
	background,
	onMove,
	onEnd,
	accessibilityLabel,
	accessibilityValue,
	accessibilityActions,
	onAccessibilityAction,
	style,
}: ColorSliderBarProps) {
	const drag = useNormalizedDrag((x) => onMove(x), onEnd);
	return (
		<GestureDetector gesture={drag.gesture}>
			<View
				onLayout={drag.onLayout}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={accessibilityValue}
				accessibilityActions={accessibilityActions}
				onAccessibilityAction={onAccessibilityAction}
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
 * Reports finger location across a view from (0, 0) to (1, 1).
 * Runs on the JS thread and commits on pan finalize.
 */
export function useNormalizedDrag(
	onMove: (x: number, y: number) => void,
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
