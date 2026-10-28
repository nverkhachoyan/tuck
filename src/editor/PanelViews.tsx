import type { ComponentProps, ReactNode } from "react";
import type { OpenTool, ToolControllers } from "./defineTool";
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
import {
	TextBar,
	TextColorPicker,
	TextStylePanel,
} from "./text/TextStylePanel";
import type { TextController } from "./text/useTextEditing";

/**
 * What the panels read besides the editor's context (see
 * `editorContext.ts`): the tools' controllers, which their definitions'
 * views are given, and what text and a selected layer show.
 */
export type PanelContext = {
	controllers: ToolControllers;
	text: TextController;
	dispatchMode: (action: EditorModeAction) => void;
	layerActions: ComponentProps<typeof LayerActionsPanel> | undefined;
	editingText: boolean;
	restoreTextFocus: () => void;
};

/**
 * The panels that aren't tools: the style of the text being typed or
 * selected, and the selected layer's actions. Each field renders elements
 * and calls no hooks. `modeChrome` picks `"text"` only with styled text and
 * `"layer"` only with a selected layer, so their checks below never fail.
 * - `keepBarFocus`: whether a press in the bar keeps the text's caret.
 */
const OTHER_PANELS: Record<
	"text" | "layer",
	{
		dock: (context: PanelContext) => ReactNode;
		bar: (context: PanelContext) => ReactNode;
		keepBarFocus?: (context: PanelContext) => boolean;
	}
> = {
	text: {
		dock: ({ text, dispatchMode }) => {
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
		bar: ({ text, editingText, restoreTextFocus }) =>
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

/** `tool`'s view in `slot`, given its controller, or null without one. */
function toolView(
	{ definition, controller }: OpenTool,
	slot: "Dock" | "Bar" | "Tray" | "Results",
) {
	const View = definition.views[slot];
	return View ? <View controller={controller} /> : null;
}

/** The open tool `panel` is, or undefined for the editor's own panels. */
function openToolIn(
	panel: DockPanel,
	controllers: ToolControllers,
): OpenTool | undefined {
	return controllers[panel] as OpenTool | undefined;
}

/**
 * What opens over the canvas, above the dock: the tool's tray, its results,
 * a text color picker, and the eyedropper's hint.
 */
export function ToolTrays({
	context,
	modeState,
	panel,
}: {
	context: PanelContext;
	modeState: EditorModeState;
	panel: DockPanel;
}) {
	const { controllers, text, dispatchMode } = context;
	const { mode, textPicker, eyedropper } = modeState;
	const { styledText } = text;
	const tray = openTray(mode);
	const open = openToolIn(panel, controllers);
	return (
		<>
			{tray && toolView(controllers[tray], "Tray")}
			{!tray && !eyedropper && open && toolView(open, "Results")}
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
export function hasInspectorSection(
	panel: DockPanel,
	controllers: ToolControllers,
): boolean {
	return (
		openToolIn(panel, controllers)?.definition.views.Inspector !== undefined
	);
}

/** The open tool's inspector section over `layers`, or the layers alone. */
export function InspectorContent({
	context,
	panel,
	layers,
}: {
	context: PanelContext;
	panel: DockPanel;
	layers: ReactNode;
}) {
	const open = openToolIn(panel, context.controllers);
	if (!open) return layers;
	const { definition, controller } = open;
	const Section = definition.views.Inspector;
	return Section ? <Section controller={controller}>{layers}</Section> : layers;
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
	context: PanelContext;
	panel: DockPanel;
	// The bar's title, Cancel, and Done, which `modeChrome` chose.
	chrome: { title: string } & ModeActionProps;
}) {
	if (panel === "idle") return null;
	const open = openToolIn(panel, context.controllers);
	if (open) {
		return (
			<ContextBar {...chrome} keepFocus={false}>
				{toolView(open, "Bar")}
			</ContextBar>
		);
	}
	const views = OTHER_PANELS[panel as "text" | "layer"];
	return (
		<ContextBar {...chrome} keepFocus={views.keepBarFocus?.(context) ?? false}>
			{views.bar(context)}
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
	context: PanelContext;
	panel: DockPanel;
	idle: ReactNode;
}) {
	if (panel === "idle") return idle;
	const open = openToolIn(panel, context.controllers);
	if (open) return toolView(open, "Dock");
	return OTHER_PANELS[panel as "text" | "layer"].dock(context);
}
