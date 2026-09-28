import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, HEADER_HEIGHT, webTransition } from "@/theme";
import { interaction } from "./interaction";

/**
 * Top bar with a Back action, an optional centered title, and an optional
 * trailing action. `backLabel` names where Back goes, when that says more
 * than "Back". Without `onBack`, the title takes Back's place, as in a
 * tool's header: centered, it could run into a phone's Reset, undo, and redo.
 */
export function ScreenHeader({
	title,
	backLabel = "Back",
	onBack,
	action,
}: {
	title?: string;
	backLabel?: string;
	onBack?: () => void;
	action?: ReactNode;
}) {
	const heading = title ? (
		<Text style={styles.title} numberOfLines={1} accessibilityRole="header">
			{title}
		</Text>
	) : null;
	return (
		<View style={styles.container}>
			{onBack ? (
				<>
					{heading && <View style={styles.titleContainer}>{heading}</View>}
					<BackButton label={backLabel} onPress={onBack} />
				</>
			) : (
				(heading ?? <View />)
			)}
			{action}
		</View>
	);
}

function BackButton({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={6}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.back,
					webTransition,
					hovered && styles.backHovered,
					pressed && styles.backPressed,
				];
			}}
		>
			<Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
			<Text style={styles.backLabel}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		height: HEADER_HEIGHT,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
	},
	// Centered on the whole bar rather than the space left of Back.
	titleContainer: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		pointerEvents: "none",
	},
	title: {
		fontFamily: fonts.display,
		fontSize: 26,
		color: colors.textPrimary,
	},
	// The chevron's own side bearing does for the highlight's left padding.
	back: {
		flexDirection: "row",
		alignItems: "center",
		height: 36,
		paddingLeft: 4,
		paddingRight: 12,
		marginLeft: -6,
		borderRadius: 18,
	},
	backHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	backPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	backLabel: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
	},
});
