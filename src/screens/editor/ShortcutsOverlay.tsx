import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { PanelHeader } from "@/ui/BottomSheet";
import { Surface } from "@/ui/Surface";
import { formatShortcut } from "@/ui/Tooltip";
import { colors, radii, space, typography } from "@/ui/theme";
import { SHORTCUT_GROUPS } from "./shortcuts";

/**
 * Every keyboard shortcut, in a card over the editor, opened with ?. A
 * click outside it, Escape, or ? again closes it.
 */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
	return (
		<Animated.View
			entering={FadeIn.duration(140)}
			exiting={FadeOut.duration(100)}
			style={styles.overlay}
		>
			{/* Behind the card, not around it: on web, a click on the card would
			    bubble up to it and close the card. */}
			<Pressable
				style={[StyleSheet.absoluteFill, styles.scrim]}
				onPress={onClose}
				accessibilityLabel="Close shortcuts"
			/>
			<Surface style={styles.card} contentStyle={styles.cardContent}>
				<PanelHeader
					title="Keyboard shortcuts"
					closeLabel="Close shortcuts"
					onClose={onClose}
				/>
				<ScrollView contentContainerStyle={styles.groups}>
					{SHORTCUT_GROUPS.map(({ title, items }) => (
						<View key={title} style={styles.group}>
							<Text style={styles.groupTitle}>{title}</Text>
							{items.map(({ keys, action }) => (
								<View key={keys + action} style={styles.row}>
									<Text style={styles.action}>{action}</Text>
									<Text style={styles.keys}>{formatShortcut(keys)}</Text>
								</View>
							))}
						</View>
					))}
				</ScrollView>
			</Surface>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		zIndex: 20,
		alignItems: "center",
		justifyContent: "center",
		padding: space.lg,
	},
	scrim: {
		backgroundColor: colors.scrim,
	},
	card: {
		width: "100%",
		maxWidth: 560,
		maxHeight: "100%",
		borderRadius: radii.large,
	},
	cardContent: {
		flexShrink: 1,
	},
	// Two columns where there's room, one on a narrow window.
	groups: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.lg,
		padding: space.lg,
	},
	group: {
		flexGrow: 1,
		flexBasis: 220,
		gap: space.xs,
	},
	groupTitle: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: space.sm,
	},
	action: {
		...typography.label,
		flexShrink: 1,
		color: colors.textPrimary,
	},
	keys: {
		...typography.labelStrong,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
});
