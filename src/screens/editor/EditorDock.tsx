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
import { LayerActionsPanel } from "./shell/LayerActionsPanel";
import { AdjustPanel } from "./tools/adjust/AdjustPanel";
import type { useAdjustTool } from "./tools/adjust/useAdjustTool";
import { CutOutOptions, CutOutPanel } from "./tools/cutout/CutOutPanel";
import type { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { BrushOptions, DrawBar, DrawPanel } from "./tools/draw/DrawPanel";
import type { useDrawTool } from "./tools/draw/useDrawTool";
import { FindBar, FindPanel, FindTray } from "./tools/find/FindPanel";
import type { useFindTool } from "./tools/find/useFindTool";
import {
	EffectGlyph,
	RedactBar,
	RedactOptions,
	RedactPanel,
} from "./tools/redact/RedactPanel";
import type { useRedactTool } from "./tools/redact/useRedactTool";
import { TextColorPicker, TextStylePanel } from "./tools/text/TextStylePanel";
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
 * What opens over the canvas, above the dock: the tool's tray, Find's
 * results, a text color picker, and the eyedropper's hint.
 */
export function ToolTrays({
	modeState,
	dispatchMode,
	tools: { draw, redact, find, cut, text },
	customColor,
	onCustomColor,
	bottomInset,
	wide = false,
}: ModeProps & {
	modeState: EditorModeState;
	onCustomColor: (color: string) => void;
	bottomInset: number;
	// A wide screen shows Draw, Redact, and Find in the header, so their trays
	// stay shut. Find's results are an inspector section instead of a tray.
	wide?: boolean;
}) {
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = text;
	const tray = openTray(mode);
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
			{tray === "draw" && !wide && (
				<BrushOptions
					settings={draw.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={draw.change}
					{...colorTarget((color) => draw.change({ ...draw.settings, color }))}
					onClose={closeTray}
				/>
			)}
			{tray === "redact" && !wide && (
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
			{tray === "find" && !wide && (
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
			{mode.type === "tool" &&
				mode.tool === "find" &&
				!tray &&
				!eyedropper &&
				!wide && (
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
					{...colorTarget((color) => text.style({ [textPicker.key]: color }))}
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
 * open tool's options. Phones have no bar; the dock shows the same tool.
 * Draw, Redact, and Find so far. The others still use the inspector.
 */
export function ContextBarContent({
	panel,
	dispatchMode,
	tools: { draw, redact },
	customColor,
	onCustomColor,
	onFind,
	onCancel,
	onDone,
	doneLabel,
}: ModeProps & {
	panel: DockPanel;
	onCustomColor: (color: string) => void;
	onFind?: () => void;
	onCancel: () => void;
	onDone: () => void;
	doneLabel?: string;
}) {
	// For a bar whose colors go to `apply`: a color from its picker, which
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
					{...colorTarget((color) => draw.change({ ...draw.settings, color }))}
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
					{...colorTarget((color) =>
						redact.change({ ...redact.settings, color }),
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
					{...colorTarget((color) =>
						redact.setChosen((current) => ({ ...current, color })),
					)}
				/>
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
