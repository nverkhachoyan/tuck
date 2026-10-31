import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
	useAnimatedReaction,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Chip } from "@/ui/Chip";
import { colors, radii, space, typography } from "@/ui/theme";
import {
	type AdjustmentKey,
	adjustmentKeys,
} from "../../layers/image/adjustments";
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
 * shows large just above the dock.
 */
export function AdjustPanel({ controller }: { controller: AdjustController }) {
	return (
		<View style={styles.panel}>
			<ChangingValue
				controller={controller}
				label={LABELS[controller.chosen]}
			/>
			<AdjustChoices controller={controller} />
			<AdjustDial controller={controller} />
		</View>
	);
}

/** The adjustments to choose from, each marked while it's changed. */
function AdjustChoices({ controller }: { controller: AdjustController }) {
	const { adjustments, chosen, choose } = controller;
	return (
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
	);
}

/** The dial that changes the chosen adjustment. */
function AdjustDial({ controller }: { controller: AdjustController }) {
	const label = LABELS[controller.chosen];
	return (
		<Dial
			// A fresh dial per adjustment, so a drag never carries over.
			key={controller.chosen}
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
	);
}

/** Adjust's choices and dial in the wide editor's bottom card. */
export function AdjustCard({ controller }: { controller: AdjustController }) {
	return (
		<View style={styles.card}>
			<AdjustChoices controller={controller} />
			<AdjustDial controller={controller} />
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
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 12,
		paddingTop: 4,
		gap: 8,
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
	// Sized by its content, where a flexing child would collapse on native.
	card: {
		paddingHorizontal: 12,
		paddingTop: space.xs,
		paddingBottom: space.xs,
		gap: 8,
	},
});
