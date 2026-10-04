import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useState } from "react";
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
import {
	chosenOutline,
	colors,
	radii,
	typography,
	webTransition,
} from "@/theme";
import { interaction } from "@/ui/interaction";
import { Dial, type DialScale } from "../Dial";
import { ADJUST_DIAL_MAX, type AdjustController } from "./useAdjustController";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const ADJUSTMENTS: Record<AdjustmentKey, { label: string; icon: IconName }> = {
	brightness: { label: "Brightness", icon: "brightness-6" },
	contrast: { label: "Contrast", icon: "contrast-circle" },
	saturation: { label: "Saturation", icon: "water-outline" },
	temperature: { label: "Warmth", icon: "thermometer" },
};

// A percent a step, with a tick every 5 and a long one every 25, settling on
// 0 from 2 away.
const PERCENT: DialScale = {
	step: 1,
	pxPerStep: 3,
	tickEvery: 5,
	majorEvery: 25,
	snap: 2,
	wholeSteps: true,
};

const signed = (steps: number) => (steps > 0 ? `+${steps}` : `${steps}`);

/**
 * The Adjust tool's dock panel: a choice of adjustment, each marked while
 * `adjustments` changes it, over the dial that changes the chosen one.
 * While the dial moves, its value shows large just above the dock.
 */
export function AdjustPanel({
	controller,
	adjustments,
}: {
	controller: AdjustController;
	adjustments: Adjustments | undefined;
}) {
	const { chosen, choose } = controller;
	const { label } = ADJUSTMENTS[chosen];
	return (
		<View style={styles.panel}>
			<ChangingValue controller={controller} label={label} />
			<View style={styles.choices}>
				{adjustmentKeys.map((key) => (
					<AdjustmentChoice
						key={key}
						adjustment={key}
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
				scale={PERCENT}
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

function AdjustmentChoice({
	adjustment,
	selected,
	changed,
	onPress,
}: {
	adjustment: AdjustmentKey;
	selected: boolean;
	changed: boolean;
	onPress: () => void;
}) {
	const { label, icon } = ADJUSTMENTS[adjustment];
	return (
		<Pressable
			hitSlop={4}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={changed ? `${label}, changed` : label}
			accessibilityState={{ selected }}
			style={styles.choice}
		>
			{(state) => {
				const { pressed, hovered } = interaction(state);
				return (
					<>
						<View
							style={[
								styles.choiceIcon,
								webTransition,
								hovered && styles.choiceHovered,
								selected && chosenOutline,
								pressed && styles.choicePressed,
							]}
						>
							<MaterialCommunityIcons
								name={icon}
								size={20}
								color={selected ? colors.textPrimary : colors.textSecondary}
							/>
							{changed && <View style={styles.changed} />}
						</View>
						<Text
							style={[
								styles.choiceLabel,
								(selected || hovered) && styles.choiceLabelLit,
							]}
						>
							{label}
						</Text>
					</>
				);
			}}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	panel: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 12,
		gap: 2,
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
		gap: 8,
	},
	choice: {
		minWidth: 64,
		alignItems: "center",
		gap: 2,
	},
	choiceIcon: {
		width: 32,
		height: 28,
		borderRadius: radii.small,
		alignItems: "center",
		justifyContent: "center",
	},
	choiceHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	choicePressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	choiceLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	choiceLabelLit: {
		color: colors.textPrimary,
	},
	changed: {
		position: "absolute",
		top: 1,
		right: 1,
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: colors.primary,
	},
});
