import { Canvas, Image, rect } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	type LayoutChangeEvent,
	Linking,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { exportFormatFor, exportFormats } from "@/export/exportFormat";
import { exportSizes } from "@/export/exportSizes";
import {
	canShareImages,
	saveImage,
	saveLabels,
	shareImage,
} from "@/export/saveImage";
import { useRenderedDocument } from "@/export/useRenderedDocument";
import { errorMessage } from "@/lib/errorMessage";
import { showAlert } from "@/lib/showAlert";
import type { EditorDocument } from "@/model/document";
import { useStore } from "@/store";
import { colors } from "@/theme";
import { Button } from "@/ui/Button";
import { Checkerboard } from "@/ui/Checkerboard";
import { ScreenHeader } from "@/ui/ScreenHeader";

// A transparency checkerboard square's side, in screen pixels.
const CHECKER_PX = 8;

export default function ExportRoute() {
	const document = useStore((state) => state.document);

	if (!document) return null;

	return <ExportScreen document={document} />;
}

function ExportScreen({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const sizes = useMemo(() => exportSizes(document), [document]);
	const [sizeIndex, setSizeIndex] = useState(0);
	const exportSize = sizes[Math.min(sizeIndex, sizes.length - 1)];
	const format = exportFormatFor(document);
	const { state, retry } = useRenderedDocument(document, exportSize.scale);
	const [busy, setBusy] = useState<"saving" | "sharing" | null>(null);
	const [saved, setSaved] = useState(false);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [canShare] = useState(canShareImages);
	// Where the image lands in the preview, fitted and centered.
	const fit = Math.min(
		size.width / exportSize.width,
		size.height / exportSize.height,
	);
	const imageBounds = rect(
		(size.width - exportSize.width * fit) / 2,
		(size.height - exportSize.height * fit) / 2,
		exportSize.width * fit,
		exportSize.height * fit,
	);

	// A different size is a different file, which hasn't been saved yet.
	const pickSize = (index: number) => {
		setSizeIndex(index);
		setSaved(false);
	};

	const handleLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setSize({ width, height });
	};

	const handleSave = async () => {
		if (state.status !== "ready") return;
		setBusy("saving");
		try {
			const result = await saveImage(state.image, format);
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
			showAlert("Save failed", errorMessage(error));
		} finally {
			setBusy(null);
		}
	};

	const handleShare = async () => {
		if (state.status !== "ready") return;
		setBusy("sharing");
		try {
			if (!(await shareImage(state.image, format))) {
				showAlert("Sharing unavailable", "This device can't share files.");
			}
		} catch (error) {
			showAlert("Share failed", errorMessage(error));
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
						{state.status === "ready" && format === "png" && (
							<Checkerboard bounds={imageBounds} cell={CHECKER_PX} />
						)}
						{state.status === "ready" && (
							<Image image={state.image} rect={imageBounds} fit="fill" />
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
				{sizes.length > 1 && (
					<View style={styles.sizes}>
						{sizes.map(({ width, height, scale }, index) => {
							const selected = index === sizeIndex;
							return (
								<Pressable
									key={scale}
									hitSlop={4}
									disabled={busy !== null}
									onPress={() => pickSize(index)}
									accessibilityRole="button"
									accessibilityLabel={`${width} by ${height} pixels`}
									accessibilityState={{ selected, disabled: busy !== null }}
									style={[styles.sizeChip, selected && styles.sizeChipSelected]}
								>
									<Text style={styles.sizeLabel}>
										{width} × {height}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}
				<Text style={styles.details}>
					{sizes.length > 1
						? ""
						: `${exportSize.width} × ${exportSize.height} · `}
					{format === "png"
						? `${exportFormats.png.label}, to keep the transparent areas`
						: exportFormats.jpeg.label}
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
	sizes: {
		flexDirection: "row",
		justifyContent: "center",
		flexWrap: "wrap",
		gap: 8,
	},
	// Small enough that three fit across a phone.
	sizeChip: {
		height: 34,
		paddingHorizontal: 12,
		borderRadius: 17,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		justifyContent: "center",
	},
	sizeChipSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	sizeLabel: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		color: colors.textPrimary,
	},
});
