import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { Adjustments } from "@/model/adjustments";
import type { EditorDocument, Layer } from "@/model/document";
import { selectCanRedo, selectCanUndo, useStore } from "@/store";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { TextButton } from "@/ui/TextButton";
import { AdjustPanel } from "./adjust/AdjustPanel";
import type { useAdjustController } from "./adjust/useAdjustController";
import { EyedropperHint } from "./controls/ColorPicker";
import { LayerActionsPanel } from "./controls/LayerActionsPanel";
import { CutOutOptions, CutOutPanel } from "./cutout/CutOutPanel";
import type { CutOutSettings, cutOutTool } from "./cutout/cutOutSettings";
import { BrushOptions, DrawPanel } from "./draw/DrawPanel";
import type { useDrawTool } from "./draw/useDrawTool";
import type {
	EditorModeAction,
	EditorModeState,
	EditorTool,
} from "./editorMode";
import { DetectionOptions, FindPanel } from "./find/FindPanel";
import type { useFindTool } from "./find/useFindTool";
import { EffectGlyph, RedactOptions, RedactPanel } from "./redact/RedactPanel";
import type { useRedactTool } from "./redact/useRedactTool";
import { LAYERS_KEY } from "./shortcuts";
import { TextColorPicker, TextStylePanel } from "./text/TextStylePanel";
import type { TextEditing, useTextEditing } from "./text/useTextEditing";
import { type EditorActions, useEditorActions } from "./useEditorActions";

// What the dock shows: a tool's panel, text's style, the selected layer's
// actions, or, with nothing selected, the tools or the layers.
export type DockPanel = EditorTool | "text" | "layer" | "idle";

/** The store actions the layers panel uses. */
type LayerListActions = Pick<
	EditorActions,
	| "selectLayer"
	| "moveLayer"
	| "setLayerHidden"
	| "setLayerLocked"
	| "deleteLayer"
	| "setLayerGroupHidden"
	| "setLayerGroupLocked"
	| "deleteLayerGroup"
	| "setBackground"
>;

/**
 * The layers panel's props, from the document, the selection, and the store.
 * Picking a layer ends any text being edited first.
 */
export function layerListProps({
	document,
	selectedLayer,
	actions,
	onFinishText,
	onClose,
	bottomInset,
}: {
	document: EditorDocument;
	selectedLayer: Layer | undefined;
	actions: LayerListActions;
	onFinishText: () => void;
	onClose: () => void;
	bottomInset: number;
}) {
	return {
		layers: document.layers,
		groups: document.groups ?? [],
		background: document.background,
		selectedLayerId: selectedLayer?.id ?? null,
		onSelect: (id: string) => {
			onFinishText();
			actions.selectLayer(id);
		},
		onMove: actions.moveLayer,
		onSetHidden: actions.setLayerHidden,
		onSetLocked: actions.setLayerLocked,
		onDelete: actions.deleteLayer,
		onSetGroupHidden: actions.setLayerGroupHidden,
		onSetGroupLocked: actions.setLayerGroupLocked,
		onDeleteGroup: actions.deleteLayerGroup,
		onSetBackground: actions.setBackground,
		onClose,
		bottomInset,
	};
}

/** What picking each tool does, before `wrap` adapts it for its place. */
export type ToolStarters = {
	addBusy: boolean;
	onAddText: () => void;
	onDraw: () => void;
	onRedact: () => void;
	onSticker: () => void;
	onPhoto: () => void;
	onCrop: () => void;
	onAdjust: (() => void) | undefined;
	onCutOut: (() => void) | undefined;
};

/** The tools' buttons' props: each starter through `wrap` (see `fromRail`). */
export function toolButtonsFor(
	starters: ToolStarters,
	wrap: (start: () => void) => () => void = (start) => start,
) {
	return {
		addBusy: starters.addBusy,
		onAddText: wrap(starters.onAddText),
		onDraw: wrap(starters.onDraw),
		onRedact: wrap(starters.onRedact),
		onSticker: wrap(starters.onSticker),
		onPhoto: wrap(starters.onPhoto),
		onCrop: wrap(starters.onCrop),
		onAdjust:
			starters.onAdjust === undefined ? undefined : wrap(starters.onAdjust),
		onCutOut:
			starters.onCutOut === undefined ? undefined : wrap(starters.onCutOut),
	};
}

/** What the dock offers for `layer`, by its kind. */
export function layerActionsFor({
	layer,
	onDraw,
	onRedact,
	onAdjust,
	onFind,
	onCutOut,
	sticker,
	onSaveSticker,
}: {
	layer: Layer;
	onDraw: () => void;
	onRedact: () => void;
	onAdjust: () => void;
	onFind: () => void;
	onCutOut: () => void;
	sticker: "saving" | "saved" | undefined;
	onSaveSticker: (() => void) | undefined;
}) {
	return {
		onDraw:
			layer.type === "drawing" || layer.type === "shape" ? onDraw : undefined,
		onRedact:
			layer.type === "redaction" || layer.type === "image"
				? onRedact
				: undefined,
		onAdjust: layer.type === "image" ? onAdjust : undefined,
		onFind: layer.type === "image" && !layer.hidden ? onFind : undefined,
		onCutOut: layer.type === "image" && !layer.hidden ? onCutOut : undefined,
		sticker,
		onSaveSticker,
	};
}

/**
 * The header's actions: Reset while the image being adjusted has changes,
 * the layers where the inspector doesn't show them, undo and redo, and
 * Export. While `typing`, undo and redo wait: the text isn't a step yet.
 */
export function HeaderActions({
	typing,
	onReset,
	layers,
	onExport,
}: {
	typing: boolean;
	onReset?: () => void;
	layers?: { open: boolean; onToggle: () => void };
	onExport: () => void;
}) {
	const canUndo = useStore(selectCanUndo) && !typing;
	const canRedo = useStore(selectCanRedo) && !typing;
	const { undo, redo } = useEditorActions();
	return (
		<View style={styles.headerActions}>
			{onReset && <TextButton label="Reset" onPress={onReset} />}
			{layers && (
				<IconButton
					icon="layers-outline"
					label="Layers"
					shortcut={LAYERS_KEY}
					selected={layers.open}
					onPress={layers.onToggle}
				/>
			)}
			<IconButton
				icon="arrow-undo-outline"
				label="Undo"
				shortcut="mod+Z"
				disabled={!canUndo}
				onPress={undo}
			/>
			<IconButton
				icon="arrow-redo-outline"
				label="Redo"
				shortcut="mod+shift+Z"
				disabled={!canRedo}
				onPress={redo}
			/>
			<View style={styles.exportAction}>
				<Button
					label="Export"
					icon="share-outline"
					variant="primary"
					size="small"
					shortcut="mod+E"
					onPress={onExport}
				/>
			</View>
		</View>
	);
}

// Cut out's settings, the tool they and the device give, and, for the dock,
// what's being found and a way to find every subject again, inverting the
// cut, and redacting the selection.
type CutProps = {
	settings: CutOutSettings;
	tool: ReturnType<typeof cutOutTool>;
	onChange: (settings: CutOutSettings) => void;
	finding?: "all" | "one" | null;
	onFindAll?: () => void;
	inverting?: boolean;
	onInvert?: () => void;
	redacting?: boolean;
	onRedact?: () => void;
};

type ModeProps = {
	dispatchMode: (action: EditorModeAction<TextEditing>) => void;
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cut: CutProps;
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
					onChange={cut.onChange}
					onClose={closeTray}
				/>
			)}
			{mode.type === "tool" && mode.tool === "find" && !tray && !eyedropper && (
				<DetectionOptions
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
					finding={cut.finding ?? null}
					optionsOpen={optionsOpen}
					onChange={cut.onChange}
					onToggleOptions={toggleOptions}
					onFindAll={cut.onFindAll}
					inverting={cut.inverting ?? false}
					onInvert={cut.onInvert}
					redacting={cut.redacting ?? false}
					onRedact={cut.onRedact}
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

const styles = StyleSheet.create({
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	exportAction: {
		marginLeft: 6,
	},
});
