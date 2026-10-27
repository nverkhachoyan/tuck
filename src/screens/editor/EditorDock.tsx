import type { ComponentProps, ReactNode } from "react";
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
import { AdjustInspector, AdjustPanel } from "./tools/adjust/AdjustPanel";
import {
	CutOutBar,
	CutOutOptions,
	CutOutPanel,
} from "./tools/cutout/CutOutPanel";
import { BrushOptions, DrawBar, DrawPanel } from "./tools/draw/DrawPanel";
import {
	FindBar,
	FindInspector,
	FindOptions,
	FindPanel,
	FindTray,
} from "./tools/find/FindPanel";
import {
	RedactBar,
	RedactOptions,
	RedactPanel,
} from "./tools/redact/RedactPanel";
import {
	TextBar,
	TextColorPicker,
	TextStylePanel,
} from "./tools/text/TextStylePanel";
import type { EditorTools } from "./useEditorTools";

export type { EditorTools } from "./useEditorTools";

/**
 * What the panels read that isn't in the editor's context (see
 * `editorContext.ts`): the tools, and what text and a selected layer show.
 */
export type ToolViewContext = {
	tools: EditorTools;
	dispatchMode: (action: EditorModeAction) => void;
	layerActions: ComponentProps<typeof LayerActionsPanel> | undefined;
	editingText: boolean;
	restoreTextFocus: () => void;
};

/**
 * What one panel shows, wherever the editor shows it. Each field renders
 * elements from the context and calls no hooks, so React keeps each view as
 * it would a switch's branch.
 * - `dock`: the phone dock's panel.
 * - `bar`: the wide header's options, inside the shared `ContextBar`; without
 *   it, the bar has the title, ✕, and ✓ only.
 * - `keepBarFocus`: whether a press in the bar keeps the text's caret.
 * - `tray`: the phone's tray of options, while it's open.
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
export const TOOL_VIEWS: Record<Exclude<DockPanel, "idle">, ToolViews> = {
	draw: {
		dock: ({ tools: { draw } }) => <DrawPanel controller={draw} />,
		tray: ({ tools: { draw } }) => <BrushOptions controller={draw} />,
		bar: ({ tools: { draw } }) => <DrawBar controller={draw} />,
	},
	redact: {
		dock: ({ tools: { redact } }) => <RedactPanel controller={redact} />,
		tray: ({ tools: { redact } }) => <RedactOptions controller={redact} />,
		bar: ({ tools: { redact } }) => <RedactBar controller={redact} />,
	},
	find: {
		dock: ({ tools: { find } }) => <FindPanel controller={find} />,
		tray: () => <FindOptions />,
		results: ({ tools: { find } }) => <FindTray controller={find} />,
		bar: () => <FindBar />,
		inspector: ({ tools: { find } }, layers) => (
			<FindInspector controller={find}>{layers}</FindInspector>
		),
	},
	cutOut: {
		dock: ({ tools: { cut } }) => <CutOutPanel controller={cut} />,
		tray: ({ tools: { cut } }) => <CutOutOptions controller={cut} />,
		bar: ({ tools: { cut } }) => <CutOutBar controller={cut} />,
	},
	adjust: {
		dock: ({ tools: { adjust } }) => <AdjustPanel controller={adjust} />,
		inspector: ({ tools: { adjust } }, layers) => (
			<AdjustInspector controller={adjust}>{layers}</AdjustInspector>
		),
	},
	text: {
		dock: ({ tools: { text }, dispatchMode }) => {
			const { styledText } = text;
			return (
				styledText && (
					<TextStylePanel
						layer={styledText}
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
		bar: ({ tools: { text }, editingText, restoreTextFocus }) =>
			text.styledText && (
				<TextBar
					layer={text.styledText}
					onChange={text.style}
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
					onChange={text.style}
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

/** Whether `panel` has a section in the wide inspector, which opening it opens. */
export function hasInspectorSection(panel: DockPanel): boolean {
	return panel !== "idle" && TOOL_VIEWS[panel].inspector !== undefined;
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
