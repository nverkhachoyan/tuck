import { Canvas, Image } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	type LayoutChangeEvent,
	Linking,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useEditor } from "@/editor/state/EditorProvider";
import {
	canShareImages,
	saveImage,
	saveLabels,
	shareImage,
} from "@/export/saveImage";
import { useRenderedDocument } from "@/export/useRenderedDocument";
import { showAlert } from "@/lib/showAlert";
import type { EditorDocument } from "@/model/document";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default function ExportRoute() {
	const { document } = useEditor();

	// The stack guard unmounts this route once the document closes.
	if (!document) return null;

	return <ExportScreen document={document} />;
}

function ExportScreen({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const { state, retry } = useRenderedDocument(document);
	const [busy, setBusy] = useState<"saving" | "sharing" | null>(null);
	const [saved, setSaved] = useState(false);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [canShare] = useState(canShareImages);

	const handleLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setSize({ width, height });
	};

	const handleSave = async () => {
		if (state.status !== "ready") return;
		setBusy("saving");
		try {
			const result = await saveImage(state.image);
			if (result.status === "saved") {
				setSaved(true);
			} else {
				showAlert(
					"Photos access needed",
					"Allow this app to add photos in Settings to save your edit.",
					[
						{ text: "Cancel", style: "cancel" },
						{ text: "Open Settings", onPress: () => Linking.openSettings() },
					],
				);
			}
		} catch (error) {
			showAlert("Save failed", String(error));
		} finally {
			setBusy(null);
		}
	};

	const handleShare = async () => {
		if (state.status !== "ready") return;
		setBusy("sharing");
		try {
			if (!(await shareImage(state.image))) {
				showAlert("Sharing unavailable", "This device can't share files.");
			}
		} catch (error) {
			showAlert("Share failed", String(error));
		} finally {
			setBusy(null);
		}
	};

	return (
		<View style={styles.container}>
			<ScreenHeader title="Export" onBack={() => router.back()} />

			<View style={styles.previewArea}>
				{/* Canvas has no onLayout on Fabric, so measure a wrapper instead. */}
				<View style={styles.preview} onLayout={handleLayout}>
					<Canvas style={styles.preview}>
						{state.status === "ready" && (
							<Image
								image={state.image}
								fit="contain"
								x={0}
								y={0}
								width={size.width}
								height={size.height}
							/>
						)}
					</Canvas>
				</View>

				{state.status === "rendering" && (
					<View style={styles.overlay}>
						<ActivityIndicator color={colors.textSecondary} />
						<Text style={styles.status}>Preparing full-size image…</Text>
					</View>
				)}
				{state.status === "failed" && (
					<View style={styles.overlay}>
						<Text style={styles.status}>Couldn't render the image.</Text>
						<Button label="Try Again" onPress={retry} />
					</View>
				)}
			</View>

			<View style={styles.footer}>
				<Text style={styles.details}>
					{document.width} × {document.height} · JPEG
				</Text>
				<Button
					label={
						saved
							? saveLabels.done
							: busy === "saving"
								? saveLabels.busy
								: saveLabels.idle
					}
					variant="primary"
					size="large"
					disabled={state.status !== "ready" || busy !== null || saved}
					onPress={handleSave}
				/>
				{/* Most desktop browsers can't share files. */}
				{canShare && (
					<Button
						label={busy === "sharing" ? "Opening…" : "Share"}
						size="large"
						disabled={state.status !== "ready" || busy !== null}
						onPress={handleShare}
					/>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	previewArea: {
		flex: 1,
		padding: 16,
	},
	preview: {
		flex: 1,
	},
	overlay: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	status: {
		fontSize: 15,
		color: colors.textSecondary,
	},
	footer: {
		gap: 12,
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 24,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	details: {
		fontSize: 13,
		color: colors.textSecondary,
		textAlign: "center",
	},
});
