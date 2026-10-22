import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
	useAnimatedReaction,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
	type AdjustmentKey,
	type Adjustments,
	adjustmentKeys,
} from "@/model/adjustments";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { colors, radii, typography, webTransition } from "@/ui/theme";
import { Dial } from "../controls/Dial";
import {
	ADJUST_DIAL_MAX,
	ADJUST_DIAL_SCALE,
	type AdjustController,
} from "./useAdjustController";

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
 * `adjustments` changes it, over the dial that changes the chosen one, which
 * a sideways drag over the photo turns too. While it changes, its value
 * shows large just above the dock.
 */
export function AdjustPanel({
	controller,
	adjustments,
}: {
	controller: AdjustController;
	adjustments: Adjustments | undefined;
}) {
	const { chosen, choose } = controller;
	const label = LABELS[chosen];
	return (
		<View style={styles.panel}>
			<ChangingValue controller={controller} label={label} />
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
		<Pressable
			// To a 44pt target.
			hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={changed ? `${label}, changed` : label}
			accessibilityState={{ selected }}
		>
			{(state) => {
				const { pressed, hovered } = interaction(state);
				return (
					<View
						style={[
							styles.choice,
							webTransition,
							hovered && styles.choiceHovered,
							pressed && styles.choicePressed,
						]}
					>
						{selected && <Highlight />}
						<Text
							style={[
								styles.choiceLabel,
								selected && styles.choiceLabelSelected,
							]}
						>
							{label}
						</Text>
						{changed && (
							<View
								style={[styles.changed, selected && styles.changedSelected]}
							/>
						)}
					</View>
				);
			}}
		</Pressable>
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
		borderRadius: radii.small,
		borderCurve: "continuous",
	},
	choiceHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	choicePressed: {
		transform: [{ scale: 0.96 }],
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
});
