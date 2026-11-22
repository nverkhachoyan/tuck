import { StyleSheet, Text, View } from "react-native";
import { Chip } from "@/ui/Chip";
import { colors, space, typography } from "@/ui/theme";
import { neutralMaskEdge } from "../../layers/image/mask";
import {
	EDGE_FIELDS,
	EDGE_SCALE,
	EdgeControls,
	EdgeSlider,
} from "../../shell/EdgeControls";
import type { EdgeController } from "./useEdgeTool";

const CHIP_HEIGHT = 30;

/**
 * The Edge tool's phone dock panel: three parameter chips (each marked with an
 * ink dot while changed) over the chosen parameter's slider, sized to fit the
 * 100pt dock cleanly like `AdjustPanel`.
 */
export function EdgePanel({ controller }: { controller: EdgeController }) {
	const { edge, chosen, choose, setEdge } = controller;
	const current = edge ?? neutralMaskEdge;
	const field =
		EDGE_FIELDS.find((item) => item.key === chosen) ?? EDGE_FIELDS[0];
	const steps = Math.round(current[field.key] * EDGE_SCALE);

	return (
		<View style={styles.panel}>
			<View style={styles.choices}>
				{EDGE_FIELDS.map((item) => {
					const selected = item.key === chosen;
					const changed = current[item.key] !== 0;
					return (
						<Chip
							key={item.key}
							selected={selected}
							onPress={() => choose(item.key)}
							accessibilityLabel={
								changed ? `${item.label}, changed` : item.label
							}
							hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
							frameStyle={styles.choice}
						>
							<Text
								style={[
									styles.choiceLabel,
									selected && styles.choiceLabelSelected,
								]}
							>
								{item.label}
							</Text>
							{changed && (
								<View
									style={[styles.changed, selected && styles.changedSelected]}
								/>
							)}
						</Chip>
					);
				})}
			</View>
			{setEdge && (
				<EdgeSlider
					key={field.key}
					inline
					field={field}
					steps={steps}
					onChange={(nextSteps, coalesce) =>
						setEdge(
							{ ...current, [field.key]: nextSteps / EDGE_SCALE },
							coalesce,
						)
					}
				/>
			)}
		</View>
	);
}

/**
 * The Edge tool's floating card on a wide window: all three sliders visible at
 * once over the live composite (the context bar holds the title, Reset, ✕, ✓).
 */
export function EdgeCard({ controller }: { controller: EdgeController }) {
	const { edge, setEdge } = controller;
	if (!setEdge) return null;
	return (
		<View style={styles.card}>
			<EdgeControls edge={edge} onChange={setEdge} showHeader={false} />
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: space.md,
		gap: space.xs,
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
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
	},
});
