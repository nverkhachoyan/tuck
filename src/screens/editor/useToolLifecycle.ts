import { useCallback, useEffect, useRef } from "react";
import type { EditorDocument } from "@/model/document";
import { type Framing, visibleImageLayer } from "@/model/framing";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import { useStore } from "@/store";
import type { DetectionFeature } from "./detection/imageDetection";
import {
	type EditorMode,
	type EditorModeAction,
	type EditorTool,
	toolImageId,
} from "./editorMode";
import type { ToolStarters } from "./shell/ToolsPanel";
import { useAdjustTool } from "./tools/adjust/useAdjustTool";
import { stepCutSize } from "./tools/cutout/cutOutSettings";
import { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { stepBrushSize } from "./tools/draw/brushSettings";
import { useDrawTool } from "./tools/draw/useDrawTool";
import { useFindTool } from "./tools/find/useFindTool";
import { redactionEffect, stepRedactSize } from "./tools/redact/redactSettings";
import { useRedactTool } from "./tools/redact/useRedactTool";
import { useTextEditing } from "./tools/text/useTextEditing";

export type EditorTools = {
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cut: ReturnType<typeof useCutOutTool>;
	adjust: ReturnType<typeof useAdjustTool>;
	text: ReturnType<typeof useTextEditing>;
};

/**
 * All of the editor's tools, their undo session, and their starters, Done,
 * and Cancel. `useToolSession` runs ahead of the tool hooks and
 * `useToolLifecycle`, so its effect begins the session before `useToolLifecycle`
 * starts Cut out's cut: calling it later would put a remembered cut in the
 * session's starting document, where Cancel can't take it back.
 */
export function useEditorTools({
	document,
	mode,
	dispatchMode,
	targetImage,
	documentSize,
	pickPhoto,
	openStickers,
	visibleArea,
	onRedacted,
}: {
	document: EditorDocument;
	mode: EditorMode;
	dispatchMode: (action: EditorModeAction) => void;
	targetImage: ImageLayer | null;
	documentSize: Size;
	pickPhoto: () => void;
	openStickers: () => void;
	visibleArea: () => Rect | undefined;
	onRedacted: (count: number, feature: DetectionFeature | null) => void;
}) {
	const { cancelSession, addMaskedRedaction, setAdjustments } = useStore(
		(state) => state.actions,
	);
	const tool = mode.type === "tool" ? mode.tool : null;

	useToolSession(tool);

	const text = useTextEditing({
		document,
		edit: mode.type === "text" ? mode.edit : null,
		dispatchMode,
	});

	const adjustImageId = toolImageId(mode, "adjust");
	const adjustedLayer = adjustImageId
		? visibleImageLayer(document, adjustImageId)
		: undefined;
	const adjust = useAdjustTool(adjustedLayer, setAdjustments);

	const draw = useDrawTool(tool === "draw", documentSize);
	const redact = useRedactTool(documentSize);
	const find = useFindTool(document, targetImage);

	const cutImageId = toolImageId(mode, "cutOut");
	const cutLayer = cutImageId
		? visibleImageLayer(document, cutImageId)
		: undefined;
	const cut = useCutOutTool({
		layer: cutLayer,
		onRedact: (layerId, mask, rect) => {
			cancelSession();
			addMaskedRedaction(
				layerId,
				mask,
				rect,
				redactionEffect(redact.chosen, documentSize),
			);
			redact.setChosen((current) => ({ ...current, tool: "box" }));
			dispatchMode({ type: "startTool", start: { tool: "redact" } });
		},
	});

	const lifecycle = useToolLifecycle({
		mode,
		targetImage,
		documentSize,
		draw,
		redact,
		find,
		cut,
		textEditing: text,
		pickPhoto,
		openStickers,
		dispatchMode,
		visibleArea,
		onRedacted,
	});

	const stepToolSize = (step: 1 | -1) => {
		if (tool === "draw") {
			const next = stepBrushSize(draw.settings, step);
			if (next !== draw.settings) draw.change(next);
		} else if (tool === "redact") {
			const next = stepRedactSize(redact.settings, step);
			if (next !== redact.settings) redact.change(next);
		} else if (tool === "cutOut") {
			const next = stepCutSize(cut.settings, cut.tool, step);
			if (next !== cut.settings) cut.change(next);
		}
	};

	const tools: EditorTools = {
		draw,
		redact,
		find,
		cut,
		adjust,
		text,
	};

	return {
		tools,
		startTool: lifecycle.startTool,
		done: lifecycle.done,
		cancel: lifecycle.cancel,
		finishTool: lifecycle.finishTool,
		closeCrop: lifecycle.closeCrop,
		finishCrop: lifecycle.finishCrop,
		stepToolSize,
		adjustedLayer,
		cutLayer,
	};
}

/**
 * A tool's changes as one session: one undo step, or none if canceled.
 * Closing the tool any way, leaving the editor included, keeps them.
 */
export function useToolSession(tool: EditorTool | null) {
	const { beginSession, commitSession } = useStore((state) => state.actions);
	useEffect(() => {
		if (!tool) return;
		beginSession();
		return commitSession;
	}, [tool, beginSession, commitSession]);
}

/**
 * How the editor's tools open and close: their starters, Done, and Cancel.
 * Called by `useEditorTools` after `useToolSession`, whose effect must run
 * before the one here that starts Cut out's cut.
 */
export function useToolLifecycle({
	mode,
	targetImage,
	documentSize,
	draw,
	redact,
	find,
	cut,
	textEditing,
	pickPhoto,
	openStickers,
	dispatchMode,
	visibleArea,
	onRedacted,
}: {
	mode: EditorMode;
	targetImage: ImageLayer | null;
	documentSize: Size;
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cut: ReturnType<typeof useCutOutTool>;
	textEditing: ReturnType<typeof useTextEditing>;
	pickPhoto: () => void;
	openStickers: () => void;
	dispatchMode: (action: EditorModeAction) => void;
	visibleArea: () => Rect | undefined;
	onRedacted: (count: number, feature: DetectionFeature | null) => void;
}) {
	const { cancelSession, selectLayer, reframe } = useStore(
		(state) => state.actions,
	);
	const tool = mode.type === "tool" ? mode.tool : null;

	const startDrawing = () => {
		draw.chooseTool();
		dispatchMode({ type: "startTool", start: { tool: "draw" } });
	};
	const startRedacting = () => {
		redact.chooseTool();
		dispatchMode({ type: "startTool", start: { tool: "redact" } });
	};
	const startAdjusting = () => {
		if (!targetImage) return;
		dispatchMode({
			type: "startTool",
			start: { tool: "adjust", layerId: targetImage.id },
		});
	};
	const closeTool = () => {
		dispatchMode({ type: "endTool" });
		find.reset();
	};
	// Done with Draw or Redact goes back to the tools, not to the last stroke
	// or box, still selected, where a stray drag would move it.
	const finishTool = () => {
		closeTool();
		if (tool === "draw" || tool === "redact") selectLayer(null);
	};
	const cancelTool = () => {
		cancelSession();
		closeTool();
	};
	// The selected photo, or else the main one, like Find. The cut starts
	// from the effect below, once Cut out's session has begun: a remembered
	// mask lands at once, and would otherwise be part of the document the
	// session started with.
	const pendingCut = useRef<ImageLayer | null>(null);
	const cutOutLayerId =
		mode.type === "tool" && mode.tool === "cutOut" ? mode.layerId : null;
	const startCutOut = () => {
		if (!targetImage) return;
		if (cutOutLayerId === targetImage.id) {
			cut.start(targetImage);
			return;
		}
		pendingCut.current = targetImage;
		dispatchMode({
			type: "startTool",
			start: { tool: "cutOut", layerId: targetImage.id },
		});
	};
	useEffect(() => {
		const image = pendingCut.current;
		if (!image || image.id !== cutOutLayerId) return;
		pendingCut.current = null;
		cut.start(image);
	}, [cutOutLayerId, cut.start]);
	// In the selected photo, or else the main one.
	const startFinding = () => {
		if (!targetImage) return;
		dispatchMode({ type: "startTool", start: { tool: "find" } });
	};
	// Find is one of Redact's tools, so Cancel and Done both go back to
	// Redact, with the tool it last used, to draw over anything Find missed.
	// Done first redacts the regions chosen, in the style last picked rather
	// than a selected redaction's, and says how many, with Undo.
	const backToRedacting = () => {
		find.reset();
		startRedacting();
	};
	const finishFinding = () => {
		const result = find.redactChosen(
			redactionEffect(redact.chosen, documentSize),
		);
		backToRedacting();
		selectLayer(null);
		if (result) onRedacted(result.count, result.feature);
	};
	const done = tool === "find" ? finishFinding : finishTool;
	const cancel = tool === "find" ? backToRedacting : cancelTool;

	const startNewText = () => textEditing.startNew(visibleArea());
	const startCrop = () => dispatchMode({ type: "startCrop" });
	const closeCrop = useCallback(
		() => dispatchMode({ type: "endCrop" }),
		[dispatchMode],
	);
	const finishCrop = (framing: Framing, turnLayers: boolean) => {
		reframe(framing, turnLayers);
		closeCrop();
	};

	// What each tool's key, button, and layer action picks up. A selected
	// drawing or redaction takes the strokes, as its own Draw or Redact does.
	const startTool: ToolStarters = {
		text: startNewText,
		draw: startDrawing,
		redact: startRedacting,
		find: startFinding,
		sticker: openStickers,
		photo: pickPhoto,
		crop: startCrop,
		adjust: startAdjusting,
		cutOut: startCutOut,
	};

	return { startTool, done, cancel, finishTool, closeCrop, finishCrop };
}
