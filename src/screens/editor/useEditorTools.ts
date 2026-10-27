import { useCallback, useEffect, useRef } from "react";
import type { EditorDocument } from "@/model/document";
import { type Framing, visibleImageLayer } from "@/model/framing";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import { usePreference } from "@/platform/usePreference";
import { useStore } from "@/store";
import type { DetectionFeature } from "./detection/imageDetection";
import {
	type EditorMode,
	type EditorModeAction,
	type EditorTool,
	toolImageId,
} from "./editorMode";
import { type RedactLook, redactionEffect } from "./shell/redactLook";
import type { ToolStarters } from "./shell/ToolsPanel";
import { toolWithController } from "./toolDefinitions";
import { useAdjustTool } from "./tools/adjust/useAdjustTool";
import { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { useDrawTool } from "./tools/draw/useDrawTool";
import { useFindTool } from "./tools/find/useFindTool";
import { parseRedactSettings } from "./tools/redact/redactSettings";
import { useRedactTool } from "./tools/redact/useRedactTool";
import { useTextEditing } from "./tools/text/useTextEditing";

export type EditorTools = {
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cutOut: ReturnType<typeof useCutOutTool>;
	adjust: ReturnType<typeof useAdjustTool>;
	text: ReturnType<typeof useTextEditing>;
};

/**
 * All of the editor's tools, their undo session, and their starters, Done,
 * and Cancel. The order below matters: `useToolSession` runs first, so its
 * effect begins the session before the effect at the end starts Cut out's
 * cut. Starting it earlier would put a remembered cut in the session's
 * starting document, where Cancel can't take it back.
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
	const { cancelSession, setAdjustments, selectLayer, reframe } = useStore(
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

	// Redact's settings, saved between sessions. Their look is what Find and
	// Cut out redact with too.
	const [redactSettings, setRedactSettings] = usePreference(
		"redactSettings",
		parseRedactSettings,
	);
	const { effect, color, strength } = redactSettings;
	const redactLook: RedactLook = { effect, color, strength };
	const changeRedactLook = (change: Partial<RedactLook>) =>
		setRedactSettings((current) => ({ ...current, ...change }));
	const redactEffect = redactionEffect(redactLook, documentSize);

	const draw = useDrawTool(tool === "draw", documentSize);
	const redact = useRedactTool(documentSize, redactSettings, setRedactSettings);
	const find = useFindTool({
		document,
		image: targetImage,
		redactionEffect: redactEffect,
		onRedacted,
	});

	const startRedacting = () => {
		redact.chooseTool();
		dispatchMode({ type: "startTool", start: { tool: "redact" } });
	};
	const cutImageId = toolImageId(mode, "cutOut");
	const cutLayer = cutImageId
		? visibleImageLayer(document, cutImageId)
		: undefined;
	const cutOut = useCutOutTool({
		layer: cutLayer,
		redactionEffect: redactEffect,
		onClose: () => dispatchMode({ type: "endTool" }),
	});
	const tools: EditorTools = { draw, redact, find, cutOut, adjust, text };

	const startDrawing = () => {
		draw.chooseTool();
		dispatchMode({ type: "startTool", start: { tool: "draw" } });
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
	// Done does what the tool's own Done does, then closes it, and lets go of
	// the selection if the tool asks.
	const finishTool = () => {
		if (!tool) return;
		const { definition, controller } = toolWithController(tool, tools);
		definition.done?.(controller);
		closeTool();
		if (definition.deselectOnDone) selectLayer(null);
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
	const startCutOut = () => {
		if (!targetImage) return;
		if (cutImageId === targetImage.id) {
			cutOut.start(targetImage);
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
		if (!image || image.id !== cutImageId) return;
		pendingCut.current = null;
		cutOut.start(image);
	}, [cutImageId, cutOut.start]);
	// In the selected photo, or else the main one.
	const startFinding = () => {
		if (!targetImage) return;
		dispatchMode({ type: "startTool", start: { tool: "find" } });
	};

	const startNewText = () => text.startNew(visibleArea());
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

	// [ and ] step the open tool's brush, if it has one.
	const stepToolSize = (step: 1 | -1) => {
		if (!tool) return;
		const { definition, controller } = toolWithController(tool, tools);
		definition.stepSize?.(controller, step);
	};

	return {
		tools,
		startTool,
		done: finishTool,
		cancel: cancelTool,
		finishTool,
		closeCrop,
		finishCrop,
		stepToolSize,
		adjustedLayer,
		cutLayer,
		redactLook,
		changeRedactLook,
	};
}

/**
 * A tool's changes as one session: one undo step, or none if canceled.
 * Closing the tool any way, leaving the editor included, keeps them. Called
 * ahead of the tool hooks, so the session has begun before a tool's own
 * effects change the document.
 */
export function useToolSession(tool: EditorTool | null) {
	const { beginSession, commitSession } = useStore((state) => state.actions);
	useEffect(() => {
		if (!tool) return;
		beginSession();
		return commitSession;
	}, [tool, beginSession, commitSession]);
}
