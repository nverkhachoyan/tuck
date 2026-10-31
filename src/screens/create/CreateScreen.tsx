import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { type RefObject, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	type TextInputInstance,
	type TextStyle,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSession, openDocument } from "@/editor";
import { createBlankDocument, type Size } from "@/editor/core";
import { usePreference } from "@/platform/usePreference";
import { editorHref } from "@/projects/projectRoute";
import { createBlankProject } from "@/projects/projectService";
import { PageHead } from "@/site/PageHead";
import { Announcement } from "@/ui/Announcement";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { Button } from "@/ui/Button";
import { CheckerFill } from "@/ui/CheckerFill";
import { IconButton } from "@/ui/IconButton";
import { interaction } from "@/ui/interaction";
import { ScreenHeader } from "@/ui/ScreenHeader";
import {
	CHECKER_CELL,
	colorScheme,
	colors,
	radii,
	space,
	typography,
	webTransition,
} from "@/ui/theme";
import {
	checkCanvasSize,
	MAX_CANVAS_SIDE,
	MIN_CANVAS_SIDE,
	parseCustomSize,
} from "./canvasSize";

const PRESETS = [
	{ name: "Square", ratio: "1:1", width: 1080, height: 1080 },
	{ name: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
	{ name: "Story", ratio: "9:16", width: 1080, height: 1920 },
	{ name: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
] as const;
type Preset = (typeof PRESETS)[number];

const SPREAD_MIN_WIDTH = 760;
const PREVIEW_PHONE = 120;
const PREVIEW_SPREAD = 136;
const SIDE_HEIGHT = 44;
const nightPrint = colorScheme === "dark";

export default function CreateScreen() {
	const router = useRouter();
	const [background, setBackground] = useState<string | null>("#FFFFFF");
	const { bottom } = useSafeAreaInsets();
	// Wide enough for the four presets to sit in one row across the light table.
	const spread = useWindowDimensions().width >= SPREAD_MIN_WIDTH;
	const [creatingKey, setCreatingKey] = useState<string | null>(null);
	// Set at once, so a second tap can't start another project meanwhile.
	const creating = useRef(false);
	const busy = creatingKey !== null;

	const handleCreate = async ({ width, height }: Size, key: string) => {
		// An editor whose save failed is still open until the welcome screen
		// closes it.
		if (creating.current || getSession().document) return;
		creating.current = true;
		setCreatingKey(key);
		try {
			// Without storage, the canvas can still be edited, just not kept.
			const opened = await createBlankProject({
				width,
				height,
				background,
			}).catch((error: unknown) => {
				console.warn("Couldn't save the canvas as a project", error);
				return {
					id: null,
					document: createBlankDocument(width, height, background),
				};
			});
			openDocument(opened.document, opened.id);
			router.replace(editorHref(opened.id));
		} finally {
			creating.current = false;
			setCreatingKey(null);
		}
	};

	return (
		<View role="main" style={styles.screen}>
			<PageHead title="New canvas" path="/create" />
			<View style={styles.header}>
				<ScreenHeader
					title="New canvas"
					onBack={() =>
						router.canGoBack() ? router.back() : router.replace("/")
					}
				/>
			</View>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				automaticallyAdjustKeyboardInsets
				showsVerticalScrollIndicator={false}
				contentContainerStyle={[
					spread && styles.spreadScroll,
					{ paddingBottom: space.lg + bottom },
				]}
			>
				<View style={[styles.content, spread && styles.contentSpread]}>
					<View style={styles.fillBand}>
						<View style={styles.bandText}>
							<Text style={styles.sectionTitle}>Fill</Text>
							<Text style={styles.metaText}>{fillName(background)}</Text>
						</View>
						<BackgroundPicker value={background} onPick={setBackground} />
					</View>

					<View style={[styles.grid, spread && styles.gridSpread]}>
						{PRESETS.map((preset) => (
							<PresetPrint
								key={preset.name}
								preset={preset}
								background={background}
								disabled={busy}
								creating={creatingKey === preset.name}
								spread={spread}
								onPress={() => void handleCreate(preset, preset.name)}
							/>
						))}
					</View>

					<CustomSize
						spread={spread}
						disabled={busy}
						creating={creatingKey === "custom"}
						onCreate={(size) => handleCreate(size, "custom")}
					/>
				</View>
			</ScrollView>
		</View>
	);
}

function fillName(background: string | null) {
	if (background === null) return "Transparent";
	return background === "#000000" ? "Black" : "White";
}

/** Fields for a width and height of the user's own, remembered once used. */
function CustomSize({
	spread,
	disabled,
	creating,
	onCreate,
}: {
	spread: boolean;
	disabled: boolean;
	creating: boolean;
	onCreate: (size: Size) => Promise<void>;
}) {
	const [saved, setSaved] = usePreference("customCanvasSize", parseCustomSize);
	const [width, setWidth] = useState(String(saved.width));
	const [height, setHeight] = useState(String(saved.height));
	const [showProblem, setShowProblem] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const widthRef = useRef<TextInputInstance>(null);
	const heightRef = useRef<TextInputInstance>(null);

	const { size, problem } = checkCanvasSize(width, height);
	const incomplete = width === "" || height === "";
	const emptyProblem =
		incomplete && submitted
			? `Each side must be ${MIN_CANVAS_SIDE} to ${MAX_CANVAS_SIDE.toLocaleString("en-US")} pixels.`
			: null;
	const displayedProblem = (showProblem ? problem : null) ?? emptyProblem;
	const widthInvalid =
		width === ""
			? submitted
			: checkCanvasSize(width, "100").size === null && showProblem;
	const heightInvalid =
		height === ""
			? submitted
			: checkCanvasSize("100", height).size === null && showProblem;
	const bothTooLarge =
		!incomplete &&
		checkCanvasSize(width, "100").size !== null &&
		checkCanvasSize("100", height).size !== null &&
		problem !== null;

	const create = () => {
		if (disabled) return;
		if (!size) {
			setShowProblem(true);
			setSubmitted(true);
			const focusWidth =
				width === "" ||
				checkCanvasSize(width, "100").size === null ||
				bothTooLarge;
			(focusWidth ? widthRef : heightRef).current?.focus();
			return;
		}
		setSaved(size);
		void onCreate(size);
	};

	const swap = () => {
		setWidth(height);
		setHeight(width);
	};

	const meta = (
		<View style={styles.problemRow}>
			{displayedProblem !== null && (
				<Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
			)}
			<Text
				style={[styles.metaText, displayedProblem !== null && styles.problem]}
			>
				{displayedProblem ??
					`${MIN_CANVAS_SIDE} to ${MAX_CANVAS_SIDE.toLocaleString("en-US")} pixels a side`}
			</Text>
		</View>
	);

	return (
		<View style={[styles.customBand, spread && styles.customBandSpread]}>
			<View style={[styles.bandText, spread && styles.customHeaderSpread]}>
				<Text style={styles.sectionTitle}>Custom</Text>
				{spread && meta}
			</View>
			<View style={styles.customRow}>
				<SideField
					inputRef={widthRef}
					label="Width"
					value={width}
					invalid={widthInvalid || (displayedProblem !== null && bothTooLarge)}
					onChange={(next) => {
						setWidth(next);
						setShowProblem(false);
						setSubmitted(false);
					}}
					onBlur={() => setShowProblem(true)}
					onSubmit={create}
				/>
				<View style={styles.swap}>
					<IconButton
						icon="swap-horizontal"
						label="Swap width and height"
						onPress={swap}
					/>
				</View>
				<SideField
					inputRef={heightRef}
					label="Height"
					value={height}
					invalid={heightInvalid || (displayedProblem !== null && bothTooLarge)}
					onChange={(next) => {
						setHeight(next);
						setShowProblem(false);
						setSubmitted(false);
					}}
					onBlur={() => setShowProblem(true)}
					onSubmit={create}
				/>
				<View
					style={[
						styles.customCreate,
						spread ? styles.customCreateSpread : styles.customCreatePhone,
					]}
				>
					<Button
						label="Create"
						variant="primary"
						busy={creating}
						disabled={disabled}
						onPress={create}
					/>
				</View>
			</View>
			{!spread && meta}
			<Announcement message={displayedProblem} />
		</View>
	);
}

function SideField({
	inputRef,
	label,
	value,
	invalid,
	onChange,
	onBlur,
	onSubmit,
}: {
	inputRef: RefObject<TextInputInstance | null>;
	label: string;
	value: string;
	invalid: boolean;
	onChange: (value: string) => void;
	onBlur: () => void;
	onSubmit: () => void;
}) {
	const [focused, setFocused] = useState(false);
	return (
		<View style={styles.side}>
			<Text style={styles.sideLabel}>{label}</Text>
			<TextInput
				ref={inputRef}
				value={value}
				// Digits only, so a pasted "1080px" still reads as a size.
				onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
				onFocus={() => {
					setFocused(true);
					if (Platform.OS !== "web") {
						inputRef.current?.setSelection(0, value.length);
					} else {
						(
							inputRef.current as unknown as HTMLInputElement | null
						)?.setSelectionRange?.(0, value.length);
					}
				}}
				onBlur={() => {
					setFocused(false);
					onBlur();
				}}
				onSubmitEditing={onSubmit}
				selectTextOnFocus
				inputMode="numeric"
				keyboardType="number-pad"
				returnKeyType="done"
				autoCorrect={false}
				maxLength={5}
				aria-invalid={invalid || undefined}
				accessibilityLabel={`${label} in pixels`}
				style={[
					styles.sideInput,
					invalid && styles.sideInputInvalid,
					focused && styles.sideInputFocused,
					fieldFocusStyle,
				]}
			/>
		</View>
	);
}

// Browsers ring a focused field in their own blue; the field's own border
// shows focus instead.
const fieldFocusStyle =
	Platform.OS === "web"
		? ({ outlineStyle: "none" } as unknown as TextStyle)
		: null;

/**
 * A canvas preset laid directly on the light table as a print, with its name,
 * dimensions, and ratio underneath, matching Home's project prints.
 */
function PresetPrint({
	preset,
	background,
	disabled,
	creating,
	spread,
	onPress,
}: {
	preset: Preset;
	background: string | null;
	disabled: boolean;
	creating: boolean;
	spread: boolean;
	onPress: () => void;
}) {
	const { name, ratio, width, height } = preset;
	const stageSize = spread ? PREVIEW_SPREAD : PREVIEW_PHONE;
	const scale = stageSize / Math.max(width, height);
	const size = {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${width} by ${height}, ${ratio}`}
			accessibilityState={{ disabled, busy: creating || undefined }}
			style={[styles.preset, spread ? styles.presetSpread : styles.presetPhone]}
		>
			{(state) => {
				const { pressed, hovered } = interaction(state);
				return (
					<>
						<View style={[styles.previewStage, { height: stageSize }]}>
							<View
								style={[
									styles.print,
									size,
									background !== null && { backgroundColor: background },
									background === null && styles.printTransparent,
									nightPrint && styles.printNight,
									webTransition,
									hovered && !disabled && styles.printLifted,
									(pressed || creating) && styles.printPressed,
								]}
							>
								{background === null && (
									<CheckerFill {...size} cell={CHECKER_CELL} />
								)}
								{creating && (
									<View style={styles.creatingOverlay}>
										<View style={styles.creatingBadge}>
											<ActivityIndicator
												size="small"
												color={colors.textPrimary}
											/>
										</View>
									</View>
								)}
							</View>
						</View>
						<View style={styles.caption}>
							<Text style={styles.presetName} numberOfLines={1}>
								{name}
							</Text>
							<Text style={styles.presetMeta} numberOfLines={1}>
								{width} × {height} · {ratio}
							</Text>
						</View>
					</>
				);
			}}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.canvasWell,
	},
	header: {
		backgroundColor: colors.background,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	// A phone-width column on the light table; widens on tablet/laptop so all
	// four prints stand in one row.
	content: {
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
		gap: space.lg,
		paddingHorizontal: space.md,
		paddingTop: space.md,
	},
	spreadScroll: {
		flexGrow: 1,
		justifyContent: "center",
	},
	contentSpread: {
		maxWidth: 880,
		gap: space.xl,
		paddingHorizontal: space.lg,
		paddingVertical: space.xl,
	},
	fillBand: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: space.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.borderStrong,
	},
	bandText: {
		gap: 2,
	},
	sectionTitle: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	metaText: {
		...typography.caption,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		columnGap: space.md,
		rowGap: space.lg,
	},
	gridSpread: {
		flexWrap: "nowrap",
	},
	preset: {
		alignItems: "center",
		gap: space.xs,
		paddingVertical: space.xxs,
	},
	presetPhone: {
		flexBasis: "44%",
		flexGrow: 1,
	},
	presetSpread: {
		flex: 1,
	},
	previewStage: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	// Photo-paper corners and dual print shadows, matching `ProjectList`.
	print: {
		borderRadius: 3,
		overflow: "hidden",
		backgroundColor: colors.surface,
		boxShadow: `0 1px 1.5px ${colors.shadow}, 0 8px 18px -6px ${colors.shadow}`,
	},
	printTransparent: {
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	printNight: {
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	printLifted: {
		transform: [{ translateY: -2 }],
		boxShadow: `0 2px 3px ${colors.shadow}, 0 12px 22px -6px ${colors.shadow}`,
	},
	printPressed: {
		opacity: 0.8,
		transform: [{ scale: 0.98 }],
	},
	creatingOverlay: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
	},
	creatingBadge: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	caption: {
		alignItems: "center",
		gap: 2,
	},
	presetName: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	presetMeta: {
		...typography.caption,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	customBand: {
		gap: space.sm,
		paddingTop: space.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.borderStrong,
	},
	customBandSpread: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		gap: space.lg,
	},
	customHeaderSpread: {
		minHeight: SIDE_HEIGHT,
		justifyContent: "center",
	},
	customRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "flex-end",
		gap: space.sm,
	},
	customCreate: {
		alignItems: "flex-end",
	},
	customCreatePhone: {
		flexGrow: 1,
	},
	customCreateSpread: {
		marginLeft: space.xxs,
	},
	side: {
		gap: space.xxs,
	},
	// Centered on the fields beside it.
	swap: {
		height: SIDE_HEIGHT,
		justifyContent: "center",
	},
	sideLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	sideInput: {
		...typography.body,
		width: 76,
		height: SIDE_HEIGHT,
		paddingHorizontal: space.xs,
		borderRadius: radii.small,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
		textAlign: "center",
	},
	sideInputInvalid: {
		borderWidth: 1,
		borderColor: colors.danger,
	},
	sideInputFocused: {
		borderWidth: 2,
		borderColor: colors.textPrimary,
		paddingHorizontal: space.xs - 1,
	},
	problemRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	problem: {
		color: colors.danger,
	},
});
