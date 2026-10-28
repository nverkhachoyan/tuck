import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, Text } from "react-native";
import { interaction } from "@/ui/interaction";
import { Surface } from "@/ui/Surface";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";

export function FitButton({ onPress }: { onPress: () => void }) {
	const { anchor, tooltip } = useTooltip("Zoom to fit", "mod+0");
	return (
		<>
			<Surface style={styles.fitPill}>
				<Pressable
					{...anchor}
					hitSlop={8}
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel="Zoom to fit"
					style={(state) => {
						const { pressed, hovered } = interaction(state);
						return [
							styles.fitButton,
							webTransition,
							hovered && styles.fitHovered,
							pressed && styles.fitPressed,
						];
					}}
				>
					<MaterialCommunityIcons
						name="fit-to-screen-outline"
						size={18}
						color={colors.textPrimary}
					/>
					<Text style={styles.fitLabel}>Fit</Text>
				</Pressable>
			</Surface>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	fitPill: {
		borderRadius: radii.medium,
	},
	fitButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xxs + 2,
		paddingVertical: space.xs,
		paddingLeft: space.sm - 2,
		paddingRight: space.sm,
	},
	fitHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	fitPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	fitLabel: {
		...typography.label,
		color: colors.textPrimary,
	},
});
