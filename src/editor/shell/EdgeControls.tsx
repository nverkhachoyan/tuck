import { useRef } from "react";
import {
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	Platform,
	StyleSheet,
	Text,
	View,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { compactControls } from "@/ui/density";
import { TextButton } from "@/ui/TextButton";
import { colors, space, typography } from "@/ui/theme";
import {
	type MaskEdge,
	type MaskEdgeKey,
	neutralMaskEdge,
} from "../layers/image/mask";

// Bipolar sliders snap gently to 0 when dragged close to the middle.
const ZERO_SNAP = 2;
export const EDGE_SCALE = 100;
const TRACK_HEIGHT = 4;
const THUMB = compactControls ? 16 : 20;
const HIT_HEIGHT = compactControls ? 28 : 34;

export type EdgeField = {
	key: MaskEdgeKey;
	label: string;
	min: number;
	max: number;
	signed: boolean;
};

export const EDGE_FIELDS: readonly EdgeField[] = [
	{ key: "smooth", label: "Smooth", min: 0, max: 100, signed: false },
	{ key: "shift", label: "Shift edge", min: -100, max: 100, signed: true },
	{ key: "feather", label: "Feather", min: 0, max: 100, signed: false },
];

type WebKeyDownEvent = {
	nativeEvent: { key: string; shiftKey?: boolean };
	preventDefault: () => void;
	stopPropagation: () => void;
};

export const formatEdgeValue = (steps: number, signed: boolean) =>
	signed && steps > 0 ? `+${steps}` : `${steps}`;

/**
 * Smooth, Shift edge, and Feather sliders for refining a mask or image edge,
 * shared by Cut's popover/tray and the standalone Edge tool's wide card.
 * - Drags coalesce into one undo step; taps, arrow keys, and Reset record one.
 * - Pressing Home or 0 on web returns a focused slider to 0.
 */
export function EdgeControls({
	edge,
	onChange,
	onReset,
	wide = false,
	showHeader = true,
}: {
	edge: MaskEdge | undefined;
	onChange: (edge: MaskEdge, coalesce?: boolean) => void;
	onReset?: () => void;
	wide?: boolean;
	showHeader?: boolean;
}) {
	const current = edge ?? neutralMaskEdge;
	const latest = useRef(current);
	latest.current = current;

	return (
		<View style={[styles.container, wide && styles.wide]}>
			{showHeader && (
				<View style={styles.header}>
					<Text style={styles.title}>Refine edge</Text>
					{onReset && <TextButton label="Reset" onPress={onReset} />}
				</View>
			)}
			{EDGE_FIELDS.map((field) => {
				const steps = Math.round(current[field.key] * EDGE_SCALE);
				return (
					<EdgeSlider
						key={field.key}
						field={field}
						steps={steps}
						onChange={(nextSteps, coalesce) => {
							const next = {
								...latest.current,
								[field.key]: nextSteps / EDGE_SCALE,
							};
							latest.current = next;
							onChange(next, coalesce);
						}}
					/>
				);
			})}
		</View>
	);
}

/**
 * One edge slider with optional label/value header above it, or inline
 * readout beside it for compact single-slider panels (the phone Edge dock).
 */
export function EdgeSlider({
	field,
	steps,
	onChange,
	inline = false,
}: {
	field: EdgeField;
	steps: number;
	onChange: (steps: number, coalesce?: boolean) => void;
	inline?: boolean;
}) {
	const { label, min, max, signed } = field;
	const widthRef = useRef(1);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const stepsRef = useRef(steps);
	stepsRef.current = steps;

	const stepsAt = (x: number, snapZero: boolean) => {
		const fraction = Math.min(1, Math.max(0, x / widthRef.current));
		const raw = Math.round(min + fraction * (max - min));
		if (snapZero && signed && Math.abs(raw) <= ZERO_SNAP) return 0;
		return Math.min(max, Math.max(min, raw));
	};

	const started = useRef(false);
	const gesture = usePanGesture({
		runOnJS: true,
		minDistance: 0,
		onBegin: (event) => {
			started.current = false;
			const next = stepsAt(event.x, false);
			if (next !== stepsRef.current) {
				started.current = true;
				onChangeRef.current(next, false);
			}
		},
		onUpdate: (event) => {
			const next = stepsAt(event.x, true);
			if (next !== stepsRef.current) {
				onChangeRef.current(next, started.current);
				started.current = true;
			}
		},
	});

	const nudge = (delta: number) => {
		const next = Math.min(max, Math.max(min, steps + delta));
		if (next !== steps) onChange(next, false);
	};

	const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
		if (event.nativeEvent.actionName === "increment") nudge(5);
		else if (event.nativeEvent.actionName === "decrement") nudge(-5);
	};

	const handleKeyDown = (event: WebKeyDownEvent) => {
		const { key, shiftKey } = event.nativeEvent;
		const delta = shiftKey ? 5 : 1;
		if (key === "ArrowRight" || key === "ArrowUp") nudge(delta);
		else if (key === "ArrowLeft" || key === "ArrowDown") nudge(-delta);
		else if (key === "Home" || key === "0") {
			if (steps !== 0) onChange(0, false);
		} else return;
		event.preventDefault();
		event.stopPropagation();
	};

	const webKeyProps =
		Platform.OS === "web"
			? ({ onKeyDown: handleKeyDown } as unknown as ViewProps)
			: undefined;

	const fraction = (steps - min) / (max - min);
	const zeroFraction = signed ? (0 - min) / (max - min) : 0;
	const fillLeft = Math.min(zeroFraction, fraction) * 100;
	const fillWidth = Math.abs(fraction - zeroFraction) * 100;
	const text = formatEdgeValue(steps, signed);

	const track = (
		<GestureDetector gesture={gesture}>
			<View
				{...webKeyProps}
				onLayout={(event: LayoutChangeEvent) => {
					widthRef.current = Math.max(1, event.nativeEvent.layout.width);
				}}
				accessible
				focusable
				accessibilityRole="adjustable"
				accessibilityLabel={label}
				accessibilityValue={{ min, max, now: steps, text }}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={steps}
				aria-valuetext={text}
				accessibilityActions={[
					{ name: "increment", label: `Increase ${label.toLowerCase()}` },
					{ name: "decrement", label: `Decrease ${label.toLowerCase()}` },
				]}
				onAccessibilityAction={handleAccessibilityAction}
				hitSlop={{ left: THUMB / 2, right: THUMB / 2, top: 6, bottom: 6 }}
				style={[styles.sliderArea, inline && styles.sliderGrow, webPointer]}
			>
				<View style={styles.track}>
					{signed && <View style={styles.zeroTick} />}
					<View
						style={[
							styles.fill,
							{ left: `${fillLeft}%`, width: `${fillWidth}%` },
						]}
					/>
				</View>
				<View style={[styles.thumb, { left: `${fraction * 100}%` }]} />
			</View>
		</GestureDetector>
	);

	if (inline) {
		return (
			<View style={styles.inlineRow}>
				{track}
				<Text
					style={[
						styles.value,
						styles.inlineValue,
						steps !== 0 && styles.valueChanged,
					]}
				>
					{text}
				</Text>
			</View>
		);
	}

	return (
		<View style={styles.row}>
			<View style={styles.rowHeader}>
				<Text style={styles.label}>{label}</Text>
				<Text style={[styles.value, steps !== 0 && styles.valueChanged]}>
					{text}
				</Text>
			</View>
			{track}
		</View>
	);
}

const webPointer =
	Platform.OS === "web"
		? ({ cursor: "pointer" } as unknown as ViewStyle)
		: undefined;

const styles = StyleSheet.create({
	container: {
		alignSelf: "stretch",
		gap: space.xs,
	},
	wide: {
		minWidth: 260,
		padding: space.xxs,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	title: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	row: {
		gap: 2,
	},
	rowHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	label: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	value: {
		...typography.label,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	valueChanged: {
		color: colors.textPrimary,
	},
	inlineRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	inlineValue: {
		minWidth: 36,
		textAlign: "right",
	},
	sliderArea: {
		height: HIT_HEIGHT,
		justifyContent: "center",
		marginHorizontal: THUMB / 2,
	},
	sliderGrow: {
		flex: 1,
	},
	track: {
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		backgroundColor: colors.borderStrong,
		justifyContent: "center",
	},
	zeroTick: {
		position: "absolute",
		left: "50%",
		width: 2,
		height: 10,
		marginLeft: -1,
		borderRadius: 1,
		backgroundColor: colors.borderStrong,
	},
	fill: {
		position: "absolute",
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		backgroundColor: colors.primary,
	},
	thumb: {
		position: "absolute",
		width: THUMB,
		height: THUMB,
		marginLeft: -THUMB / 2,
		borderRadius: THUMB / 2,
		borderWidth: 2,
		borderColor: colors.primary,
		backgroundColor: colors.surface,
		boxShadow: `0 1px 3px ${colors.shadow}`,
	},
});
