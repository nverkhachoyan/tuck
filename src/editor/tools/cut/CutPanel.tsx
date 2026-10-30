import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { colors, space } from "@/ui/theme";
import { useEditorContext } from "../../editorContext";
import {
	BarButton,
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SIZE_DOTS,
	SizeChip,
	SizeChoices,
	SizeDot,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import {
	type CutTapMode,
	type CutTool,
	cutSizeIndex,
	isCutBrush,
	withCutSize,
} from "./cutSettings";
import type { CutController, CutTray } from "./useCutTool";

type Icon = ComponentProps<typeof MaterialCommunityIcons>["name"];

// Cut's sub-tools, in the order the dock and the bar show them.
const CUT_TOOLS = [
	{ tool: "tap", title: "Tap", icon: "gesture-tap" },
	{ tool: "add", title: "Add", icon: "brush" },
	{ tool: "subtract", title: "Subtract", icon: "eraser" },
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

// The Apply menu's actions, in the order the popover and the tray show them.
const APPLY_ACTIONS = [
	{ action: "newLayer", title: "New layer", icon: "layers-plus" },
	{
		action: "keepOnly",
		title: "Keep only",
		icon: "image-filter-center-focus-weak",
	},
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
 * Cut's tools, in place of the toolbar while cutting an image out. Each
 * spins while it works.
 * - Subjects adds every subject to the selection, and Tap the one under a
 *   finger. Both show only where this device can find subjects
 *   (`findAll`), and spin while they're finding one (`finding`).
 * - While Tap is in use, one button says whether taps add or subtract, and
 *   switches it. After a tap, Smaller and Larger step what it selected
 *   (`resize`).
 * - Add and Subtract paint the selection by hand, with their size in a tray
 *   over the canvas. Tapping the brush in use opens its size too.
 * - Invert selects what's unselected instead (`invert`), and once something
 *   is selected, Apply opens what can be done with it in the tray (`apply`).
 */
export function CutPanel({ controller }: { controller: CutController }) {
	const { trayOpen, toggleTray, closeTray } = useEditorContext();
	const { settings, tool, finding, findAll, inverting, invert } = controller;
	const { apply, change, resize, setTapMode, tray, showInTray } = controller;
	const tapMode =
		TAP_MODES.find(({ mode }) => mode === settings.tapMode) ?? TAP_MODES[0];
	// Opens the tray on `content`, or closes it when that's what it shows.
	const openTray = (content: CutTray) => {
		if (trayOpen && tray === content) {
			closeTray();
			return;
		}
		showInTray(content);
		if (!trayOpen) toggleTray();
	};
	const pickTool = (choice: CutTool) => {
		if (choice === tool && choice !== "tap") openTray("brush");
		else change({ ...settings, tool: choice });
	};
	return (
		<ToolRow>
			{findAll && (
				<ToolButton
					label="Subjects"
					icon="auto-fix"
					busy={finding === "all"}
					onPress={findAll}
				/>
			)}
			{cutTools(findAll !== undefined).map(({ tool: choice, title, icon }) => (
				<ToolButton
					key={choice}
					label={title}
					icon={icon}
					selected={tool === choice}
					busy={choice === "tap" && finding === "one"}
					onPress={() => pickTool(choice)}
				/>
			))}
			{tool === "tap" && (
				<ToolButton
					label={tapMode.title}
					icon={tapMode.icon}
					onPress={() =>
						setTapMode(tapMode.mode === "add" ? "subtract" : "add")
					}
				/>
			)}
			{resize && resizeButtons(resize, ToolButton)}
			{isCutBrush(tool) && (
				<ToolButton
					label="Size"
					icon="circle-medium"
					glyph={
						<SizeDot
							size={SIZE_DOTS[cutSizeIndex(settings, tool)]}
							color={tool === "add" ? colors.textPrimary : null}
						/>
					}
					open={trayOpen && tray === "brush"}
					onPress={() => openTray("brush")}
				/>
			)}
			{invert && (
				<ToolButton
					label="Invert"
					icon="select-inverse"
					busy={inverting}
					onPress={invert}
				/>
			)}
			{apply.newLayer && (
				<ToolButton
					label="Apply"
					icon="dots-horizontal"
					open={trayOpen && tray === "apply"}
					onPress={() => openTray("apply")}
				/>
			)}
		</ToolRow>
	);
}

/**
 * Cut's options in the wide editor's header: Tap, Add, and Subtract, then
 * whether taps add or subtract and Smaller and Larger, or the brushes'
 * size, then Subjects, Invert, and the Apply menu, a popover. Soft and Hard
 * sit in the size chip. Choosing the sub-tool already in use leaves it,
 * since the options stay in view.
 */
export function CutBar({ controller }: { controller: CutController }) {
	const { settings, tool, finding, findAll, inverting, invert } = controller;
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
			{(findAll || invert || apply.newLayer) && (
				<BarGroup>
					{findAll && (
						<BarButton
							label="Subjects"
							icon="auto-fix"
							busy={finding === "all"}
							onPress={findAll}
						/>
					)}
					{invert && (
						<BarButton
							label="Invert"
							icon="select-inverse"
							busy={inverting}
							onPress={invert}
						/>
					)}
					{apply.newLayer && (
						<BarChip label="Apply" icon="dots-horizontal" text="Apply">
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
 * spinning while it runs and the others disabled meanwhile. Save sticker says Saved once the selection is kept
 * as one. Siblings rather than a component, like `resizeButtons`.
 */
function applyButtons(
	{ apply, applying, stickerSaved }: CutController,
	Button: typeof ToolButton | typeof BarButton,
) {
	return APPLY_ACTIONS.map(({ action, title, icon }) => {
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
 * In a tray above the dock, either the Apply menu's actions, or the size of
 * the brush in use and whether both brushes' edges are soft. Tap has no
 * options, so no brush options show for it.
 */
export function CutOptions({ controller }: { controller: CutController }) {
	const { bottomInset, closeTray } = useEditorContext();
	const { settings, tool, change: onChange, tray } = controller;
	if (tray === "apply") {
		return (
			<ToolOptions
				closeLabel="Close the Apply menu"
				bottomInset={bottomInset}
				onClose={closeTray}
			>
				<View style={styles.actions}>
					{applyButtons(controller, ToolButton)}
				</View>
			</ToolOptions>
		);
	}
	if (!isCutBrush(tool)) return null;
	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
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

const styles = StyleSheet.create({
	menu: {
		gap: space.xs,
		padding: space.xs,
	},
	actions: {
		flexDirection: "row",
		justifyContent: "space-around",
	},
});
