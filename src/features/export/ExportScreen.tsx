import Ionicons from "@expo/vector-icons/Ionicons";
import { Canvas, Image, Rect, rect, Shadow } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	type LayoutChangeEvent,
	Linking,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@/lib/errorMessage";
import type { EditorDocument } from "@/model/document";
import { useStore } from "@/store";
import { CHECKER_CELL, colors, radii, webTransition } from "@/theme";
import { Button } from "@/ui/Button";
import { Checkerboard } from "@/ui/Checkerboard";
import { interaction } from "@/ui/interaction";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { showAlert } from "@/ui/showAlert";
import { exportFormatFor, exportFormats } from "./exportFormat";
import { exportSizes } from "./exportSizes";
import { canShareImages, saveImage, saveLabels, shareImage } from "./saveImage";
import { useRenderedDocument } from "./useRenderedDocument";

export default function ExportScreen() {
	const document = useStore((state) => state.document);

	if (!document) return null;

	return <ScreenContent document={document} />;
}

function ScreenContent({ document }: { document: EditorDocument }) {
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

	const ready = state.status === "ready";
	const wide = useWindowDimensions().width >= 420;
	const { bottom } = useSafeAreaInsets();

	return (
		<View style={styles.container}>
			<ScreenHeader
				title="Export"
				backLabel="Edit"
				onBack={() => router.back()}
			/>

			<View style={styles.previewArea}>
				{/* Canvas has no onLayout on Fabric, so measure a wrapper instead. */}
				<View style={styles.preview} onLayout={handleLayout}>
					<Canvas style={styles.preview}>
						{ready && (
							<Rect rect={imageBounds} color="black">
								<Shadow
									dx={0}
									dy={8}
									blur={24}
									color="rgba(0, 0, 0, 0.6)"
									shadowOnly
								/>
							</Rect>
						)}
						{ready && format === "png" && (
							<Checkerboard bounds={imageBounds} cell={CHECKER_CELL} />
						)}
						{ready && (
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
						<Ionicons
							name="alert-circle-outline"
							size={28}
							color={colors.textSecondary}
						/>
						<Text style={styles.status}>Couldn't render the image.</Text>
						<Button label="Try Again" onPress={retry} />
					</View>
				)}
			</View>

			<View style={[styles.footer, { paddingBottom: 24 + bottom }]}>
				<View style={styles.footerContent}>
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
										style={(pressable) => {
											const { pressed, hovered } = interaction(pressable);
											return [
												styles.sizeChip,
												webTransition,
												hovered && styles.sizeChipHovered,
												selected && styles.sizeChipSelected,
												pressed && styles.sizeChipPressed,
											];
										}}
									>
										<Text
											style={[
												styles.sizeLabel,
												selected && styles.sizeLabelSelected,
											]}
										>
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
					<View style={[styles.actions, wide && styles.actionsWide]}>
						<View style={wide && styles.actionWide}>
							{saved ? (
								<View style={styles.saved} accessibilityLiveRegion="polite">
									<Ionicons
										name="checkmark-circle"
										size={22}
										color={colors.accent}
									/>
									<Text style={styles.savedLabel}>{saveLabels.done}</Text>
								</View>
							) : (
								<Button
									label={busy === "saving" ? saveLabels.busy : saveLabels.idle}
									icon="download-outline"
									variant="primary"
									size="large"
									disabled={!ready || busy !== null}
									onPress={handleSave}
								/>
							)}
						</View>
						{/* Most desktop browsers can't share files. */}
						{canShare && (
							<View style={wide && styles.actionWide}>
								<Button
									label={busy === "sharing" ? "Opening…" : "Share"}
									icon="share-outline"
									size="large"
									disabled={!ready || busy !== null}
									onPress={handleShare}
								/>
							</View>
						)}
					</View>
				</View>
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
		padding: 24,
		backgroundColor: colors.canvasWell,
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
		paddingHorizontal: 20,
		paddingTop: 16,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	// A phone-width column, so a wide browser window doesn't stretch the
	// buttons across it.
	footerContent: {
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
		gap: 14,
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
	sizeChipHovered: {
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceHover,
	},
	sizeChipSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentSoft,
	},
	sizeChipPressed: {
		transform: [{ scale: 0.96 }],
	},
	sizeLabel: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	sizeLabelSelected: {
		fontWeight: "600",
		color: colors.textPrimary,
	},
	actions: {
		gap: 12,
	},
	actionsWide: {
		flexDirection: "row",
	},
	// Only in a row: in a column, the buttons keep their own height.
	actionWide: {
		flex: 1,
	},
	// Where the save button was, the same size, so nothing shifts.
	saved: {
		height: 56,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		borderRadius: radii.large,
		borderWidth: 1,
		borderColor: colors.accentBorder,
		backgroundColor: colors.accentSoft,
	},
	savedLabel: {
		fontSize: 17,
		fontWeight: "600",
		color: colors.textPrimary,
	},
});
