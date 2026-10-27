import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import { useEditorContext } from "../../editorContext";
import {
	BarButton,
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
	type CutOutTool,
	cutSizeIndex,
	isCutBrush,
	withCutSize,
} from "./cutOutSettings";
import type { CutOutController } from "./useCutOutTool";

type Icon = ComponentProps<typeof MaterialCommunityIcons>["name"];

// Cut out's sub-tools, in the order the dock and the bar show them.
const CUT_TOOLS = [
	{ tool: "pick", title: "Pick", icon: "gesture-tap" },
	{ tool: "keep", title: "Keep", icon: "brush" },
	{ tool: "erase", title: "Erase", icon: "eraser" },
] as const satisfies readonly { tool: CutOutTool; title: string; icon: Icon }[];

// The sub-tools on offer: Pick only where this device can find subjects.
const cutTools = (canPick: boolean) =>
	CUT_TOOLS.filter(({ tool }) => canPick || tool !== "pick");

// The brushes' edges, in the order the size chip's popover and the tray
// show them.
const BRUSH_EDGES = [
	{ soft: true, title: "Soft", icon: "blur-radial" },
	{ soft: false, title: "Hard", icon: "circle" },
] as const satisfies readonly { soft: boolean; title: string; icon: Icon }[];

/**
 * Cut out's tools, in place of the toolbar while cutting an image out:
 * Subjects cuts out every subject again, Pick the one under a tap, and Keep
 * and Erase paint the cut by hand, with their size in a tray over the
 * canvas. Tapping the brush in use opens its size too. Subjects and Pick
 * show only where this device can find subjects (`findAll`), and spin
 * while they're finding one (`finding`). Once there's a cut, Invert keeps
 * what it removes instead and removes what it keeps (`invert`), and Redact
 * hides what it keeps under a redaction (`redact`): inverted first, that
 * blurs only the background. Each spins while it works.
 */
export function CutOutPanel({ controller }: { controller: CutOutController }) {
	const { trayOpen, toggleTray } = useEditorContext();
	const { settings, tool, finding, findAll, inverting, invert } = controller;
	const { redacting, redact, change } = controller;
	const pickTool = (choice: CutOutTool) => {
		if (choice === tool && choice !== "pick") toggleTray();
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
					busy={choice === "pick" && finding === "one"}
					onPress={() => pickTool(choice)}
				/>
			))}
			{isCutBrush(tool) && (
				<ToolButton
					label="Size"
					icon="circle-medium"
					glyph={
						<SizeDot
							size={SIZE_DOTS[cutSizeIndex(settings, tool)]}
							color={tool === "keep" ? colors.textPrimary : null}
						/>
					}
					open={trayOpen}
					onPress={toggleTray}
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
			{redact && (
				<ToolButton
					label="Redact"
					icon="blur"
					busy={redacting}
					onPress={redact}
				/>
			)}
		</ToolRow>
	);
}

/**
 * Cut out's options in the wide editor's header: Pick, Keep, and Erase, then
 * the brushes' size, then Subjects, Invert, and Redact. Soft and Hard sit in
 * the size chip. Choosing the sub-tool already in use leaves it, since the
 * options stay in view. The canvas wash is unchanged.
 */
export function CutOutBar({ controller }: { controller: CutOutController }) {
	const { settings, tool, finding, findAll, inverting, invert } = controller;
	const { redacting, redact, change: onChange } = controller;
	const options = cutTools(findAll !== undefined).map((option) => ({
		...option,
		busy: option.tool === "pick" && finding === "one",
	}));
	const selected = Math.max(
		0,
		options.findIndex((option) => option.tool === tool),
	);
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Cut out tool"
					options={options}
					selected={selected}
					onSelect={(index) => {
						const next = options[index]?.tool;
						if (!next || next === tool) return;
						onChange({ ...settings, tool: next });
					}}
				/>
			</BarGroup>
			{isCutBrush(tool) && (
				<BarGroup>
					<SizeChip
						index={cutSizeIndex(settings, tool)}
						color={tool === "keep" ? colors.textPrimary : null}
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
			{(findAll || invert || redact) && (
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
					{redact && (
						<BarButton
							label="Redact"
							icon="blur"
							busy={redacting}
							onPress={redact}
						/>
					)}
				</BarGroup>
			)}
		</BarSections>
	);
}

/**
 * The size of the brush in use, and whether both brushes' edges are soft,
 * in a tray above the dock. Pick has no options, so none show for it.
 */
export function CutOutOptions({
	controller,
}: {
	controller: CutOutController;
}) {
	const { bottomInset, closeTray } = useEditorContext();
	const { settings, tool, change: onChange } = controller;
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
					color={tool === "keep" ? colors.textPrimary : null}
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
