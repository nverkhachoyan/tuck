import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
	colors,
	HEADER_HEIGHT,
	space,
	typography,
	webTransition,
} from "@/theme";
import { interaction } from "./interaction";
import { useTooltip } from "./Tooltip";

const BACK_SIZE = 44;

/**
 * Top bar with a Back action, an optional centered title, and an optional
 * trailing action. Back is a chevron; `backLabel` names where it goes, for
 * assistive tech and as its tooltip on web. Without `onBack`, the title, if
 * any, takes Back's place. Crop's header has neither: it covers the editor
 * like a dialog, its name is in the dock's footer, and it keeps only its
 * actions.
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
	const { anchor, tooltip } = useTooltip(label);
	return (
		<>
			<Pressable
				{...anchor}
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
				<Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
			</Pressable>
			{tooltip}
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		height: HEADER_HEIGHT,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: space.md,
	},
	// Centered on the whole bar rather than the space left of Back.
	titleContainer: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		pointerEvents: "none",
	},
	title: {
		...typography.title,
		color: colors.textPrimary,
	},
	// Pulled left so the chevron, not its target, lines up with the edge.
	back: {
		width: BACK_SIZE,
		height: BACK_SIZE,
		marginLeft: -10,
		borderRadius: BACK_SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
	},
	backHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	backPressed: {
		backgroundColor: colors.pressedOverlay,
	},
});
