import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "@/theme";
import { Announcement } from "@/ui/Announcement";
import { Button } from "@/ui/Button";
import { Surface } from "@/ui/Surface";

/**
 * Says why edits aren't being saved, across the top of the canvas, with a
 * Retry button when there's `onRetry`. `rightInset` keeps it clear of a
 * sidebar along the canvas's right edge.
 */
export function SaveErrorBanner({
	message,
	onRetry,
	rightInset,
}: {
	message: string;
	onRetry?: () => void;
	rightInset?: number;
}) {
	return (
		<View
			style={[styles.area, rightInset !== undefined && { right: rightInset }]}
		>
			<Announcement message={message} />
			<Surface style={styles.banner} contentStyle={styles.bannerContent}>
				<Ionicons
					name="cloud-offline-outline"
					size={20}
					color={colors.danger}
				/>
				<Text style={styles.message}>{message}</Text>
				{onRetry && <Button label="Retry" size="small" onPress={onRetry} />}
			</Surface>
		</View>
	);
}

const styles = StyleSheet.create({
	// Over the canvas rather than above it, so showing it doesn't resize the
	// canvas mid-gesture.
	area: {
		position: "absolute",
		top: 12,
		left: 12,
		right: 12,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	banner: {
		width: "100%",
		maxWidth: 560,
		borderRadius: radii.medium,
	},
	bannerContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingLeft: 14,
		paddingRight: 8,
		paddingVertical: 8,
	},
	message: {
		...typography.label,
		flex: 1,
		lineHeight: 18,
		color: colors.textPrimary,
	},
});
