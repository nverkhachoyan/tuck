import type { ComponentProps, ReactNode } from "react";
import type { Adjustments } from "@/model/adjustments";
import type {
	EditorModeAction,
	EditorModeState,
	EditorTool,
} from "./editorMode";
import { EyedropperHint } from "./shell/ColorPicker";
import { LayerActionsPanel } from "./shell/LayerActionsPanel";
import { AdjustPanel } from "./tools/adjust/AdjustPanel";
import type { useAdjustController } from "./tools/adjust/useAdjustController";
import { CutOutOptions, CutOutPanel } from "./tools/cutout/CutOutPanel";
import type { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { BrushOptions, DrawPanel } from "./tools/draw/DrawPanel";
import type { useDrawTool } from "./tools/draw/useDrawTool";
import { FindPanel, FindTray } from "./tools/find/FindPanel";
import type { useFindTool } from "./tools/find/useFindTool";
import {
	EffectGlyph,
	RedactOptions,
	RedactPanel,
} from "./tools/redact/RedactPanel";
import type { useRedactTool } from "./tools/redact/useRedactTool";
import { TextColorPicker, TextStylePanel } from "./tools/text/TextStylePanel";
import type { TextEditing, useTextEditing } from "./tools/text/useTextEditing";

// What the dock shows: a tool's panel, text's style, the selected layer's
// actions, or, with nothing selected, the tools or the layers.
export type DockPanel = EditorTool | "text" | "layer" | "idle";

type ModeProps = {
	dispatchMode: (action: EditorModeAction<TextEditing>) => void;
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cut: ReturnType<typeof useCutOutTool>;
	textEditing: ReturnType<typeof useTextEditing>;
	customColor: string | null;
};

/**
 * What opens over the canvas, above the dock: the tool's tray, Find's
 * results, a text color picker, and the eyedropper's hint.
 */
export function ToolTrays({
	modeState,
	dispatchMode,
	draw,
	redact,
	find,
	cut,
	textEditing,
	customColor,
	onCustomColor,
	bottomInset,
}: ModeProps & {
	modeState: EditorModeState<TextEditing>;
	onCustomColor: (color: string) => void;
	bottomInset: number;
}) {
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = textEditing;
	const tray =
		mode.type === "tool" && mode.tool !== "adjust" && mode.optionsOpen
			? mode.tool
			: null;
	const closeTray = () => dispatchMode({ type: "closeToolOptions" });
	// For a tray whose colors go to `apply`: a color from its picker, which
	// becomes the custom color too, and the eyedropper, for a color from the
	// canvas.
	const colorTarget = (apply: (color: string) => void) => ({
		onPickCustom: (color: string) => {
			apply(color);
			onCustomColor(color);
		},
		onEyedropper: () =>
			dispatchMode({ type: "startEyedropper", eyedropper: { apply } }),
	});
	return (
		<>
			{tray === "draw" && (
				<BrushOptions
					settings={draw.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={draw.change}
					{...colorTarget((color) => draw.change({ ...draw.settings, color }))}
					onClose={closeTray}
				/>
			)}
			{tray === "redact" && (
				<RedactOptions
					settings={redact.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={redact.change}
					{...colorTarget((color) =>
						redact.change({ ...redact.settings, color }),
					)}
					onClose={closeTray}
				/>
			)}
			{tray === "find" && (
				<RedactOptions
					settings={{ ...redact.chosen, tool: "box" }}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={({ tool: _, ...style }) =>
						redact.setChosen((settings) => ({ ...settings, ...style }))
					}
					{...colorTarget((color) =>
						redact.setChosen((settings) => ({ ...settings, color })),
					)}
					onClose={closeTray}
				/>
			)}
			{tray === "cutOut" && cut.tool !== "pick" && (
				<CutOutOptions
					settings={cut.settings}
					tool={cut.tool}
					bottomInset={bottomInset}
					onChange={cut.change}
					onClose={closeTray}
				/>
			)}
			{mode.type === "tool" && mode.tool === "find" && !tray && !eyedropper && (
				<FindTray
					state={find.state}
					visibleIndices={find.visibleIndices}
					selectedCount={find.selectedCount}
					bottomInset={bottomInset}
					onRetry={find.retry}
					onStop={find.reset}
					onSelectAll={find.selectAll}
					onClear={find.clear}
				/>
			)}
			{textPicker && styledText && (
				<TextColorPicker
					layer={styledText}
					colorKey={textPicker.key}
					bottomInset={bottomInset}
					{...colorTarget((color) =>
						textEditing.style({ [textPicker.key]: color }),
					)}
					onClose={() => dispatchMode({ type: "closeTextPicker" })}
				/>
			)}
			{eyedropper && (
				<EyedropperHint
					onCancel={() => dispatchMode({ type: "stopEyedropper" })}
				/>
			)}
		</>
	);
}

/**
 * What the dock holds: the open tool's panel, the style of the text being
 * typed or selected, the selected layer's actions, or else `idle`.
 */
export function DockContent({
	panel,
	optionsOpen,
	dispatchMode,
	draw,
	redact,
	find,
	cut,
	adjustController,
	adjustments,
	textEditing,
	customColor,
	layerActions,
	idle,
	onFind,
}: ModeProps & {
	panel: DockPanel;
	optionsOpen: boolean;
	onFind: (() => void) | undefined;
	adjustController: ReturnType<typeof useAdjustController>;
	adjustments: Adjustments | undefined;
	layerActions: ComponentProps<typeof LayerActionsPanel> | undefined;
	idle: ReactNode;
}) {
	const toggleOptions = () => dispatchMode({ type: "toggleToolOptions" });
	const { styledText } = textEditing;
	switch (panel) {
		case "draw":
			return (
				<DrawPanel
					settings={draw.settings}
					optionsOpen={optionsOpen}
					onChange={draw.change}
					onToggleOptions={toggleOptions}
				/>
			);
		case "redact":
			return (
				<RedactPanel
					settings={redact.settings}
					optionsOpen={optionsOpen}
					onChange={redact.change}
					onToggleOptions={toggleOptions}
					onFind={onFind}
				/>
			);
		case "find":
			return (
				<FindPanel
					state={find.state}
					styleGlyph={
						<EffectGlyph
							settings={redact.chosen}
							effect={redact.chosen.effect}
						/>
					}
					optionsOpen={optionsOpen}
					onFind={find.find}
					onToggleOptions={toggleOptions}
				/>
			);
		case "adjust":
			return (
				<AdjustPanel controller={adjustController} adjustments={adjustments} />
			);
		case "cutOut":
			return (
				<CutOutPanel
					settings={cut.settings}
					tool={cut.tool}
					finding={cut.finding}
					optionsOpen={optionsOpen}
					onChange={cut.change}
					onToggleOptions={toggleOptions}
					onFindAll={cut.findAll}
					inverting={cut.inverting}
					onInvert={cut.invert}
					redacting={cut.redacting}
					onRedact={cut.redact}
				/>
			);
		case "text":
			return (
				styledText && (
					<TextStylePanel
						layer={styledText}
						customColor={customColor}
						onChange={textEditing.style}
						onOpenPicker={(key) =>
							dispatchMode({
								type: "openTextPicker",
								layerId: styledText.id,
								key,
							})
						}
					/>
				)
			);
		case "layer":
			return layerActions && <LayerActionsPanel {...layerActions} />;
		case "idle":
			return idle;
	}
}
