import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Image, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { HeaderButton } from "../components/HeaderButton";
import { colors } from "../components/theme";

export default function Page() {
	const [image, setImage] = useState<string | null>(null);

	const pickImage = async () => {
		const permissionResult =
			await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (!permissionResult.granted) {
			Alert.alert(
				"Permission required",
				"Permission to access the media library is required.",
			);
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 1,
		});

		if (!result.canceled) {
			setImage(result.assets[0].uri);
		}
	};

	const notReady = () =>
		Alert.alert("Coming soon", "This tool isn't wired up yet.");

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="light-content" />
			{image ? (
				<EditorScreen
					image={image}
					onBack={() => setImage(null)}
					onDone={notReady}
					onAddText={notReady}
					onExport={notReady}
				/>
			) : (
				<WelcomeScreen onPickImage={pickImage} />
			)}
		</SafeAreaView>
	);
}

function WelcomeScreen({ onPickImage }: { onPickImage: () => void }) {
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

function EditorScreen({
	image,
	onBack,
	onDone,
	onAddText,
	onExport,
}: {
	image: string;
	onBack: () => void;
	onDone: () => void;
	onAddText: () => void;
	onExport: () => void;
}) {
	return (
		<View style={styles.editor}>
			<View style={styles.editorHeader}>
				<HeaderButton label="Back" onPress={onBack} />
				<HeaderButton label="Done" accent onPress={onDone} />
			</View>

			<View style={styles.canvasArea}>
				<Image
					source={{ uri: image }}
					style={styles.canvasImage}
					resizeMode="contain"
				/>
			</View>

			<View style={styles.editorToolbar}>
				<Button label="Text" onPress={onAddText} />
				<Button label="Export" variant="primary" onPress={onExport} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},

	// Welcome
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

	// Editor
	editor: {
		flex: 1,
	},
	editorHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	canvasArea: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
	},
	canvasImage: {
		width: "100%",
		height: "100%",
		borderRadius: 12,
	},
	editorToolbar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
});
