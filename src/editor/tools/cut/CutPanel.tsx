import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useContext, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { Surface } from "@/ui/Surface";
import { colors, radii, space, typography } from "@/ui/theme";
import {
	BarButton,
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { EdgeControls } from "../../shell/EdgeControls";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChip,
	SizeChoices,
	ToolChoices,
	ToolOption,
	ToolOptions,
	TrayHeight,
} from "../../shell/ToolOptions";
import { useEditorContext } from "../editorContext";
import {
	type CutTapMode,
	type CutTool,
	cutSizeIndex,
	isCutBrush,
	withCutSize,
} from "./cutSettings";
import { removeBgSpec } from "./removeBgSpec";
import type { CutController, CutTray } from "./useCutTool";

type Icon = ComponentProps<typeof MaterialCommunityIcons>["name"];

// Cut's sub-tools, in the order the dock and the bar show them.
const CUT_TOOLS = [
	{ tool: "tap", title: "Tap", icon: "gesture-tap" },
	{ tool: "add", title: "Paint in", icon: "brush" },
	{ tool: "subtract", title: "Paint out", icon: "eraser" },
] as const satisfies readonly { tool: CutTool; title: string; icon: Icon }[];

// The sub-tools on offer: Tap only where this device can find subjects.
const cutTools = (canPick: boolean) =>
	CUT_TOOLS.filter(({ tool }) => canPick || tool !== "tap");

// Which way a tap goes, in the order the bar shows them; the dock shows
// the one in use, and a press switches.
const TAP_MODES = [
	{ mode: "add", title: "Adds", icon: "plus-circle-outline" },
	{ mode: "subtract", title: "Subtracts", icon: "minus-circle-outline" },
] as const satisfies readonly { mode: CutTapMode; title: string; icon: Icon }[];

// The brushes' edges, in the order the size chip's popover and the tray
// show them.
const BRUSH_EDGES = [
	{ soft: true, title: "Soft", icon: "blur-radial" },
	{ soft: false, title: "Hard", icon: "circle" },
] as const satisfies readonly { soft: boolean; title: string; icon: Icon }[];

// The Apply menu's actions, in the order the popover and the tray show them:
// Remove BG, which needs no selection, then those that act on it.
const APPLY_ACTIONS = [
	{ action: "removeBg", title: removeBgSpec.label, icon: removeBgSpec.icon },
	{ action: "newLayer", title: "New layer", icon: "layers-plus" },
	{ action: "adjust", title: "Adjust", icon: "tune-variant" },
	{ action: "remove", title: "Remove", icon: "selection-remove" },
	{ action: "redact", title: "Redact", icon: "blur" },
	{
		action: "saveSticker",
		title: "Save sticker",
		icon: "sticker-plus-outline",
	},
] as const satisfies readonly {
	action: keyof CutController["apply"];
	title: string;
	icon: Icon;
}[];

/**
 * Cut's tools, in place of the toolbar while cutting an image out:
 * [Subjects] [Tap] [Paint in ▾] [Paint out ▾] [Edge ▾] [Invert] [Actions ▾].
 */
export function CutPanel({ controller }: { controller: CutController }) {
	const { trayOpen, toggleTray, closeTray } = useEditorContext();
	const {
		settings,
		tool,
		finding,
		findAll,
		inverting,
		invert,
		hasSelection,
		maskEdge,
		change,
		tray,
		showInTray,
	} = controller;

	const openTray = (content: CutTray) => {
		if (trayOpen && tray === content) {
			closeTray();
			return;
		}
		showInTray(content);
		if (!trayOpen) toggleTray();
	};

	const pickBrush = (choice: "add" | "subtract") => {
		if (tool === choice) {
			openTray("brush");
		} else {
			change({ ...settings, tool: choice });
		}
	};

	return (
		<ToolRow>
			{findAll && (
				<ToolButton
					label="Subjects"
					icon="select-group"
					busy={finding === "all"}
					onPress={findAll}
				/>
			)}
			<ToolButton
				label="Tap"
				icon="gesture-tap"
				selected={tool === "tap"}
				busy={finding === "one"}
				onPress={() => change({ ...settings, tool: "tap" })}
			/>
			<ToolButton
				label="Paint in"
				icon="brush"
				selected={tool === "add"}
				open={trayOpen && tray === "brush" && tool === "add"}
				onPress={() => pickBrush("add")}
			/>
			<ToolButton
				label="Paint out"
				icon="eraser"
				selected={tool === "subtract"}
				open={trayOpen && tray === "brush" && tool === "subtract"}
				onPress={() => pickBrush("subtract")}
			/>
			<ToolButton
				label="Edge"
				icon="feather"
				glyph={maskEdge ? <EdgeGlyph size={24} /> : undefined}
				disabled={!hasSelection}
				open={trayOpen && tray === "edge"}
				onPress={() => openTray("edge")}
			/>
			<ToolButton
				label="Invert"
				icon="select-inverse"
				busy={inverting}
				disabled={!invert}
				onPress={() => invert?.()}
			/>
			<ToolButton
				label="Actions"
				icon="dots-horizontal"
				open={trayOpen && tray === "apply"}
				onPress={() => openTray("apply")}
			/>
		</ToolRow>
	);
}

/**
 * Floating modifier pill shown above the dock when the Tap tool is active.
 * Houses [+ Adds | − Subtracts] and [Smaller | Larger] stepping buttons,
 * under a line saying what to do first until something is chosen.
 */
export function TapModifierPill({ controller }: { controller: CutController }) {
	const { wide, bottomInset, rightInset = 0 } = useEditorContext();
	if (wide || controller.tool !== "tap") return null;
	return (
		<TapModifierPillContent
			controller={controller}
			bottomInset={bottomInset}
			rightInset={rightInset}
		/>
	);
}

function TapModifierPillContent({
	controller,
	bottomInset,
	rightInset,
}: {
	controller: CutController;
	bottomInset: number;
	rightInset: number;
}) {
	const setHeight = useContext(TrayHeight);
	useEffect(() => () => setHeight(0), [setHeight]);
	const { settings, setTapMode, resize, canCommit, findAll, finding } =
		controller;

	return (
		<View
			style={[
				styles.pillArea,
				{ bottom: bottomInset + 8, paddingRight: rightInset },
			]}
			pointerEvents="box-none"
			onLayout={(event) => setHeight(event.nativeEvent.layout.height + 8)}
		>
			{!canCommit && finding === null && (
				<Surface style={styles.pill} contentStyle={styles.hintContent}>
					<Text style={styles.hint}>
						{findAll
							? "Tap or drag around what to cut out, or choose Subjects"
							: "Tap what to cut out, or drag a box around it"}
					</Text>
				</Surface>
			)}
			<Surface style={styles.pill} contentStyle={styles.pillContent}>
				<OptionSegments
					label="Tap mode"
					options={TAP_MODES}
					selected={TAP_MODES.findIndex(
						({ mode }) => mode === settings.tapMode,
					)}
					onSelect={(index) => {
						const next = TAP_MODES[index]?.mode;
						if (next && next !== settings.tapMode) setTapMode(next);
					}}
				/>
				{resize && (
					<>
						<View style={styles.divider} />
						{resizeButtons(resize, BarButton)}
					</>
				)}
			</Surface>
		</View>
	);
}

/**
 * Cut's options in the wide editor's header: Tap, Paint in, and Paint out, then
 * whether taps add or subtract and Smaller and Larger, or the brushes'
 * size, then Subjects, Invert, and the Apply menu, a popover. Soft and Hard
 * sit in the size chip. Choosing the sub-tool already in use leaves it,
 * since the options stay in view.
 */
export function CutBar({ controller }: { controller: CutController }) {
	const {
		settings,
		tool,
		finding,
		findAll,
		inverting,
		invert,
		hasSelection,
		maskEdge,
		setEdge,
		resetEdge,
	} = controller;
	const { apply, change: onChange, resize, setTapMode } = controller;
	const options = cutTools(findAll !== undefined).map((option) => ({
		...option,
		busy: option.tool === "tap" && finding === "one",
	}));
	const selected = Math.max(
		0,
		options.findIndex((option) => option.tool === tool),
	);
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Cut tool"
					options={options}
					selected={selected}
					onSelect={(index) => {
						const next = options[index]?.tool;
						if (!next || next === tool) return;
						onChange({ ...settings, tool: next });
					}}
				/>
			</BarGroup>
			{tool === "tap" && (
				<BarGroup>
					<OptionSegments
						label="Taps"
						options={TAP_MODES}
						selected={TAP_MODES.findIndex(
							({ mode }) => mode === settings.tapMode,
						)}
						onSelect={(index) => {
							const next = TAP_MODES[index]?.mode;
							if (next && next !== settings.tapMode) setTapMode(next);
						}}
					/>
					{resize && resizeButtons(resize, BarButton)}
				</BarGroup>
			)}
			{isCutBrush(tool) && (
				<BarGroup>
					<SizeChip
						index={cutSizeIndex(settings, tool)}
						color={tool === "add" ? colors.textPrimary : null}
						onPick={(index) => onChange(withCutSize(settings, tool, index))}
					>
						{(close) => (
							<OptionSegments
								label="Edge"
								options={BRUSH_EDGES.map(({ title, icon }) => ({
									title,
									icon,
								}))}
								selected={BRUSH_EDGES.findIndex(
									(edge) => edge.soft === settings.soft,
								)}
								onSelect={(index) => {
									const edge = BRUSH_EDGES[index];
									if (edge && edge.soft !== settings.soft) {
										onChange({ ...settings, soft: edge.soft });
									}
									close();
								}}
							/>
						)}
					</SizeChip>
				</BarGroup>
			)}
			{(findAll ||
				hasSelection ||
				invert ||
				apply.newLayer ||
				apply.removeBg) && (
				<BarGroup>
					{findAll && (
						<BarButton
							label="Subjects"
							icon="select-group"
							busy={finding === "all"}
							onPress={findAll}
						/>
					)}
					{hasSelection && setEdge && (
						<BarChip
							label={maskEdge ? "Refine edge, changed" : "Refine edge"}
							icon="feather"
							glyph={maskEdge ? <EdgeGlyph size={18} /> : undefined}
							text="Edge"
						>
							<EdgeControls
								wide
								edge={maskEdge}
								onChange={setEdge}
								onReset={resetEdge}
							/>
						</BarChip>
					)}
					{invert && (
						<BarButton
							label="Invert"
							icon="select-inverse"
							busy={inverting}
							onPress={invert}
						/>
					)}
					{(apply.newLayer || apply.removeBg) && (
						<BarChip label="Actions" icon="dots-horizontal" text="Actions">
							<View style={styles.menu}>
								{applyButtons(controller, BarButton)}
							</View>
						</BarChip>
					)}
				</BarGroup>
			)}
		</BarSections>
	);
}

/**
 * Smaller and Larger, stepping the last tap's selection through the sizes
 * found there, each disabled at its end, as the dock's or the bar's
 * `Button`. Siblings rather than a component, so a row that fades its
 * children (`FadeRow`) counts each.
 */
function resizeButtons(
	resize: NonNullable<CutController["resize"]>,
	Button: typeof ToolButton | typeof BarButton,
) {
	return [
		<Button
			key="smaller"
			label="Smaller"
			icon="arrow-collapse-all"
			disabled={resize.index === 0}
			onPress={() => resize.step(-1)}
		/>,
		<Button
			key="larger"
			label="Larger"
			icon="arrow-expand-all"
			disabled={resize.index === resize.count - 1}
			onPress={() => resize.step(1)}
		/>,
	];
}

/**
 * The Apply menu's actions, as the bar's or the tray's `Button`, each
 * spinning while it runs and the others disabled meanwhile, Adjust only
 * where the editor has it, and Remove BG only where this device finds
 * subjects. Save sticker says Saved once the selection is kept
 * as one. Siblings rather than a component, like `resizeButtons`.
 */
function applyButtons(
	{ apply, applying, stickerSaved, canAdjust }: CutController,
	Button: typeof ToolButton | typeof BarButton,
) {
	const actions = APPLY_ACTIONS.filter(
		({ action }) =>
			(action !== "adjust" || canAdjust) &&
			(action !== "removeBg" || apply.removeBg !== undefined),
	);
	return actions.map(({ action, title, icon }) => {
		const saved = action === "saveSticker" && stickerSaved;
		const onPress = apply[action];
		const busy = applying === action;
		return (
			<Button
				key={action}
				label={saved ? "Saved" : title}
				icon={saved ? "sticker-check-outline" : icon}
				busy={busy}
				disabled={!onPress || saved || (applying !== null && !busy)}
				onPress={() => onPress?.()}
			/>
		);
	});
}

/**
 * In a tray above the dock: the Apply menu's actions, the edge refinement
 * sliders, or the size of the brush in use and whether both brushes' edges
 * are soft. Tap has no brush options, so no brush options show for it.
 */
export function CutOptions({ controller }: { controller: CutController }) {
	const { bottomInset, rightInset, closeTray } = useEditorContext();
	const {
		settings,
		tool,
		change: onChange,
		tray,
		hasSelection,
		maskEdge,
		setEdge,
		resetEdge,
	} = controller;
	if (tray === "edge") {
		if (!hasSelection || !setEdge) return null;
		return (
			<ToolOptions
				closeLabel="Close edge options"
				bottomInset={bottomInset}
				rightInset={rightInset}
				onClose={closeTray}
			>
				<EdgeControls edge={maskEdge} onChange={setEdge} onReset={resetEdge} />
			</ToolOptions>
		);
	}
	if (tray === "apply") {
		// More than four don't fit a phone's width, so they split into two
		// rows, the top one as long or longer.
		const actions = applyButtons(controller, ToolButton);
		const columns =
			actions.length > 4 ? Math.ceil(actions.length / 2) : actions.length;
		return (
			<ToolOptions
				closeLabel="Close Actions"
				bottomInset={bottomInset}
				rightInset={rightInset}
				onClose={closeTray}
			>
				<View style={styles.actions}>
					{actions.map((action) => (
						<View
							key={action.key}
							style={[styles.action, { width: `${100 / columns}%` }]}
						>
							{action}
						</View>
					))}
				</View>
			</ToolOptions>
		);
	}
	if (!isCutBrush(tool)) return null;
	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
			rightInset={rightInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			<ToolOption label="Size">
				<SizeChoices
					index={cutSizeIndex(settings, tool)}
					color={tool === "add" ? colors.textPrimary : null}
					onPick={(index) => onChange(withCutSize(settings, tool, index))}
				/>
			</ToolOption>
			<ToolOption label="Edge">
				<ToolChoices>
					{BRUSH_EDGES.map(({ soft, title, icon }) => (
						<RingChoice
							key={String(soft)}
							variant="highlight"
							label={`${title} edge`}
							selected={settings.soft === soft}
							onPress={() => onChange({ ...settings, soft })}
						>
							{(ink) => (
								<MaterialCommunityIcons name={icon} size={22} color={ink} />
							)}
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
		</ToolOptions>
	);
}

/** The Edge icon with an ink dot while edge refinement is active. */
function EdgeGlyph({ size }: { size: number }) {
	return (
		<View style={styles.edgeGlyph}>
			<MaterialCommunityIcons
				name="feather"
				size={size}
				color={colors.textPrimary}
			/>
			<View style={styles.edgeDot} />
		</View>
	);
}

const styles = StyleSheet.create({
	edgeGlyph: {
		position: "relative",
	},
	edgeDot: {
		position: "absolute",
		top: -2,
		right: -3,
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: colors.primary,
	},
	pillArea: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
		gap: space.xs,
		pointerEvents: "box-none",
		zIndex: 5,
	},
	pill: {
		borderRadius: radii.large,
	},
	// A Surface fills its box, which in a column held up only by `bottom`
	// grows each pill tall on native: these hug their content instead.
	hintContent: {
		flexGrow: 0,
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
	},
	hint: {
		...typography.label,
		color: colors.textSecondary,
	},
	pillContent: {
		flexGrow: 0,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: space.xs,
		paddingVertical: 4,
		gap: 4,
	},
	divider: {
		width: 1,
		height: 20,
		backgroundColor: colors.borderStrong,
		marginHorizontal: 4,
	},
	menu: {
		gap: space.xs,
		padding: space.xs,
	},
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		rowGap: space.xs,
	},
	action: {
		alignItems: "center",
	},
});
