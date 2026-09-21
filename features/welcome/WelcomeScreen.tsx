import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { colors } from "@/theme";

export function WelcomeScreen({ onPickImage }: { onPickImage: () => void }) {
	return (
		<View style={styles.welcome}>
			<View style={styles.welcomeContent}>
				<View style={styles.logoMark} />
				<Text style={styles.title}>Photo Editor</Text>
				<Text style={styles.subtitle}>
					Open a photo, make your edit, and share it. No account, no waiting.
				</Text>
			</View>

			<Button
				label="Choose Photo"
				variant="primary"
				size="large"
				onPress={onPickImage}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	welcome: {
		flex: 1,
		justifyContent: "space-between",
		paddingHorizontal: 24,
		paddingVertical: 32,
	},
	welcomeContent: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	logoMark: {
		width: 56,
		height: 56,
		borderRadius: 16,
		backgroundColor: colors.accent,
		marginBottom: 12,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	subtitle: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 280,
		lineHeight: 21,
	},
});
