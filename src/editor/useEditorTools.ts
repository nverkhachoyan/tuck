import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BackHandler } from "react-native";
import type { EditorDocument } from "@/model/document";
import { visibleImageLayer } from "@/model/framing";
import type { Rect, Size } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import {
	definitionOf,
	type ToolControllers,
	type ToolEnv,
	type ToolList,
} from "./defineTool";
import type { EditorHost } from "./editorHost";
import type { EditorMode, EditorModeAction } from "./editorMode";
import type { ToolStarters } from "./shell/ToolsPanel";
import { useStore } from "./store";
import { useTextEditing } from "./text/useTextEditing";
import type { ToolId } from "./toolSpec";

/**
 * All of the editor's tools (`tools`, which must not change while it's
 * mounted), their undo session, and their starters, Done, and Cancel. Every
 * close but Cancel runs the open tool's Done: Android's back button too. Each
 * tool's controller comes from its definition's `useController`, given what
 * `env` and the mode say of it. The order below
 * matters: `useToolSession` runs first, so its effect begins the session
 * before the effect at the end runs a tool's `started`. Running it earlier
 * would put what it does, like Cut out's remembered cut, in the session's
 * starting document, where Cancel can't take it back.
 */
export function useEditorTools({
	tools,
	document,
	mode,
	dispatchMode,
	targetImage,
	documentSize,
	host,
	addLayerImage,
	addPhoto,
	view,
	visibleArea,
	notify,
}: {
	tools: ToolList;
	document: EditorDocument;
	mode: EditorMode;
	dispatchMode: (action: EditorModeAction) => void;
	targetImage: ImageLayer | null;
	documentSize: Size;
	host: Pick<EditorHost, "addImage" | "pickPhoto" | "importPhoto">;
	addLayerImage: ToolEnv["addLayerImage"];
	addPhoto: () => void;
	view: ToolEnv["view"];
	visibleArea: () => Rect | undefined;
	notify: (message: string) => void;
}) {
	const { cancelSession, selectLayer } = useStore((state) => state.actions);
	const tool = mode.type === "tool" ? mode.tool : null;
	// Counts the open tool being started again, as the rail does, which
	// ends its session and begins another.
	const [reopened, setReopened] = useState(0);

	useToolSession(tool, reopened);

	const text = useTextEditing({
		document,
		edit: mode.type === "text" ? mode.edit : null,
		dispatchMode,
	});

	const closeTool = () => dispatchMode({ type: "endTool" });
	const openImageId = mode.type === "tool" ? mode.layerId : null;
	const controllers: ToolControllers = {};
	for (const [id, listed] of Object.entries(tools)) {
		const definition = definitionOf(listed);
		const open = tool === id;
		const { target } = definition.spec;
		const image =
			target === "photo"
				? targetImage
				: target === "image" && open && openImageId !== null
					? (visibleImageLayer(document, openImageId) ?? null)
					: null;
		// biome-ignore lint/correctness/useHookAtTopLevel: the list is fixed for the editor's life, so each tool's hooks run in the same order every render.
		const controller = definition.useController({
			document,
			documentSize,
			open,
			image,
			close: closeTool,
			notify,
			view,
			addImage: host.addImage,
			addLayerImage,
			pickPhoto: host.pickPhoto,
			importPhoto: host.importPhoto,
		});
		controllers[id] = { definition, controller };
	}
	// Done does what the tool's own Done does, then closes it, and lets go of
	// the selection if the tool asks.
	const finishTool = () => {
		if (!tool) return;
		const { definition, controller } = controllers[tool];
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
	const pendingStart = useRef<{ tool: ToolId; image: ImageLayer } | null>(null);
	const startTool = (next: ToolId) => {
		const { definition, controller } = controllers[next];
		if (definition.spec.target !== "none" && !targetImage) return;
		definition.prepare?.(controller);
		if (definition.started && targetImage) {
			const openOnImage =
				mode.type === "tool" &&
				mode.tool === next &&
				(mode.layerId === null || mode.layerId === targetImage.id);
			if (openOnImage) definition.started(controller, targetImage);
			else pendingStart.current = { tool: next, image: targetImage };
		}
		const start = { tool: next, layerId: targetImage?.id ?? null };
		if (next === tool) setReopened((count) => count + 1);
		dispatchMode({ type: "startTool", start });
	};
	// After every render, so it runs once the tool is open on its photo.
	useEffect(() => {
		const pending = pendingStart.current;
		if (!pending || pending.tool !== tool) return;
		if (openImageId !== null && pending.image.id !== openImageId) return;
		pendingStart.current = null;
		const { definition, controller } = controllers[pending.tool];
		definition.started?.(controller, pending.image);
	});

	// Android's back button puts the open tool down, as Done does.
	const onBack = useEffectEvent(finishTool);
	useEffect(() => {
		if (!tool) return;
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				onBack();
				return true;
			},
		);
		return () => subscription.remove();
	}, [tool]);

	const startNewText = () => text.startNew(visibleArea());

	// What each tool's key, button, and layer action picks up. A selected
	// drawing or redaction takes the strokes, as its own Draw or Redact does.
	const starters: ToolStarters = {
		...Object.fromEntries(
			Object.keys(tools).map((next) => [next, () => startTool(next)]),
		),
		text: startNewText,
		photo: addPhoto,
	};

	// [ and ] step the open tool's brush, if it has one.
	const stepToolSize = (step: 1 | -1) => {
		if (!tool) return;
		const { definition, controller } = controllers[tool];
		definition.stepSize?.(controller, step);
	};

	// The header's Reset takes back the open tool's changes to its image, if
	// it offers that, and each tool may have something to announce.
	const openTool = tool && controllers[tool];
	const resetEdit = openTool
		? openTool.definition.reset?.(openTool.controller)
		: undefined;
	const announcements = Object.entries(controllers).map(
		([id, { definition, controller }]) =>
			[id, definition.announcement?.(controller) ?? null] as const,
	);

	return {
		controllers,
		text,
		startTool: starters,
		done: finishTool,
		cancel: cancelTool,
		finishTool,
		stepToolSize,
		resetEdit,
		announcements,
	};
}

/**
 * A tool's changes as one session: one undo step, or none if canceled.
 * Closing the tool any way, leaving the editor included, keeps them, and
 * each change of `reopened` starts a new session for the same tool. Called
 * ahead of the tool hooks, so the session has begun before a tool's own
 * effects change the document.
 */
export function useToolSession(tool: ToolId | null, reopened: number) {
	const { beginSession, commitSession } = useStore((state) => state.actions);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `reopened` ends the session and begins another.
	useEffect(() => {
		if (!tool) return;
		beginSession();
		return commitSession;
	}, [tool, reopened, beginSession, commitSession]);
}
