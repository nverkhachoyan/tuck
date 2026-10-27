import Ionicons from "@expo/vector-icons/Ionicons";
import type { SkImage } from "@shopify/react-native-skia";
import {
	Redirect,
	useIsFocused,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Image,
	Linking,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@/lib/errorMessage";
import { type EditorDocument, hasTransparency } from "@/model/document";
import { editorHref, projectRouteId } from "@/projects/projectRoute";
import { useStore } from "@/store";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { CheckerFill } from "@/ui/CheckerFill";
import { Segmented } from "@/ui/Segmented";
import { showAlert } from "@/ui/showAlert";
import {
	CHECKER_CELL,
	colors,
	floatingShadow,
	radii,
	space,
	typography,
} from "@/ui/theme";
import { copyImage } from "./copyImage";
import {
	type ExportFormat,
	exportFormatFor,
	exportFormats,
} from "./exportFormat";
import { type ExportSize, exportSizes } from "./exportSizes";
import { canShareImages, saveImage, saveLabels, shareImage } from "./saveImage";
import { type RenderState, useRenderedDocument } from "./useRenderedDocument";

type Busy = "saving" | "sharing" | "copying";

// The preview strip's height, taller on a wide window. On a window too short
// for the sheet, under its cap, the strip gives way first, down to the least.
const PREVIEW_HEIGHT = 180;
const WIDE_PREVIEW_HEIGHT = 220;
const MIN_PREVIEW_HEIGHT = 120;
const WIDE_MIN_WIDTH = 1024;
// The sheet's cap, as a share of the screen's height (`styles.column`).
const SHEET_MAX_SHARE = 0.9;

/** Export, as a sheet over the editor. */
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

	const { busy, saved, copied, changed, handleSave, handleShare, handleCopy } =
		useExportActions(state, format);

	const ready = state.status === "ready";
	const sheet = useSheetFit();

	return (
		<View
			ref={sheet.containerRef}
			accessibilityViewIsModal
			style={[styles.container, { height: sheet.height }]}
			onLayout={sheet.measure}
		>
			{/* Behind the sheet, not around it: on web, a click on the sheet
			    would bubble up to it and close the sheet. */}
			<Pressable
				style={[StyleSheet.absoluteFill, styles.scrim]}
				onPress={close}
				accessibilityLabel="Close export"
			/>
			{sheet.measured && (
				<View style={styles.column}>
					<BottomSheet title="Export" closeLabel="Close" onClose={close}>
						<ExportPreview
							state={state}
							aspect={document.width / document.height}
							height={sheet.previewHeight}
							onHeaderHeight={sheet.setHeaderHeight}
							onBlack={format === "jpeg" && transparent}
							checkered={format === "png" && transparent}
							onRetry={retry}
						/>
						<View
							style={styles.content}
							onLayout={(event) =>
								sheet.setOptionsHeight(event.nativeEvent.layout.height)
							}
						>
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
							{saved ? (
								<DoneLabel label={saveLabels.done} />
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
										<DoneLabel label="Copied" />
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
									label="Back to projects"
									size="large"
									onPress={() => router.dismissTo("/")}
								/>
							)}
						</View>
					</BottomSheet>
				</View>
			)}
		</View>
	);
}

/**
 * Save, Share, and Copy for the render in `state`. Each runs alone, with the
 * others off until it's done (`busy`), and alerts if it throws. `saved` and
 * `copied` say a save or copy landed, until `changed` says an option moved.
 */
function useExportActions(state: RenderState, format: ExportFormat) {
	const [busy, setBusy] = useState<Busy | null>(null);
	const [saved, setSaved] = useState(false);
	const [copied, setCopied] = useState(false);

	const changed = () => {
		setSaved(false);
		setCopied(false);
	};

	// Alerts under `failureTitle` if `run` throws.
	const runAction = async (
		action: Busy,
		failureTitle: string,
		run: (image: SkImage) => Promise<void>,
	) => {
		if (state.status !== "ready") return;
		setBusy(action);
		try {
			await run(state.image);
		} catch (error) {
			showAlert(failureTitle, errorMessage(error));
		} finally {
			setBusy(null);
		}
	};

	const handleSave = () =>
		runAction("saving", "Save failed", async (image) => {
			const result = await saveImage(image, format);
			if (result.status === "saved") {
				setSaved(true);
			} else {
				showAlert(
					"Photos access needed",
					"Allow this app to add photos in Settings to save your edit.",
					[
						{ text: "Cancel", style: "cancel" },
						{ text: "Open settings", onPress: () => Linking.openSettings() },
					],
				);
			}
		});

	const handleShare = () =>
		runAction("sharing", "Share failed", async (image) => {
			if (!(await shareImage(image, format))) {
				showAlert("Sharing unavailable", "This device can't share files.");
			}
		});

	const handleCopy = () =>
		runAction("copying", "Copy failed", async (image) => {
			await copyImage(image);
			setCopied(true);
		});

	return { busy, saved, copied, changed, handleSave, handleShare, handleCopy };
}

/** The sheet's container and preview strip, fitted to the window. */
function useSheetFit() {
	// On iOS the modal's frame starts below the window's top but is laid out
	// as tall as the stack, which leaves a gap under the sheet. Measured from
	// where the screen starts, which its own height doesn't move, the
	// container reaches the window's bottom exactly. The sheet waits for
	// that measurement: its entering slide settles where the container's
	// bottom was when it began, which a later change of height leaves behind.
	const screenSize = useWindowDimensions();
	const containerRef = useRef<View>(null);
	const [measuredOriginY, setOriginY] = useState<number | null>(null);
	const originY = measuredOriginY ?? 0;
	// The preview strip's height: its own, or on a window too short for the
	// sheet under its cap, what's left beside the header above it and the
	// options below, but no less than `MIN_PREVIEW_HEIGHT`. Shrinking the
	// sheet's content to fit instead fought its entering slide on web.
	const { bottom } = useSafeAreaInsets();
	const [headerHeight, setHeaderHeight] = useState(0);
	const [optionsHeight, setOptionsHeight] = useState(0);
	const nominalPreview =
		screenSize.width >= WIDE_MIN_WIDTH ? WIDE_PREVIEW_HEIGHT : PREVIEW_HEIGHT;
	const room =
		(screenSize.height - originY) * SHEET_MAX_SHARE -
		headerHeight -
		optionsHeight -
		bottom;
	const previewHeight =
		optionsHeight === 0
			? nominalPreview
			: Math.round(
					Math.min(nominalPreview, Math.max(MIN_PREVIEW_HEIGHT, room)),
				);

	return {
		containerRef,
		height: screenSize.height - originY,
		measured: measuredOriginY !== null,
		measure: () =>
			containerRef.current?.measureInWindow((_x, y) => setOriginY(y)),
		previewHeight,
		setHeaderHeight,
		setOptionsHeight,
	};
}

function DoneLabel({ label }: { label: string }) {
	return (
		<View style={styles.done} accessibilityLiveRegion="polite">
			<Ionicons name="checkmark-circle" size={22} color={colors.textPrimary} />
			<Text style={styles.doneLabel}>{label}</Text>
		</View>
	);
}

/**
 * The image being exported, fitted into a strip on the light table with a
 * print's shadow: a check before it leaves, not a control. While it renders,
 * and if rendering fails, the strip says so, over the last render while
 * there's one. A transparent document sits on black when the format fills it
 * so, and on the checkerboard when it keeps it. It shows the render's own
 * small copy (see `useRenderedDocument`), so it holds no Skia image.
 */
function ExportPreview({
	state,
	aspect,
	height,
	onBlack,
	checkered,
	onRetry,
	onHeaderHeight,
}: {
	state: RenderState;
	// The document's width over its height.
	aspect: number;
	height: number;
	// Where the strip starts in the sheet: the height of the header above it.
	onHeaderHeight: (height: number) => void;
	onBlack: boolean;
	checkered: boolean;
	onRetry: () => void;
}) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const preview =
		state.status === "ready"
			? state.preview
			: state.status === "rendering"
				? state.previous
				: null;
	const fitted =
		preview && size.width > 0 ? fitInto(aspect, size.width, size.height) : null;
	return (
		<View
			style={[styles.preview, { height }, onBlack && styles.previewOnBlack]}
			onLayout={(event) => {
				const { y, width, height } = event.nativeEvent.layout;
				setSize({ width, height });
				onHeaderHeight(y);
			}}
		>
			{preview && fitted && (
				<View style={[styles.print, fitted]}>
					{/* The print casts the shadow; this clips what's on it. */}
					<View style={styles.printFace}>
						{checkered && (
							<CheckerFill
								width={fitted.width}
								height={fitted.height}
								cell={CHECKER_CELL}
							/>
						)}
						<Image
							source={{ uri: preview }}
							style={StyleSheet.absoluteFill}
							accessibilityLabel="Preview of the exported image"
						/>
					</View>
				</View>
			)}
			{state.status === "rendering" && (
				<View style={[styles.status, preview && styles.statusOver]}>
					<ActivityIndicator color={colors.textSecondary} />
					<Text style={styles.statusText}>Preparing the image…</Text>
				</View>
			)}
			{state.status === "failed" && (
				<View style={styles.status}>
					<Text style={styles.statusText}>Couldn't render the image.</Text>
					<Button label="Try again" size="small" onPress={onRetry} />
				</View>
			)}
		</View>
	);
}

// The preview's margin inside its strip.
const PREVIEW_INSET = space.md;

// An image of `aspect` (its width over its height), fitted into the strip
// inside its margin, in whole points.
function fitInto(aspect: number, width: number, height: number) {
	const room = {
		width: width - PREVIEW_INSET * 2,
		height: height - PREVIEW_INSET * 2,
	};
	const fitted =
		room.width / room.height > aspect
			? { width: room.height * aspect, height: room.height }
			: { width: room.width, height: room.width / aspect };
	return {
		width: Math.max(1, Math.round(fitted.width)),
		height: Math.max(1, Math.round(fitted.height)),
	};
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
	preview: {
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.canvasWell,
		overflow: "hidden",
	},
	// What a JPEG fills transparency with: the file's black, not a palette's.
	previewOnBlack: {
		backgroundColor: "#000000",
	},
	// A print's shadows on the table, as the editor draws the canvas's.
	print: {
		boxShadow: `0 1px 1.5px ${colors.shadow}, 0 8px 14px ${colors.shadow}`,
	},
	printFace: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		overflow: "hidden",
	},
	status: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
	},
	// Over the last render while the next one runs.
	statusOver: {
		position: "absolute",
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
		borderRadius: radii.medium,
		backgroundColor: colors.surface,
		boxShadow: floatingShadow,
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
		borderColor: colors.highlightBorder,
		backgroundColor: colors.highlightSoft,
	},
	doneLabel: {
		...typography.title,
		color: colors.textPrimary,
	},
});
