import { type RefObject, useCallback, useEffect } from "react";
import type { Framing } from "@/model/framing";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import { useStore } from "@/store";
import type { EditorMode, EditorModeAction } from "./editorMode";
import type { ToolStarters } from "./shell/ToolsPanel";
import type { useCutOutTool } from "./tools/cutout/useCutOutTool";
import type { useDrawTool } from "./tools/draw/useDrawTool";
import type { useFindTool } from "./tools/find/useFindTool";
import { redactionEffect } from "./tools/redact/redactSettings";
import type { useRedactTool } from "./tools/redact/useRedactTool";
import type { useTextEditing } from "./tools/text/useTextEditing";

// Filled later in the same render, after the tool hooks and the photo
// picker. The session effect above them reads none of it, and a starter
// runs only from an event, once this is set.
export type ToolWiring = {
	targetImage: ImageLayer | null;
	documentSize: Size;
	draw: ReturnType<typeof useDrawTool>;
	redact: ReturnType<typeof useRedactTool>;
	find: ReturnType<typeof useFindTool>;
	cut: ReturnType<typeof useCutOutTool>;
	pickPhoto: () => void;
	openStickers: () => void;
};

/**
 * How the editor's tools open and close. A tool's changes are one session:
 * one undo step, or none if canceled. Closing the tool any way, leaving the
 * editor included, keeps them. The session effect stays first, ahead of the
 * tool hooks' effects: none of those write the store from an effect, and
 * moving this one later would still change the order effects run in.
 */
export function useToolLifecycle({
	mode,
	textEditing,
	dispatchMode,
	visibleArea,
	wiring,
}: {
	mode: EditorMode;
	textEditing: ReturnType<typeof useTextEditing>;
	dispatchMode: (action: EditorModeAction) => void;
	visibleArea: () => Rect | undefined;
	wiring: RefObject<ToolWiring | null>;
}) {
	const { beginSession, commitSession, cancelSession, selectLayer, reframe } =
		useStore((state) => state.actions);
	const tool = mode.type === "tool" ? mode.tool : null;

	useEffect(() => {
		if (!tool) return;
		beginSession();
		return commitSession;
	}, [tool, beginSession, commitSession]);

	const tools = () => {
		if (!wiring.current) throw new Error("Tool wiring is not ready");
		return wiring.current;
	};

	const startDrawing = () => {
		tools().draw.chooseTool();
		dispatchMode({ type: "startTool", tool: "draw" });
	};
	const startRedacting = () => {
		tools().redact.chooseTool();
		dispatchMode({ type: "startTool", tool: "redact" });
	};
	const startAdjusting = () => {
		const { targetImage } = tools();
		if (!targetImage) return;
		dispatchMode({ type: "startAdjust", layerId: targetImage.id });
	};
	const closeTool = () => {
		dispatchMode({ type: "endTool" });
		tools().find.reset();
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
	// The selected photo, or else the main one, like Find.
	const startCutOut = () => {
		const { targetImage, cut } = tools();
		if (!targetImage) return;
		dispatchMode({ type: "startCutOut", layerId: targetImage.id });
		cut.start(targetImage);
	};
	// In the selected photo, or else the main one.
	const startFinding = () => {
		const { targetImage } = tools();
		if (!targetImage) return;
		dispatchMode({ type: "startTool", tool: "find" });
	};
	// Find is one of Redact's tools, so Cancel goes back to Redact. Done
	// redacts the regions chosen, in the style last picked rather than a
	// selected redaction's, and goes back to the tools, as Redact's Done does.
	const backToRedacting = () => {
		tools().find.reset();
		startRedacting();
	};
	const finishFinding = () => {
		const { find, redact, documentSize } = tools();
		find.redactChosen(redactionEffect(redact.chosen, documentSize));
		closeTool();
		selectLayer(null);
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
		sticker: () => tools().openStickers(),
		photo: () => tools().pickPhoto(),
		crop: startCrop,
		adjust: startAdjusting,
		cutOut: startCutOut,
	};

	return { startTool, done, cancel, finishTool, closeCrop, finishCrop };
}
