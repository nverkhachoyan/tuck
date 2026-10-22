import { createContext, type ReactNode, useContext, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { PenTip } from "@/model/document";
import { colors, radii, typography } from "@/ui/theme";

// The dock's widest, so a tray lines up with the dock it rises out of.
const TRAY_MAX_WIDTH = 520;

/**
 * Told the open tray's height, or 0 once it closes, so the canvas can fit
 * the document above it rather than behind it.
 */
export const TrayHeight = createContext<(height: number) => void>(() => {});

/**
 * Where trays go on a wide screen: into the inspector, `top` down its
 * `width`-wide column, rather than on the dock.
 */
export const TrayPlacement = createContext<{
	top: number;
	width: number;
} | null>(null);

/**
 * A panel rising out of the dock, which sits `bottomInset` up from the
 * canvas's bottom. It's opaque, so it reads the same over any photo, and
 * the canvas refits above it (see `TrayHeight`). By default, a tap anywhere
 * else closes it rather than reaching the canvas. Canvas tools can let that
 * tap through, then close the tray after the gesture finishes.
 */
export function Tray({
	bottomInset,
	dismissLabel,
	onDismiss,
	dismissOnOutsidePress = true,
	children,
}: {
	bottomInset: number;
	dismissLabel?: string;
	onDismiss?: () => void;
	dismissOnOutsidePress?: boolean;
	children: ReactNode;
}) {
	const setHeight = useContext(TrayHeight);
	const placement = useContext(TrayPlacement);
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
				style={
					placement
						? [
								styles.inspectorArea,
								{ top: placement.top, width: placement.width },
							]
						: [styles.trayArea, { bottom: bottomInset }]
				}
			>
				<Animated.View
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(100)}
					style={placement ? styles.inspectorTray : styles.tray}
					onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
				>
					{children}
				</Animated.View>
			</View>
		</View>
	);
}

/** A tool's options, in a tray. */
export function ToolOptions({
	closeLabel,
	bottomInset,
	onClose,
	dismissOnOutsidePress,
	children,
}: {
	closeLabel: string;
	bottomInset: number;
	onClose: () => void;
	dismissOnOutsidePress?: boolean;
	children: ReactNode;
}) {
	return (
		<Tray
			bottomInset={bottomInset}
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
export function ToolChoices({ children }: { children: ReactNode }) {
	return <View style={styles.choices}>{children}</View>;
}

// Each brush size's dot, in points: its order, not its true width.
export const SIZE_DOTS = [4, 7, 11, 16, 22];

/**
 * A brush's tip: filled with its color, or an outline for an eraser. A
 * marker's is squarer and see-through, and a neon pen's glows.
 */
export function SizeDot({
	size,
	color,
	tip,
}: {
	size: number;
	color: string | null;
	tip?: PenTip;
}) {
	return (
		<View
			style={[
				styles.dot,
				{ width: size, height: size, borderRadius: size / 2 },
				color === null
					? styles.eraserDot
					: { backgroundColor: color, borderColor: colors.borderStrong },
				color !== null &&
					tip === "marker" && { borderRadius: size / 4, opacity: 0.6 },
				color !== null &&
					tip === "neon" && {
						borderColor: colors.textPrimary,
						boxShadow: `0 0 ${Math.max(4, size / 2)}px ${color}`,
					},
			]}
		/>
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
	inspectorArea: {
		position: "absolute",
		right: 0,
		pointerEvents: "box-none",
	},
	// Part of the inspector's column, under its panel.
	inspectorTray: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
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
	dot: {
		borderWidth: StyleSheet.hairlineWidth,
	},
	eraserDot: {
		borderWidth: 1.5,
		borderColor: colors.textPrimary,
	},
});
