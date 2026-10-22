import { Pressable, StyleSheet, Text, View } from "react-native";
import { Highlight } from "./Highlight";
import { interaction } from "./interaction";
import { colors, radii, space, typography, webTransition } from "./theme";

/**
 * A row of two or three choices, each a name over an optional detail, with
 * the chosen one highlighted. Without a `label` shown above, the row is named
 * by `accessibilityLabel`, as when a heading already names it.
 */
export function Segmented({
	label,
	accessibilityLabel,
	options,
	selected,
	disabled = false,
	onSelect,
}: {
	label?: string;
	accessibilityLabel?: string;
	options: { title: string; detail?: string; accessibilityLabel?: string }[];
	selected: number;
	disabled?: boolean;
	onSelect: (index: number) => void;
}) {
	return (
		<View
			style={styles.segmented}
			accessibilityRole="radiogroup"
			accessibilityLabel={accessibilityLabel ?? label}
		>
			{label && <Text style={styles.label}>{label}</Text>}
			<View style={styles.segments}>
				{options.map(({ title, detail, accessibilityLabel }, index) => {
					const chosen = index === selected;
					return (
						<Pressable
							key={title}
							disabled={disabled}
							onPress={() => onSelect(index)}
							accessibilityRole="radio"
							accessibilityLabel={
								accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)
							}
							accessibilityState={{ checked: chosen, disabled }}
							aria-checked={chosen}
							style={(state) => {
								const { pressed, hovered } = interaction(state);
								return [
									styles.segment,
									webTransition,
									hovered && styles.segmentHovered,
									pressed && styles.segmentPressed,
								];
							}}
						>
							{chosen && <Highlight />}
							<Text style={[styles.title, chosen && styles.titleChosen]}>
								{title}
							</Text>
							{detail && (
								<Text style={[styles.detail, chosen && styles.detailChosen]}>
									{detail}
								</Text>
							)}
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	segmented: {
		gap: space.xs,
	},
	label: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	segments: {
		flexDirection: "row",
		gap: space.xs,
	},
	segment: {
		flex: 1,
		minHeight: 52,
		paddingHorizontal: space.xs,
		paddingVertical: space.xs,
		borderRadius: radii.small,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	segmentHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	segmentPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	title: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	titleChosen: {
		color: colors.onHighlight,
	},
	detail: {
		...typography.caption,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
		textAlign: "center",
	},
	detailChosen: {
		color: colors.onHighlight,
		opacity: 0.6,
	},
});
