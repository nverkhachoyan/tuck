import Ionicons from "@expo/vector-icons/Ionicons";
import {
	Redirect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { errorMessage } from "@/lib/errorMessage";
import { type EditorDocument, hasTransparency } from "@/model/document";
import { editorHref, projectRouteId } from "@/projects/projectRoute";
import { useStore } from "@/store";
import {
	chosenOutline,
	colors,
	radii,
	space,
	typography,
	webTransition,
} from "@/theme";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { interaction } from "@/ui/interaction";
import { showAlert } from "@/ui/showAlert";
import { copyImage } from "./copyImage";
import {
	type ExportFormat,
	exportFormatFor,
	exportFormats,
} from "./exportFormat";
import { type ExportSize, exportSizes } from "./exportSizes";
import { canShareImages, saveImage, saveLabels, shareImage } from "./saveImage";
import { useRenderedDocument } from "./useRenderedDocument";

/**
 * Export, as a sheet over the editor, which shows what will be saved: its
 * size and format, then Save, Share, and Copy.
 */
export default function ExportScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const document = useStore((state) =>
		projectRouteId(state.projectId) === id ? state.document : null,
	);
	const focused = useIsFocused();

	// Reached from a link or a reload, the project isn't open yet: the editor
	// opens it. Left behind in the stack for another project, wait instead.
	if (!document) {
		return focused ? <Redirect href={editorHref(id)} /> : null;
	}

	return <ScreenContent document={document} />;
}

function ScreenContent({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const sizes = useMemo(() => exportSizes(document), [document]);
	const [sizeIndex, setSizeIndex] = useState(0);
	const exportSize = sizes[Math.min(sizeIndex, sizes.length - 1)];
	const transparent = hasTransparency(document);
	const [format, setFormat] = useState<ExportFormat>(() =>
		exportFormatFor(document),
	);
	const { state, retry } = useRenderedDocument(document, exportSize.scale);
	const [busy, setBusy] = useState<"saving" | "sharing" | "copying" | null>(
		null,
	);
	const [saved, setSaved] = useState(false);
	const [copied, setCopied] = useState(false);
	const [canShare] = useState(canShareImages);
	const close = useCallback(() => router.back(), [router]);
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [close]);

	const changed = () => {
		setSaved(false);
		setCopied(false);
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

	const handleCopy = async () => {
		if (state.status !== "ready") return;
		setBusy("copying");
		try {
			await copyImage(state.image);
			setCopied(true);
		} catch (error) {
			showAlert("Copy failed", errorMessage(error));
		} finally {
			setBusy(null);
		}
	};

	const ready = state.status === "ready";
	// On iOS the modal's frame starts below the window's top but is laid out
	// as tall as the stack, which leaves a gap under the sheet. Measured from
	// where the screen starts, which its own height doesn't move, the
	// container reaches the window's bottom exactly.
	const screenSize = useWindowDimensions();
	const containerRef = useRef<View>(null);
	const [originY, setOriginY] = useState(0);

	return (
		<View
			ref={containerRef}
			style={[styles.container, { height: screenSize.height - originY }]}
			onLayout={() =>
				containerRef.current?.measureInWindow((_x, y) => setOriginY(y))
			}
		>
			{/* Behind the sheet, not around it: on web, a click on the sheet
			    would bubble up to it and close the sheet. */}
			<Pressable
				style={[StyleSheet.absoluteFill, styles.scrim]}
				onPress={close}
				accessibilityLabel="Close export"
			/>
			<View style={styles.column}>
				<BottomSheet title="Export" closeLabel="Close" onClose={close}>
					<View style={styles.content}>
						{sizes.length > 1 && (
							<Segmented
								label="Size"
								disabled={busy !== null}
								options={sizes.map(({ width, height }, index) => ({
									title: sizeName(index, sizes),
									detail: `${width} × ${height}`,
									accessibilityLabel: `${sizeName(index, sizes)}, ${width} by ${height} pixels`,
								}))}
								selected={Math.min(sizeIndex, sizes.length - 1)}
								onSelect={(index) => {
									setSizeIndex(index);
									changed();
								}}
							/>
						)}
						<Segmented
							label="Format"
							disabled={busy !== null}
							options={(["jpeg", "png"] as const).map((value) => ({
								title: exportFormats[value].label,
								detail:
									value === "png"
										? "Keeps transparency"
										: transparent
											? "Fills transparency black"
											: "Smaller file",
							}))}
							selected={format === "jpeg" ? 0 : 1}
							onSelect={(index) => {
								setFormat(index === 0 ? "jpeg" : "png");
								changed();
							}}
						/>
						{state.status === "rendering" && (
							<View style={styles.status}>
								<ActivityIndicator color={colors.textSecondary} />
								<Text style={styles.statusText}>Preparing the image…</Text>
							</View>
						)}
						{state.status === "failed" && (
							<View style={styles.status}>
								<Text style={styles.statusText}>
									Couldn't render the image.
								</Text>
								<Button label="Try Again" size="small" onPress={retry} />
							</View>
						)}
						{saved ? (
							<View style={styles.done} accessibilityLiveRegion="polite">
								<Ionicons
									name="checkmark-circle"
									size={22}
									color={colors.accent}
								/>
								<Text style={styles.doneLabel}>{saveLabels.done}</Text>
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
						<View style={styles.secondaryActions}>
							{/* Most desktop browsers can't share files. */}
							{canShare && (
								<View style={styles.secondaryAction}>
									<Button
										label={busy === "sharing" ? "Opening…" : "Share"}
										icon="share-outline"
										size="large"
										disabled={!ready || busy !== null}
										onPress={handleShare}
									/>
								</View>
							)}
							<View style={styles.secondaryAction}>
								{copied ? (
									<View style={styles.done} accessibilityLiveRegion="polite">
										<Ionicons
											name="checkmark-circle"
											size={22}
											color={colors.accent}
										/>
										<Text style={styles.doneLabel}>Copied</Text>
									</View>
								) : (
									<Button
										label={busy === "copying" ? "Copying…" : "Copy"}
										icon="copy-outline"
										size="large"
										disabled={!ready || busy !== null}
										onPress={handleCopy}
									/>
								)}
							</View>
						</View>
						{/* Saved, the edit is finished: straight back to the projects,
						    which ends the session, rather than through the editor. */}
						{saved && (
							<Button
								label="Back to Projects"
								size="large"
								onPress={() => router.dismissTo("/")}
							/>
						)}
					</View>
				</BottomSheet>
			</View>
		</View>
	);
}

/**
 * A row of two or three choices, each a name over a detail, with the chosen
 * one outlined.
 */
function Segmented({
	label,
	options,
	selected,
	disabled,
	onSelect,
}: {
	label: string;
	options: { title: string; detail: string; accessibilityLabel?: string }[];
	selected: number;
	disabled: boolean;
	onSelect: (index: number) => void;
}) {
	return (
		<View style={styles.segmented} accessibilityRole="radiogroup">
			<Text style={styles.segmentedLabel}>{label}</Text>
			<View style={styles.segments}>
				{options.map(({ title, detail, accessibilityLabel }, index) => {
					const chosen = index === selected;
					return (
						<Pressable
							key={title}
							disabled={disabled}
							onPress={() => onSelect(index)}
							accessibilityRole="radio"
							accessibilityLabel={accessibilityLabel ?? `${title}, ${detail}`}
							accessibilityState={{ checked: chosen, disabled }}
							aria-checked={chosen}
							style={(state) => {
								const { pressed, hovered } = interaction(state);
								return [
									styles.segment,
									webTransition,
									hovered && styles.segmentHovered,
									chosen && chosenOutline,
									pressed && styles.segmentPressed,
								];
							}}
						>
							<Text
								style={[
									styles.segmentTitle,
									chosen && styles.segmentTitleChosen,
								]}
							>
								{title}
							</Text>
							<Text style={styles.segmentDetail}>{detail}</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

/**
 * A size's name: the document's own size (or the largest export can hold,
 * when that's too big), then smaller ones for sharing.
 */
function sizeName(index: number, sizes: ExportSize[]) {
	if (index === 0) return sizes[0].scale === 1 ? "Full size" : "Largest";
	if (sizes.length > 2 && index === 1) return "Medium";
	return "Small";
}

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		justifyContent: "flex-end",
		alignItems: "center",
	},
	scrim: {
		backgroundColor: colors.sheetScrim,
	},
	// A phone's width, and no wider on a large screen.
	column: {
		width: "100%",
		maxWidth: 480,
		maxHeight: "90%",
	},
	content: {
		gap: space.md,
		paddingHorizontal: space.md,
		paddingTop: space.md,
		paddingBottom: space.lg,
	},
	segmented: {
		gap: space.xs,
	},
	segmentedLabel: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	segments: {
		flexDirection: "row",
		gap: space.xs,
	},
	segment: {
		flex: 1,
		minHeight: 52,
		paddingHorizontal: space.xs,
		paddingVertical: space.xs,
		borderRadius: radii.small,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	segmentHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	segmentPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	segmentTitle: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	segmentTitleChosen: {
		color: colors.textPrimary,
	},
	segmentDetail: {
		...typography.caption,
		fontVariant: ["tabular-nums"],
		color: colors.textTertiary,
		textAlign: "center",
	},
	status: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
	},
	statusText: {
		...typography.label,
		color: colors.textSecondary,
	},
	secondaryActions: {
		flexDirection: "row",
		gap: space.sm,
	},
	secondaryAction: {
		flex: 1,
	},
	// Where the button was, the same size, so nothing shifts.
	done: {
		height: 56,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: colors.accentBorder,
		backgroundColor: colors.accentSoft,
	},
	doneLabel: {
		...typography.title,
		color: colors.textPrimary,
	},
});
