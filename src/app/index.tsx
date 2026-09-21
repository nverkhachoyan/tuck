import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { useEditor } from "@/editor/state/EditorProvider";
import { colors } from "@/theme";

export default function WelcomeRoute() {
	const { pickImage } = useEditor();
	const router = useRouter();

	const handlePickImage = async () => {
		if (await pickImage()) router.push("/editor");
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
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
				onPress={handlePickImage}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "space-between",
		paddingHorizontal: 24,
		paddingVertical: 32,
	},
	content: {
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
