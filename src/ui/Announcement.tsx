import { useEffect } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	Text,
	View,
} from "react-native";

/**
 * Reads `message` out to a screen reader whenever it changes, and shows
 * nothing. For a change of state that has no focus of its own, such as a scan
 * finishing or a save failing. Native platforms announce it; React Native
 * Web's `announceForAccessibility` does nothing, so on web it's a polite live
 * region, kept in the layout but out of sight.
 */
export function Announcement({ message }: { message: string | null }) {
	useEffect(() => {
		if (Platform.OS !== "web" && message) {
			AccessibilityInfo.announceForAccessibility(message);
		}
	}, [message]);
	if (Platform.OS !== "web") return null;
	return (
		<View style={styles.hidden} accessibilityLiveRegion="polite">
			<Text>{message ?? ""}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	hidden: {
		position: "absolute",
		width: 1,
		height: 1,
		overflow: "hidden",
		opacity: 0,
		pointerEvents: "none",
	},
});
