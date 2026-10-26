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
import type { RedactSettings } from "./tools/redact/redactSettings";
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

/** Draw's color, from its picker or the eyedropper, in its tray and its bar. */
function drawColor({
	tools: { draw },
	customColor,
	colorTarget,
}: ToolViewContext) {
	return {
		customColor,
		...colorTarget((color) =>
			draw.change(withBrushColor(draw.settings, color)),
		),
	};
}

/** Redact's color, in its tray and its bar. */
function redactColor({
	tools: { redact },
	customColor,
	colorTarget,
}: ToolViewContext) {
	return {
		customColor,
		...colorTarget((color) => redact.change({ ...redact.settings, color })),
	};
}

/**
 * The style Find redacts with, Redact's `chosen`, in Find's tray and bar. It
 * shows as the box tool, and a change leaves `chosen`'s own tool alone.
 */
function findStyle({
	tools: { redact },
	customColor,
	colorTarget,
}: ToolViewContext) {
	return {
		settings: { ...redact.chosen, tool: "box" as const },
		customColor,
		onChange: ({ tool: _, ...style }: Partial<RedactSettings>) =>
			redact.setChosen((settings) => ({ ...settings, ...style })),
		...colorTarget((color) =>
			redact.setChosen((settings) => ({ ...settings, color })),
		),
	};
}

/** What Cut out's dock panel and bar both take. */
function cutOutProps({ tools: { cut } }: ToolViewContext) {
	return {
		settings: cut.settings,
		tool: cut.tool,
		finding: cut.finding,
		onChange: cut.change,
		onFindAll: cut.findAll,
		inverting: cut.inverting,
		onInvert: cut.invert,
		redacting: cut.redacting,
		onRedact: cut.redact,
	};
}

/**
 * What one panel shows, wherever the editor shows it. Each field renders
 * elements from the context and calls no hooks, so React keeps each view as
 * it would a switch's branch.
 * - `dock`: the phone dock's panel.
 * - `bar`: the wide header's options, inside the shared `ContextBar`; without
 *   it, the bar has the title, ✕, and ✓ only.
 * - `keepBarFocus`: whether a press in the bar keeps the text's caret.
 * - `tray`: the phone's tray of options, while `optionsOpen`. Redact's and
 *   Find's are both `RedactOptions`, but React never carries one's state to
 *   the other: starting a tool always closes the tray.
 * - `results`: what sits over the canvas while no tray is open and the
 *   eyedropper isn't running.
 * - `inspector`: a section above the wide inspector's layers, given them as
 *   `layers`.
 */
type ToolViews = {
	dock: (context: ToolViewContext) => ReactNode;
	bar?: (context: ToolViewContext) => ReactNode;
	keepBarFocus?: (context: ToolViewContext) => boolean;
	tray?: (context: ToolViewContext) => ReactNode;
	results?: (context: ToolViewContext) => ReactNode;
	inspector?: (context: ToolViewContext, layers: ReactNode) => ReactNode;
};

/**
 * Every panel's views but `"idle"`'s, whose dock the screen passes in and
 * which is never in the bar. A tool added to `EditorTool` needs an entry
 * here. `modeChrome` picks `"text"` only with styled text and `"layer"` only
 * with a selected layer, so their checks below never fail.
 */
const TOOL_VIEWS: Record<Exclude<DockPanel, "idle">, ToolViews> = {
	draw: {
		dock: ({ tools: { draw }, optionsOpen, toggleOptions }) => (
			<DrawPanel
				settings={draw.settings}
				optionsOpen={optionsOpen}
				onChange={draw.change}
				onToggleOptions={toggleOptions}
			/>
		),
		tray: (context) => (
			<BrushOptions
				settings={context.tools.draw.settings}
				bottomInset={context.bottomInset}
				onChange={context.tools.draw.change}
				{...drawColor(context)}
				onClose={context.closeTray}
			/>
		),
		bar: (context) => (
			<DrawBar
				settings={context.tools.draw.settings}
				onChange={context.tools.draw.change}
				{...drawColor(context)}
			/>
		),
	},
	redact: {
		dock: ({ tools: { redact }, optionsOpen, toggleOptions, onFind }) => (
			<RedactPanel
				settings={redact.settings}
				optionsOpen={optionsOpen}
				onChange={redact.change}
				onToggleOptions={toggleOptions}
				onFind={onFind}
			/>
		),
		tray: (context) => (
			<RedactOptions
				settings={context.tools.redact.settings}
				bottomInset={context.bottomInset}
				onChange={context.tools.redact.change}
				{...redactColor(context)}
				onClose={context.closeTray}
			/>
		),
		bar: (context) => (
			<RedactBar
				settings={context.tools.redact.settings}
				onChange={context.tools.redact.change}
				onFind={context.onFind}
				{...redactColor(context)}
			/>
		),
	},
	find: {
		dock: ({ tools: { find, redact }, optionsOpen, toggleOptions }) => (
			<FindPanel
				state={find.state}
				styleGlyph={
					<EffectGlyph settings={redact.chosen} effect={redact.chosen.effect} />
				}
				optionsOpen={optionsOpen}
				onFind={find.find}
				onToggleOptions={toggleOptions}
			/>
		),
		tray: (context) => (
			<RedactOptions
				{...findStyle(context)}
				bottomInset={context.bottomInset}
				onClose={context.closeTray}
			/>
		),
		results: ({ tools: { find }, bottomInset, onBackToRedact }) => (
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
		),
		bar: (context) => <FindBar {...findStyle(context)} />,
	},
	cutOut: {
		dock: (context) => (
			<CutOutPanel
				{...cutOutProps(context)}
				optionsOpen={context.optionsOpen}
				onToggleOptions={context.toggleOptions}
			/>
		),
		// The pick tool has no options.
		tray: ({ tools: { cut }, bottomInset, closeTray }) =>
			cut.tool !== "pick" && (
				<CutOutOptions
					settings={cut.settings}
					tool={cut.tool}
					bottomInset={bottomInset}
					onChange={cut.change}
					onClose={closeTray}
				/>
			),
		bar: (context) => <CutOutBar {...cutOutProps(context)} />,
	},
	adjust: {
		dock: ({ tools: { adjust }, adjustments }) => (
			<AdjustPanel controller={adjust} adjustments={adjustments} />
		),
	},
	text: {
		dock: ({ tools: { text }, customColor, dispatchMode }) => {
			const { styledText } = text;
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
		},
		bar: ({
			tools: { text },
			customColor,
			onCustomColor,
			colorTarget,
			editingText,
			restoreTextFocus,
		}) =>
			text.styledText && (
				<TextBar
					layer={text.styledText}
					customColor={customColor}
					onChange={text.style}
					onPickCustom={onCustomColor}
					onEyedropper={(key) =>
						colorTarget((color) => text.style({ [key]: color })).onEyedropper()
					}
					restoreFocus={editingText ? restoreTextFocus : undefined}
				/>
			),
		keepBarFocus: ({ editingText }) => editingText,
	},
	layer: {
		dock: ({ layerActions }) =>
			layerActions && <LayerActionsPanel {...layerActions} />,
		bar: ({ layerActions }) => layerActions && <LayerBar {...layerActions} />,
	},
};

/**
 * What opens over the canvas, above the dock: the tool's tray, Find's
 * results, a text color picker, and the eyedropper's hint.
 */
export function ToolTrays({
	context,
	modeState,
	panel,
}: {
	context: ToolViewContext;
	modeState: EditorModeState;
	panel: DockPanel;
}) {
	const {
		tools: { text },
		dispatchMode,
		colorTarget,
		bottomInset,
	} = context;
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = text;
	const tray = openTray(mode);
	return (
		<>
			{tray && TOOL_VIEWS[tray].tray?.(context)}
			{!tray &&
				!eyedropper &&
				panel !== "idle" &&
				TOOL_VIEWS[panel].results?.(context)}
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
 * the title. One `ContextBar` stays mounted as the panel changes, keeping
 * its scroll and fades.
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
	if (panel === "idle") return null;
	const views = TOOL_VIEWS[panel];
	return (
		<ContextBar {...chrome} keepFocus={views.keepBarFocus?.(context) ?? false}>
			{views.bar?.(context) ?? null}
		</ContextBar>
	);
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
	return panel === "idle" ? idle : TOOL_VIEWS[panel].dock(context);
}
