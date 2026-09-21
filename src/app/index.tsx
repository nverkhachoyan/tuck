import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useEditor } from "@/editor/state/EditorProvider";
import { pickPhotoDocument } from "@/import/pickPhoto";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";

export default function WelcomeRoute() {
	const { openDocument } = useEditor();
	const router = useRouter();

	const handleChoosePhoto = async () => {
		const result = await pickPhotoDocument();
		if (result.status === "picked") {
			openDocument(result.document);
			router.push("/editor");
		} else if (result.status === "permission-denied") {
			Alert.alert(
				"Permission required",
				"Permission to access the media library is required.",
			);
		}
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
				onPress={handleChoosePhoto}
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
