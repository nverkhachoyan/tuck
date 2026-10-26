import type { ComponentProps, ReactNode } from "react";
import type { Adjustments } from "@/model/adjustments";
import type { DockPanel } from "./editorChrome";
import {
	type EditorModeAction,
	type EditorModeState,
	openTray,
} from "./editorMode";
import { EyedropperHint } from "./shell/ColorPicker";
import { ContextBar } from "./shell/ContextBar";
import type { ModeActionProps } from "./shell/Dock";
import { LayerActionsPanel, LayerBar } from "./shell/LayerActionsPanel";
import { AdjustPanel } from "./tools/adjust/AdjustPanel";
import {
	CutOutBar,
	CutOutOptions,
	CutOutPanel,
} from "./tools/cutout/CutOutPanel";
import { withBrushColor } from "./tools/draw/brushSettings";
import { BrushOptions, DrawBar, DrawPanel } from "./tools/draw/DrawPanel";
import { FindBar, FindPanel, FindTray } from "./tools/find/FindPanel";
import {
	EffectGlyph,
	RedactBar,
	RedactOptions,
	RedactPanel,
} from "./tools/redact/RedactPanel";
import {
	TextBar,
	TextColorPicker,
	TextStylePanel,
} from "./tools/text/TextStylePanel";
import type { EditorTools } from "./useToolLifecycle";

export type { EditorTools } from "./useToolLifecycle";

/**
 * What every tool view reads, built once by the screen for the dock, the bar,
 * the trays, and the inspector.
 */
export type ToolViewContext = {
	tools: EditorTools;
	dispatchMode: (action: EditorModeAction) => void;
	customColor: string | null;
	// A color from a picker, which becomes the custom color.
	onCustomColor: (color: string) => void;
	// For a tray or bar whose colors go to `apply`: a color from its picker,
	// which becomes the custom color too, and the eyedropper, for a color
	// from the canvas.
	colorTarget: (apply: (color: string) => void) => {
		onPickCustom: (color: string) => void;
		onEyedropper: () => void;
	};
	// Whether the phone's tray of tool options is open.
	optionsOpen: boolean;
	toggleOptions: () => void;
	closeTray: () => void;
	bottomInset: number;
	// Redact's way into Find, when there's an image to search.
	onFind: (() => void) | undefined;
	// Find's way out when it found nothing: what its ✕ does.
	onBackToRedact: () => void;
	adjustments: Adjustments | undefined;
	layerActions: ComponentProps<typeof LayerActionsPanel> | undefined;
	editingText: boolean;
	restoreTextFocus: () => void;
};

/** Builds the tool views' context, binding `colorTarget` to `onCustomColor`. */
export function toolViewContext(
	props: Omit<ToolViewContext, "colorTarget" | "toggleOptions" | "closeTray">,
): ToolViewContext {
	const { dispatchMode, onCustomColor } = props;
	return {
		...props,
		colorTarget: (apply) => ({
			onPickCustom: (color) => {
				apply(color);
				onCustomColor(color);
			},
			onEyedropper: () =>
				dispatchMode({ type: "startEyedropper", eyedropper: { apply } }),
		}),
		toggleOptions: () => dispatchMode({ type: "toggleToolOptions" }),
		closeTray: () => dispatchMode({ type: "closeToolOptions" }),
	};
}

/**
 * What opens over the canvas, above the dock: the tool's tray, Find's
 * results, a text color picker, and the eyedropper's hint.
 */
export function ToolTrays({
	context,
	modeState,
}: {
	context: ToolViewContext;
	modeState: EditorModeState;
}) {
	const {
		tools: { draw, redact, find, cut, text },
		dispatchMode,
		customColor,
		colorTarget,
		closeTray,
		bottomInset,
		onBackToRedact,
	} = context;
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = text;
	const tray = openTray(mode);
	return (
		<>
			{tray === "draw" && (
				<BrushOptions
					settings={draw.settings}
					customColor={customColor}
					bottomInset={bottomInset}
					onChange={draw.change}
					{...colorTarget((color) =>
						draw.change(withBrushColor(draw.settings, color)),
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
 * open tool's options, or a selected layer's actions. Phones have no bar;
 * the dock shows the same tools. With nothing in context, the header keeps
 * the title.
 */
export function ContextBarContent({
	context,
	panel,
	chrome,
}: {
	context: ToolViewContext;
	panel: DockPanel;
	// The bar's title, Cancel, and Done, which `modeChrome` chose.
	chrome: { title: string } & ModeActionProps;
}) {
	const {
		tools: { draw, redact, cut, text },
		customColor,
		onCustomColor,
		colorTarget,
		onFind,
		editingText,
		restoreTextFocus,
		layerActions,
	} = context;
	if (panel === "draw") {
		return (
			<ContextBar {...chrome}>
				<DrawBar
					settings={draw.settings}
					customColor={customColor}
					onChange={draw.change}
					{...colorTarget((color) =>
						draw.change(withBrushColor(draw.settings, color)),
					)}
				/>
			</ContextBar>
		);
	}
	if (panel === "redact") {
		return (
			<ContextBar {...chrome}>
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
			<ContextBar {...chrome}>
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
	if (panel === "cutOut") {
		return (
			<ContextBar {...chrome}>
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
			<ContextBar {...chrome} keepFocus={editingText}>
				<TextBar
					layer={styledText}
					customColor={customColor}
					onChange={text.style}
					onPickCustom={onCustomColor}
					onEyedropper={(key) =>
						colorTarget((color) => text.style({ [key]: color })).onEyedropper()
					}
					restoreFocus={editingText ? restoreTextFocus : undefined}
				/>
			</ContextBar>
		);
	}
	if (panel === "adjust") {
		return <ContextBar {...chrome}>{null}</ContextBar>;
	}
	if (panel === "layer" && layerActions) {
		return (
			<ContextBar {...chrome}>
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
	context,
	panel,
	idle,
}: {
	context: ToolViewContext;
	panel: DockPanel;
	idle: ReactNode;
}) {
	const {
		tools: { draw, redact, find, cut, adjust, text },
		dispatchMode,
		customColor,
		optionsOpen,
		toggleOptions,
		onFind,
		adjustments,
		layerActions,
	} = context;
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
