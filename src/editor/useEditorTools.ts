import { useCallback, useEffect, useRef } from "react";
import type { EditorDocument } from "@/model/document";
import { type Framing, visibleImageLayer } from "@/model/framing";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import type { DetectionFeature } from "./detection/imageDetection";
import type { EditorHost } from "./editorHost";
import {
	type EditorMode,
	type EditorModeAction,
	type EditorTool,
	type ToolStart,
	toolImageId,
} from "./editorMode";
import type { ToolStarters } from "./shell/ToolsPanel";
import { useStore } from "./store";
import { useTextEditing } from "./text/useTextEditing";
import { toolWithController } from "./toolDefinitions";
import { TOOL_SPECS } from "./toolSpecs";
import { useAdjustTool } from "./tools/adjust/useAdjustTool";
import { useCutOutTool } from "./tools/cutout/useCutOutTool";
import { useDrawTool } from "./tools/draw/useDrawTool";
import { useFindTool } from "./tools/find/useFindTool";
import { useRedactTool } from "./tools/redact/useRedactTool";

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
 * effect begins the session before the effect at the end runs a tool's
 * `started`. Running it earlier would put what it does, like Cut out's
 * remembered cut, in the session's starting document, where Cancel can't
 * take it back.
 */
export function useEditorTools({
	document,
	mode,
	dispatchMode,
	targetImage,
	documentSize,
	pickPhoto,
	addImage,
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
	addImage: EditorHost["addImage"];
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

	const draw = useDrawTool(tool === "draw", documentSize);
	const redact = useRedactTool(documentSize);
	const find = useFindTool({
		document,
		image: targetImage,
		onRedacted,
	});

	const cutImageId = toolImageId(mode, "cutOut");
	const cutLayer = cutImageId
		? visibleImageLayer(document, cutImageId)
		: undefined;
	const cutOut = useCutOutTool({
		layer: cutLayer,
		documentSize,
		addImage,
		onClose: () => dispatchMode({ type: "endTool" }),
	});
	const tools: EditorTools = { draw, redact, find, cutOut, adjust, text };

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
	// A tool that needs a photo works in or on the selected one, or else the
	// main one. Its `started` runs from the effect below, once its session
	// has begun, or at once when it's already open on that photo. Starting a
	// tool that's open, as the rail does, opens it again.
	const pendingStart = useRef<{ tool: EditorTool; image: ImageLayer } | null>(
		null,
	);
	const startTool = (next: EditorTool) => {
		const { target } = TOOL_SPECS[next];
		if (target !== "none" && !targetImage) return;
		const { definition, controller } = toolWithController(next, tools);
		definition.prepare?.(controller);
		if (definition.started && targetImage) {
			const openOnImage =
				mode.type === "tool" &&
				mode.tool === next &&
				(!("layerId" in mode) || mode.layerId === targetImage.id);
			if (openOnImage) definition.started(controller, targetImage);
			else pendingStart.current = { tool: next, image: targetImage };
		}
		// TypeScript can't build a member of `ToolStart` from any tool.
		const start = (
			target === "image" && targetImage
				? { tool: next, layerId: targetImage.id }
				: { tool: next }
		) as ToolStart;
		dispatchMode({ type: "startTool", start });
	};
	const openImageId =
		mode.type === "tool" && "layerId" in mode ? mode.layerId : null;
	// After every render, so it runs once the tool is open on its photo.
	useEffect(() => {
		const pending = pendingStart.current;
		if (!pending || pending.tool !== tool) return;
		if (openImageId !== null && pending.image.id !== openImageId) return;
		pendingStart.current = null;
		const { definition, controller } = toolWithController(pending.tool, tools);
		definition.started?.(controller, pending.image);
	});

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
	const toolStarters = Object.fromEntries(
		(Object.keys(TOOL_SPECS) as EditorTool[]).map((next) => [
			next,
			() => startTool(next),
		]),
	) as Record<EditorTool, () => void>;
	const starters: ToolStarters = {
		...toolStarters,
		text: startNewText,
		sticker: openStickers,
		photo: pickPhoto,
		crop: startCrop,
	};

	// [ and ] step the open tool's brush, if it has one.
	const stepToolSize = (step: 1 | -1) => {
		if (!tool) return;
		const { definition, controller } = toolWithController(tool, tools);
		definition.stepSize?.(controller, step);
	};

	return {
		tools,
		startTool: starters,
		done: finishTool,
		cancel: cancelTool,
		finishTool,
		closeCrop,
		finishCrop,
		stepToolSize,
		adjustedLayer,
		cutLayer,
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
