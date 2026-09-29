import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { colors, radii, typography } from "@/theme";

/**
 * Covers the screen while files are dragged over it, saying what dropping
 * them does. Pointer events pass through, so the drop reaches the page.
 */
export function DropOverlay({ label }: { label: string }) {
	return (
		<Animated.View
			entering={FadeIn.duration(120)}
			exiting={FadeOut.duration(120)}
			style={styles.overlay}
		>
			<View style={styles.frame}>
				<View style={styles.badge}>
					<Ionicons name="image-outline" size={28} color={colors.accent} />
				</View>
				<Text style={styles.label}>{label}</Text>
			</View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		zIndex: 10,
		padding: 16,
		backgroundColor: colors.scrim,
		pointerEvents: "none",
	},
	frame: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 14,
		borderRadius: radii.large,
		borderWidth: 2,
		borderStyle: "dashed",
		borderColor: colors.accentBorder,
		backgroundColor: colors.accentSoft,
	},
	badge: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accentSoft,
	},
	label: {
		...typography.title,
		color: colors.textPrimary,
	},
});
