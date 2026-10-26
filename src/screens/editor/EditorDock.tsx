import type { ComponentProps, ReactNode } from "react";
import type { Adjustments } from "@/model/adjustments";
import {
	type EditorModeAction,
	type EditorModeState,
	type EditorTool,
	openTray,
} from "./editorMode";
import { EyedropperHint } from "./shell/ColorPicker";
import { ContextBar } from "./shell/ContextBar";
import { LayerActionsPanel, LayerBar } from "./shell/LayerActionsPanel";
import { AdjustPanel } from "./tools/adjust/AdjustPanel";
import type { useAdjustTool } from "./tools/adjust/useAdjustTool";
import {
	CutOutBar,
	CutOutOptions,
	CutOutPanel,
} from "./tools/cutout/CutOutPanel";
import type { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { withBrushColor } from "./tools/draw/brushSettings";
import { BrushOptions, DrawBar, DrawPanel } from "./tools/draw/DrawPanel";
import type { useDrawTool } from "./tools/draw/useDrawTool";
import { FindBar, FindPanel, FindTray } from "./tools/find/FindPanel";
import type { useFindTool } from "./tools/find/useFindTool";
import { layerKindName } from "./tools/layers/LayerRow";
import {
	EffectGlyph,
	RedactBar,
	RedactOptions,
	RedactPanel,
} from "./tools/redact/RedactPanel";
import type { useRedactTool } from "./tools/redact/useRedactTool";
import {
	TextBar,
	TextColorPicker,
	TextStylePanel,
} from "./tools/text/TextStylePanel";
import type { useTextEditing } from "./tools/text/useTextEditing";

// What the dock shows: a tool's panel, text's style, the selected layer's
// actions, or, with nothing selected, the tools or the layers.
export type DockPanel = EditorTool | "text" | "layer" | "idle";

export type EditorTools = {
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cut: ReturnType<typeof useCutOutTool>;
	adjust: ReturnType<typeof useAdjustTool>;
	text: ReturnType<typeof useTextEditing>;
};

type ModeProps = {
	dispatchMode: (action: EditorModeAction) => void;
	tools: EditorTools;
	customColor: string | null;
};

/**
 * For a tray or bar whose colors go to `apply`: a color from its picker, which
 * becomes the custom color too, and the eyedropper, for a color from the
 * canvas.
 */
function colorTarget(
	apply: (color: string) => void,
	onCustomColor: (color: string) => void,
	dispatchMode: (action: EditorModeAction) => void,
) {
	return {
		onPickCustom: (color: string) => {
			apply(color);
			onCustomColor(color);
		},
		onEyedropper: () =>
			dispatchMode({ type: "startEyedropper", eyedropper: { apply } }),
	};
}

/**
 * What opens over the canvas, above the dock: the tool's tray, Find's
 * results, a text color picker, and the eyedropper's hint.
 */
export function ToolTrays({
	modeState,
	dispatchMode,
	tools: { draw, redact, find, cut, text },
	customColor,
	onCustomColor,
	onBackToRedact,
	bottomInset,
}: ModeProps & {
	modeState: EditorModeState;
	onCustomColor: (color: string) => void;
	// Find's way out when it found nothing: what its ✕ does.
	onBackToRedact: () => void;
	bottomInset: number;
}) {
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = text;
	const tray = openTray(mode);
	const closeTray = () => dispatchMode({ type: "closeToolOptions" });
	return (
		<>
			{tray === "draw" && (
				<BrushOptions
					settings={draw.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={draw.change}
					{...colorTarget(
						(color) => draw.change(withBrushColor(draw.settings, color)),
						onCustomColor,
						dispatchMode,
					)}
					onClose={closeTray}
				/>
			)}
			{tray === "redact" && (
				<RedactOptions
					settings={redact.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={redact.change}
					{...colorTarget(
						(color) => redact.change({ ...redact.settings, color }),
						onCustomColor,
						dispatchMode,
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
					{...colorTarget(
						(color) => redact.setChosen((settings) => ({ ...settings, color })),
						onCustomColor,
						dispatchMode,
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
					review={find.review}
					bottomInset={bottomInset}
					onRetry={find.retry}
					onBack={onBackToRedact}
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
					{...colorTarget(
						(color) => text.style({ [textPicker.key]: color }),
						onCustomColor,
						dispatchMode,
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
 * What the wide editor's header holds instead of the project's title: the
 * open tool's options, or a selected layer's actions. Phones have no bar;
 * the dock shows the same tools. With nothing in context, the header keeps
 * the title.
 */
export function ContextBarContent({
	panel,
	dispatchMode,
	tools: { draw, redact, cut, text },
	customColor,
	onCustomColor,
	onFind,
	onCancel,
	onDone,
	doneLabel,
	editingText = false,
	restoreTextFocus,
	layerActions,
}: ModeProps & {
	panel: DockPanel;
	onCustomColor: (color: string) => void;
	onFind?: () => void;
	onCancel?: () => void;
	onDone: () => void;
	doneLabel?: string;
	editingText?: boolean;
	restoreTextFocus?: () => void;
	layerActions?: ComponentProps<typeof LayerActionsPanel>;
}) {
	if (panel === "draw") {
		return (
			<ContextBar
				title="Draw"
				onCancel={onCancel}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut="Escape"
			>
				<DrawBar
					settings={draw.settings}
					customColor={customColor}
					onChange={draw.change}
					{...colorTarget(
						(color) => draw.change(withBrushColor(draw.settings, color)),
						onCustomColor,
						dispatchMode,
					)}
				/>
			</ContextBar>
		);
	}
	if (panel === "redact") {
		return (
			<ContextBar
				title="Redact"
				onCancel={onCancel}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut="Escape"
			>
				<RedactBar
					settings={redact.settings}
					customColor={customColor}
					onChange={redact.change}
					onFind={onFind}
					{...colorTarget(
						(color) => redact.change({ ...redact.settings, color }),
						onCustomColor,
						dispatchMode,
					)}
				/>
			</ContextBar>
		);
	}
	if (panel === "find") {
		return (
			<ContextBar
				title="Find"
				onCancel={onCancel}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut="Escape"
			>
				<FindBar
					settings={redact.chosen}
					customColor={customColor}
					onChange={(next) =>
						redact.setChosen((current) => ({ ...current, ...next }))
					}
					{...colorTarget(
						(color) => redact.setChosen((current) => ({ ...current, color })),
						onCustomColor,
						dispatchMode,
					)}
				/>
			</ContextBar>
		);
	}
	if (panel === "cutOut") {
		return (
			<ContextBar
				title="Cut out"
				onCancel={onCancel}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut="Escape"
			>
				<CutOutBar
					settings={cut.settings}
					tool={cut.tool}
					finding={cut.finding}
					onChange={cut.change}
					onFindAll={cut.findAll}
					inverting={cut.inverting}
					onInvert={cut.invert}
					redacting={cut.redacting}
					onRedact={cut.redact}
				/>
			</ContextBar>
		);
	}
	if (panel === "text") {
		const { styledText } = text;
		if (!styledText) return null;
		return (
			<ContextBar
				title="Text"
				keepFocus={editingText}
				onCancel={onCancel}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut="Escape"
			>
				<TextBar
					layer={styledText}
					customColor={customColor}
					onChange={text.style}
					onPickCustom={onCustomColor}
					onEyedropper={(key) =>
						colorTarget(
							(color) => text.style({ [key]: color }),
							onCustomColor,
							dispatchMode,
						).onEyedropper()
					}
					restoreFocus={editingText ? restoreTextFocus : undefined}
				/>
			</ContextBar>
		);
	}
	if (panel === "adjust") {
		return (
			<ContextBar
				title="Adjust"
				onCancel={onCancel}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut="Escape"
			>
				{null}
			</ContextBar>
		);
	}
	if (panel === "layer" && layerActions) {
		return (
			<ContextBar
				title={layerKindName(layerActions.layer)}
				onDone={onDone}
				doneShortcut="Escape"
			>
				<LayerBar {...layerActions} />
			</ContextBar>
		);
	}
	return null;
}

/**
 * What the dock holds: the open tool's panel, the style of the text being
 * typed or selected, the selected layer's actions, or else `idle`.
 */
export function DockContent({
	panel,
	optionsOpen,
	dispatchMode,
	tools: { draw, redact, find, cut, adjust, text },
	adjustments,
	customColor,
	layerActions,
	idle,
	onFind,
}: ModeProps & {
	panel: DockPanel;
	optionsOpen: boolean;
	onFind: (() => void) | undefined;
	adjustments: Adjustments | undefined;
	layerActions: ComponentProps<typeof LayerActionsPanel> | undefined;
	idle: ReactNode;
}) {
	const toggleOptions = () => dispatchMode({ type: "toggleToolOptions" });
	const { styledText } = text;
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
			return <AdjustPanel controller={adjust} adjustments={adjustments} />;
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
						onChange={text.style}
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
