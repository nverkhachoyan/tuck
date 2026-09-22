import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { pickPhotoDocument } from "@/import/pickPhoto";
import { showAlert } from "@/lib/showAlert";
import { useStore } from "@/store";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";

export default function WelcomeRoute() {
	const openDocument = useStore((state) => state.openDocument);
	const closeDocument = useStore((state) => state.closeDocument);
	const router = useRouter();
	// Picking plus re-encoding a large photo takes a few seconds; a second tap
	// meanwhile would open the editor twice.
	const [opening, setOpening] = useState(false);

	// Coming back here, however the editor was left, ends that document.
	useFocusEffect(useCallback(() => closeDocument(), [closeDocument]));

	const handleChoosePhoto = async () => {
		if (opening) return;
		setOpening(true);
		try {
			const result = await pickPhotoDocument();
			if (result.status === "picked") {
				openDocument(result.document);
				router.push("/editor");
			}
		} catch (error) {
			showAlert("Couldn't open photo", String(error));
		} finally {
			setOpening(false);
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
				label={opening ? "Opening…" : "Choose Photo"}
				variant="primary"
				size="large"
				disabled={opening}
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
