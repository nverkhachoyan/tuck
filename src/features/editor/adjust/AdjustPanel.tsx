import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
	type AdjustmentKey,
	type Adjustments,
	adjustmentKeys,
} from "@/model/adjustments";
import { colors, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";
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
				readout={(steps) => `${label} ${signed(steps)}`}
				valueText={signed}
				onBegin={controller.begin}
				onChange={controller.change}
				onEnd={controller.end}
			/>
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
	const { anchor, tooltip } = useTooltip(label);
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={4}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={changed ? `${label}, changed` : label}
				accessibilityState={{ selected }}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.choice,
						webTransition,
						hovered && styles.choiceHovered,
						selected && styles.choiceSelected,
						pressed && styles.choicePressed,
					];
				}}
			>
				<MaterialCommunityIcons
					name={icon}
					size={20}
					color={selected ? colors.textPrimary : colors.textSecondary}
				/>
				{changed && <View style={styles.changed} />}
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	panel: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 12,
		gap: 4,
	},
	choices: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 14,
	},
	choice: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.glassControl,
	},
	choiceHovered: {
		backgroundColor: colors.glassControlHover,
	},
	choiceSelected: {
		backgroundColor: colors.chosenSoft,
	},
	choicePressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	changed: {
		position: "absolute",
		top: 3,
		right: 3,
		width: 7,
		height: 7,
		borderRadius: 3.5,
		backgroundColor: colors.accent,
	},
});
