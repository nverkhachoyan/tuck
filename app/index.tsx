import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { EditorCanvas } from "../components/EditorCanvas";
import { HeaderButton } from "../components/HeaderButton";
import { colors } from "../components/theme";
import { TextEditPanel } from "../components/TextEditPanel";
import {
	createDocumentFromImage,
	createTextLayer,
	type EditorDocument,
	type TextLayer,
} from "../lib/editor-document";
import { normalizePickedImage } from "../lib/normalize-picked-image";

export default function Page() {
	const [doc, setDoc] = useState<EditorDocument | null>(null);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

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
			const asset = result.assets[0];
			const normalized = await normalizePickedImage(asset.uri);
			setDoc(
				createDocumentFromImage(
					normalized.uri,
					normalized.width,
					normalized.height,
				),
			);
		}
	};

	const notReady = () =>
		Alert.alert("Coming soon", "This tool isn't wired up yet.");

	const addTextLayer = () => {
		if (!doc) return;
		const layer = createTextLayer(doc.width / 2, doc.height / 2);
		setDoc({ ...doc, layers: [...doc.layers, layer] });
		setSelectedLayerId(layer.id);
	};

	const updateSelectedLayer = (patch: Partial<TextLayer>) => {
		if (!doc || !selectedLayerId) return;
		setDoc({
			...doc,
			layers: doc.layers.map((layer) =>
				layer.type === "text" && layer.id === selectedLayerId
					? { ...layer, ...patch }
					: layer,
			),
		});
	};

	const deleteSelectedLayer = () => {
		if (!doc || !selectedLayerId) return;
		setDoc({
			...doc,
			layers: doc.layers.filter((layer) => layer.id !== selectedLayerId),
		});
		setSelectedLayerId(null);
	};

	const selectedLayer = doc?.layers.find(
		(layer): layer is TextLayer =>
			layer.type === "text" && layer.id === selectedLayerId,
	);

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="light-content" />
			{doc ? (
				<EditorScreen
					document={doc}
					selectedLayer={selectedLayer}
					onSelectLayer={setSelectedLayerId}
					onBack={() => setDoc(null)}
					onDone={notReady}
					onAddText={addTextLayer}
					onExport={notReady}
					onChangeText={(text) => updateSelectedLayer({ text })}
					onChangeFontSize={(fontSize) => updateSelectedLayer({ fontSize })}
					onChangeColor={(color) => updateSelectedLayer({ color })}
					onDeleteLayer={deleteSelectedLayer}
					onDeselect={() => setSelectedLayerId(null)}
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
	document,
	selectedLayer,
	onSelectLayer,
	onBack,
	onDone,
	onAddText,
	onExport,
	onChangeText,
	onChangeFontSize,
	onChangeColor,
	onDeleteLayer,
	onDeselect,
}: {
	document: EditorDocument;
	selectedLayer: TextLayer | undefined;
	onSelectLayer: (id: string | null) => void;
	onBack: () => void;
	onDone: () => void;
	onAddText: () => void;
	onExport: () => void;
	onChangeText: (text: string) => void;
	onChangeFontSize: (fontSize: number) => void;
	onChangeColor: (color: string) => void;
	onDeleteLayer: () => void;
	onDeselect: () => void;
}) {
	return (
		<View style={styles.editor}>
			<View style={styles.editorHeader}>
				<HeaderButton label="Back" onPress={onBack} />
				<HeaderButton label="Done" accent onPress={onDone} />
			</View>

			<View style={styles.canvasArea}>
				<EditorCanvas
					document={document}
					selectedLayerId={selectedLayer?.id ?? null}
					onSelectLayer={onSelectLayer}
				/>
			</View>

			{selectedLayer ? (
				<TextEditPanel
					layer={selectedLayer}
					onChangeText={onChangeText}
					onChangeFontSize={onChangeFontSize}
					onChangeColor={onChangeColor}
					onDelete={onDeleteLayer}
					onDone={onDeselect}
				/>
			) : (
				<View style={styles.editorToolbar}>
					<Button label="Text" onPress={onAddText} />
					<Button label="Export" variant="primary" onPress={onExport} />
				</View>
			)}
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
		padding: 16,
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
