import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "@/theme";

/**
 * The checkerboard that stands for transparency, filling its parent: one
 * repeating gradient, where native lays out a view per square.
 */
export function CheckerFill({
	cell,
}: {
	width: number;
	height: number;
	cell: number;
}) {
	return (
		<View
			style={[
				styles.fill,
				// React Native's style types lack background images, which only
				// web has.
				{
					backgroundImage: `repeating-conic-gradient(${colors.checkerDark} 0% 25%, ${colors.checkerLight} 0% 50%)`,
					backgroundSize: `${cell * 2}px ${cell * 2}px`,
				} as unknown as ViewStyle,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	fill: {
		...StyleSheet.absoluteFill,
	},
});
