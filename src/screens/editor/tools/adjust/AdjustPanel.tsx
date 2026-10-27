import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
	useAnimatedReaction,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { type AdjustmentKey, adjustmentKeys } from "@/model/adjustments";
import { Chip } from "@/ui/Chip";
import { colors, radii, space, typography } from "@/ui/theme";
import { Dial } from "../../shell/Dial";
import {
	ADJUST_DIAL_MAX,
	ADJUST_DIAL_SCALE,
	type AdjustController,
} from "./useAdjustTool";

const LABELS: Record<AdjustmentKey, string> = {
	brightness: "Brightness",
	contrast: "Contrast",
	saturation: "Saturation",
	temperature: "Warmth",
};

const CHIP_HEIGHT = 30;

const signed = (steps: number) => (steps > 0 ? `+${steps}` : `${steps}`);

/**
 * The Adjust tool's dock panel: a choice of adjustment, each marked while
 * the image's adjustments change it, over the dial that changes the chosen one, which
 * a sideways drag over the photo turns too. While it changes, its value
 * shows large just above the dock. The inspector passes `floatingValue` false
 * and heads the section with the value instead.
 */
export function AdjustPanel({
	controller,
	floatingValue = true,
}: {
	controller: AdjustController;
	floatingValue?: boolean;
}) {
	const { adjustments, chosen, choose } = controller;
	const label = LABELS[chosen];
	return (
		<View style={[styles.panel, floatingValue && styles.panelFill]}>
			{floatingValue && <ChangingValue controller={controller} label={label} />}
			<View style={styles.choices}>
				{adjustmentKeys.map((key) => (
					<AdjustmentChoice
						key={key}
						label={LABELS[key]}
						selected={key === chosen}
						changed={(adjustments?.[key] ?? 0) !== 0}
						onPress={() => choose(key)}
					/>
				))}
			</View>
			<Dial
				// A fresh dial per adjustment, so a drag never carries over.
				key={chosen}
				value={controller.dialValue}
				max={ADJUST_DIAL_MAX}
				scale={ADJUST_DIAL_SCALE}
				label={label}
				increaseLabel={`Increase ${label.toLowerCase()}`}
				decreaseLabel={`Decrease ${label.toLowerCase()}`}
				readout={signed}
				valueText={signed}
				onBegin={controller.begin}
				onChange={controller.change}
				onEnd={controller.end}
			/>
		</View>
	);
}

/**
 * Adjust on a wide screen: the chosen adjustment's name and value head the
 * section, then the same choices and dial, above the layers. The bar only
 * names the tool. The section's height follows that content.
 */
export function AdjustInspector({
	controller,
	children,
}: {
	controller: AdjustController;
	children: ReactNode;
}) {
	return (
		<View style={styles.inspectorStack}>
			<View style={styles.section}>
				<AdjustHeading controller={controller} />
				<AdjustPanel controller={controller} floatingValue={false} />
			</View>
			{children}
		</View>
	);
}

/** The chosen adjustment and its value, live as the dial moves. */
function AdjustHeading({ controller }: { controller: AdjustController }) {
	const { adjustments } = controller;
	const label = LABELS[controller.chosen];
	// The saved value, for the moment a choice changes. A reaction already
	// watching the dial can miss that, since the dial's shared value is stable.
	const settled = Math.round(
		(adjustments?.[controller.chosen] ?? 0) * ADJUST_DIAL_MAX,
	);
	const [steps, setSteps] = useState(settled);
	const [tracked, setTracked] = useState(controller.chosen);
	if (tracked !== controller.chosen) {
		setTracked(controller.chosen);
		setSteps(settled);
	}
	useAnimatedReaction(
		() => Math.round(controller.dialValue.value),
		(shown, previous) => {
			if (shown !== previous) scheduleOnRN(setSteps, shown);
		},
	);
	return (
		<View style={styles.heading} accessibilityRole="header">
			<Text style={styles.headingName}>{label}</Text>
			<Text style={styles.headingValue}>{signed(steps)}</Text>
		</View>
	);
}

/** The chosen adjustment's value, large over the canvas while it changes. */
function ChangingValue({
	controller,
	label,
}: {
	controller: AdjustController;
	label: string;
}) {
	const { dialValue, changing } = controller;
	const [steps, setSteps] = useState(0);
	useAnimatedReaction(
		() => Math.round(dialValue.value),
		(shown, previous) => {
			if (shown !== previous) scheduleOnRN(setSteps, shown);
		},
	);
	const style = useAnimatedStyle(() => ({
		opacity: withTiming(changing.value ? 1 : 0, {
			duration: changing.value ? 100 : 240,
		}),
	}));
	return (
		<View style={styles.changingArea}>
			<Animated.View style={[styles.changing, style]}>
				<Text style={styles.changingLabel}>{label}</Text>
				<Text style={styles.changingValue}>{signed(steps)}</Text>
			</Animated.View>
		</View>
	);
}

/** An adjustment's name as a chip, with a dot while it's changed. */
function AdjustmentChoice({
	label,
	selected,
	changed,
	onPress,
}: {
	label: string;
	selected: boolean;
	changed: boolean;
	onPress: () => void;
}) {
	return (
		<Chip
			selected={selected}
			onPress={onPress}
			accessibilityLabel={changed ? `${label}, changed` : label}
			// To a 44pt target.
			hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
			frameStyle={styles.choice}
		>
			<Text
				style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}
			>
				{label}
			</Text>
			{changed && (
				<View style={[styles.changed, selected && styles.changedSelected]} />
			)}
		</Chip>
	);
}

const styles = StyleSheet.create({
	// Lowered a little: the highlight's tilt reaches above the chips, and the
	// dial's ticks stop short of its track's foot.
	panel: {
		justifyContent: "center",
		paddingHorizontal: 12,
		paddingTop: 4,
		gap: 8,
	},
	// The dock's slot has a fixed height. The inspector's section follows
	// its content, where a flexing child would collapse on native.
	panelFill: {
		flex: 1,
	},
	// Just above the dock, over the canvas, touching nothing.
	changingArea: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: "100%",
		alignItems: "center",
		paddingBottom: 12,
		pointerEvents: "none",
	},
	changing: {
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: radii.medium,
		backgroundColor: colors.scrim,
	},
	changingLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	changingValue: {
		...typography.figure,
		color: colors.textPrimary,
	},
	choices: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 4,
	},
	choice: {
		height: CHIP_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		borderCurve: "continuous",
	},
	choiceLabel: {
		...typography.label,
		color: colors.textPrimary,
	},
	// The same weight as the rest, so choosing one doesn't shift the row.
	choiceLabelSelected: {
		color: colors.onHighlight,
	},
	changed: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: colors.primary,
	},
	changedSelected: {
		backgroundColor: colors.onHighlight,
	},
	inspectorStack: {
		flex: 1,
	},
	section: {
		paddingBottom: space.xs,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	heading: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.xs,
		paddingHorizontal: 20,
		paddingTop: space.sm,
		paddingBottom: space.xxs,
	},
	headingName: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	headingValue: {
		...typography.figure,
		color: colors.textPrimary,
	},
});
