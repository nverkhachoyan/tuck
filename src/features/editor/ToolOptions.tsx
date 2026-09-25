import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { PenTip } from "@/model/document";
import { colors, radii } from "@/theme";
import { GlassView } from "@/ui/GlassView";

/**
 * A tool's options, in a card over the canvas, `bottomInset` up from its
 * bottom, just above the dock. A tap anywhere else on the canvas closes it,
 * rather than drawing.
 */
export function ToolOptions({
	closeLabel,
	bottomInset,
	onClose,
	children,
}: {
	closeLabel: string;
	bottomInset: number;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<Animated.View
			entering={FadeIn.duration(120)}
			exiting={FadeOut.duration(100)}
			style={StyleSheet.absoluteFill}
		>
			{/* Behind the card, not around it: on web, a click on the card would
				bubble up to it and close the card. */}
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onClose}
				accessibilityLabel={closeLabel}
			/>
			<View style={[styles.cardArea, { bottom: bottomInset + 10 }]}>
				<GlassView style={styles.card} contentStyle={styles.cardContent}>
					{children}
				</GlassView>
			</View>
		</Animated.View>
	);
}

/**
 * One of the card's options: its name, then its choices under it, which
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
	cardArea: {
		position: "absolute",
		left: 10,
		right: 10,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	card: {
		borderRadius: radii.extraLarge,
	},
	cardContent: {
		gap: 6,
		paddingHorizontal: 20,
		paddingVertical: 10,
	},
	option: {
		gap: 2,
	},
	optionLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	choices: {
		flexDirection: "row",
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
