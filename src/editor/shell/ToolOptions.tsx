import { createContext, type ReactNode, useContext, useEffect } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ColorSliderBar } from "@/ui/ColorPicker";
import { RingChoice } from "@/ui/RingChoice";
import { colors, radii, space, typography } from "@/ui/theme";
import type { PenEnds, PenTip } from "../layers/drawing/drawing";
import { BarChip } from "./ContextBar";

// The dock's widest, so a tray lines up with the dock it rises out of.
const TRAY_MAX_WIDTH = 520;

/**
 * Told the open tray's height, or 0 once it closes, so the canvas can fit
 * the document above it rather than behind it.
 */
export const TrayHeight = createContext<(height: number) => void>(() => {});

/**
 * A panel rising out of the dock, which sits `bottomInset` up from the
 * canvas's bottom. It's opaque, so it reads the same over any photo, and
 * the canvas refits above it (see `TrayHeight`). By default, a tap anywhere
 * else closes it rather than reaching the canvas. Canvas tools can let that
 * tap through, then close the tray after the gesture finishes.
 */
export function Tray({
	bottomInset,
	rightInset = 0,
	dismissLabel,
	onDismiss,
	dismissOnOutsidePress = true,
	children,
}: {
	bottomInset: number;
	rightInset?: number;
	dismissLabel?: string;
	onDismiss?: () => void;
	dismissOnOutsidePress?: boolean;
	children: ReactNode;
}) {
	const setHeight = useContext(TrayHeight);
	useEffect(() => () => setHeight(0), [setHeight]);
	return (
		<View style={styles.layer}>
			{/* Behind the tray, not around it: on web, a click on the tray would
			    bubble up to it and close the tray. */}
			{dismissOnOutsidePress && onDismiss && (
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={onDismiss}
					accessibilityLabel={dismissLabel}
				/>
			)}
			<View
				style={[
					styles.trayArea,
					{ bottom: bottomInset, paddingRight: rightInset },
				]}
			>
				<Animated.View
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(100)}
					style={styles.tray}
					onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
				>
					{children}
				</Animated.View>
			</View>
		</View>
	);
}

export function ToolOptions({
	closeLabel,
	bottomInset,
	rightInset,
	onClose,
	dismissOnOutsidePress,
	children,
}: {
	closeLabel: string;
	bottomInset: number;
	rightInset?: number;
	onClose: () => void;
	dismissOnOutsidePress?: boolean;
	children: ReactNode;
}) {
	return (
		<Tray
			bottomInset={bottomInset}
			rightInset={rightInset}
			dismissLabel={closeLabel}
			onDismiss={onClose}
			dismissOnOutsidePress={dismissOnOutsidePress}
		>
			<View style={styles.options}>{children}</View>
		</Tray>
	);
}

/**
 * One of the tray's options: its name, then its choices under it, which
 * leaves a phone room for a row of seven swatches.
 */
export function ToolOption({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<View style={styles.option}>
			<Text style={styles.optionLabel}>{label}</Text>
			{children}
		</View>
	);
}

/** A row of `RingChoice`s, lined up with the color swatches. */
export function ToolChoices({
	nowrap = false,
	children,
}: {
	nowrap?: boolean;
	children: ReactNode;
}) {
	return (
		<View style={[styles.choices, nowrap && styles.choicesNowrap]}>
			{children}
		</View>
	);
}

/**
 * The five brush sizes, as dots. `color` is null for an eraser, whose dot is
 * an outline, and `tip` squarens a marker's or glows a neon's. `nowrap` keeps
 * them on one line, for a bar that scrolls instead of wrapping.
 */
export function SizeChoices({
	index,
	color,
	tip,
	nowrap = false,
	onPick,
}: {
	index: number;
	color: string | null;
	tip?: PenTip;
	nowrap?: boolean;
	onPick: (index: number) => void;
}) {
	return (
		<ToolChoices nowrap={nowrap}>
			{SIZE_DOTS.map((dot, choice) => (
				<RingChoice
					key={dot}
					label={`Size ${choice + 1} of ${SIZE_DOTS.length}`}
					selected={choice === index}
					onPress={() => onPick(choice)}
				>
					<SizeDot size={dot} color={color} tip={tip} />
				</RingChoice>
			))}
		</ToolChoices>
	);
}

// Each brush size's dot, in points: its order, not its true width.
export const SIZE_DOTS = [4, 7, 11, 16, 22];

/**
 * The current brush size in the wide editor's bar: a dot in ink, opening the
 * five sizes. `children` is more choices in that popover, such as a brush's
 * edge, and can take `close` (see `BarChip`). `[` and `]` still step the
 * size, and the tooltip says so.
 */
export function SizeChip({
	index,
	color,
	tip,
	onPick,
	children,
}: {
	index: number;
	color: string | null;
	tip?: PenTip;
	onPick: (index: number) => void;
	children?: ReactNode | ((close: () => void) => ReactNode);
}) {
	const size = SIZE_DOTS[index] ?? SIZE_DOTS[0];
	return (
		<BarChip
			label={`Size ${index + 1} of ${SIZE_DOTS.length}`}
			text="Size"
			shortcut="[ ]"
			glyph={
				<SizeDot
					size={size}
					color={color === null ? null : colors.textPrimary}
				/>
			}
		>
			{(close) => (
				<View style={styles.chipChoices}>
					<SizeChoices
						nowrap
						index={index}
						color={color}
						tip={tip}
						onPick={(picked) => {
							onPick(picked);
							close();
						}}
					/>
					{typeof children === "function" ? children(close) : children}
				</View>
			)}
		</BarChip>
	);
}

/**
 * A brush's tip: filled with its color, or an outline for an eraser.
 * - `tip`: a marker's or highlighter's is squarer, and a neon pen's glows.
 * - `ends`: how square a marker's or highlighter's is.
 * - `opacity`: the ink's; a marker's defaults to see-through.
 */
export function SizeDot({
	size,
	color,
	tip,
	ends = "rounded",
	opacity,
}: {
	size: number;
	color: string | null;
	tip?: PenTip;
	ends?: PenEnds;
	opacity?: number;
}) {
	const squared = color !== null && (tip === "marker" || tip === "ink");
	const corner =
		ends === "square" ? size / 10 : ends === "rounded" ? size / 4 : size / 2;
	return (
		<View
			style={[
				styles.dot,
				{ width: size, height: size, borderRadius: size / 2 },
				color === null
					? styles.eraserDot
					: { backgroundColor: color, borderColor: colors.borderStrong },
				squared && { borderRadius: corner },
				color !== null &&
					(opacity !== undefined
						? { opacity }
						: tip === "ink" && { opacity: 0.6 }),
				color !== null &&
					tip === "neon" && {
						borderColor: colors.textPrimary,
						boxShadow: `0 0 ${Math.max(4, size / 2)}px ${color}`,
					},
			]}
		/>
	);
}

/**
 * A tool option set by dragging, 0–1 along a bar, with its value written
 * after it. It reports each move (`onMove`) and when the finger lifts
 * (`onEnd`); screen readers and, on web, the arrow keys step it (`onStep`).
 * - `track` is the bar's background, plain unless given.
 * - `thumbColor` fills its thumb.
 * - `showLabel` writes `label` before it, in a tray, where it then takes
 *   one row rather than a label's and its own.
 */
export function ToolSlider({
	label,
	showLabel = false,
	value,
	min = 0,
	now,
	valueText,
	thumbColor,
	track,
	onMove,
	onEnd,
	onStep,
}: {
	label: string;
	showLabel?: boolean;
	value: number;
	min?: number;
	now?: number;
	valueText: string;
	thumbColor: string;
	track?: ViewStyle;
	onMove: (value: number) => void;
	onEnd: () => void;
	onStep: (step: 1 | -1) => void;
}) {
	return (
		<View style={styles.slider}>
			{showLabel && <Text style={styles.sliderLabel}>{label}</Text>}
			<View style={styles.sliderBar}>
				<ColorSliderBar
					value={value}
					thumbColor={thumbColor}
					background={[styles.track, track]}
					onMove={onMove}
					onEnd={onEnd}
					accessibilityLabel={label}
					accessibilityValue={{
						min,
						max: 100,
						now: now ?? Math.round(value * 100),
						text: valueText,
					}}
					onStep={onStep}
				/>
			</View>
			<Text style={styles.sliderValue}>{valueText}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	// Plain views pass touches through where there's no tray; Reanimated's
	// animated view would drop `box-none` on web.
	layer: {
		...StyleSheet.absoluteFill,
		pointerEvents: "box-none",
	},
	trayArea: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	tray: {
		width: "100%",
		maxWidth: TRAY_MAX_WIDTH,
		borderTopLeftRadius: radii.large,
		borderTopRightRadius: radii.large,
		borderWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: 0,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	options: {
		gap: 6,
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 10,
	},
	option: {
		gap: 2,
	},
	optionLabel: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	choices: {
		flexDirection: "row",
		flexWrap: "wrap",
		// As the swatches do, so the rows' first choices line up.
		marginHorizontal: -9,
	},
	choicesNowrap: {
		flexWrap: "nowrap",
		marginHorizontal: 0,
	},
	chipChoices: {
		gap: space.sm,
	},
	dot: {
		borderWidth: StyleSheet.hairlineWidth,
	},
	eraserDot: {
		borderWidth: 1.5,
		borderColor: colors.textPrimary,
	},
	slider: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: 36,
	},
	// It grows to fill a tray, and keeps a usable width in a popover, which
	// is only as wide as its content.
	sliderBar: {
		flexGrow: 1,
		minWidth: 180,
	},
	track: {
		backgroundColor: colors.surfaceHover,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	sliderLabel: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	sliderValue: {
		...typography.label,
		minWidth: 44,
		textAlign: "right",
		color: colors.textSecondary,
		fontVariant: ["tabular-nums"],
	},
});
