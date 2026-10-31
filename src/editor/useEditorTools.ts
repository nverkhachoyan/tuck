import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BackHandler } from "react-native";
import {
	definitionOf,
	type NoticeAction,
	type ToolControllers,
	type ToolEnv,
	type ToolList,
} from "./defineTool";
import type { EditorDocument } from "./document/document";
import { visibleImageLayer } from "./document/framing";
import { type Point, type Size, toLayerSpace } from "./document/geometry";
import type { EditorHost } from "./editorHost";
import type { EditorMode, EditorModeAction } from "./editorMode";
import type { ImageLayer } from "./layers/image/image";
import type { Layer } from "./layers/layer";
import type { ToolStarters } from "./shell/ToolsPanel";
import { useStore } from "./store";
import { selectSelectedLayer } from "./store/editorSlice";
import type { ToolId } from "./toolSpec";

/**
 * All of the editor's tools (`tools`, which must not change while it's
 * mounted), their undo session, and their starters, Done, and Cancel. Every
 * close but Cancel runs the open tool's Done: Android's back button too. Each
 * tool's controller comes from its definition's `useController`, given what
 * `env` and the mode say of it. `editorOf` finds the tool that edits a layer
 * in place (its definition's `edit`), and `editLayer` starts it. The order below
 * matters: `useToolSession` runs first, so its effect begins the session
 * before the effect at the end runs a tool's `started`. Running it earlier
 * would put what it does, like Cut's remembered cut, in the session's
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
	notify: (message: string, action?: NoticeAction) => void;
}) {
	const { cancelSession, commitSession, selectLayer } = useStore(
		(state) => state.actions,
	);
	const selectedLayer = useStore(selectSelectedLayer);
	const tool = mode.type === "tool" ? mode.tool : null;
	// Counts the open tool being started again, as the rail does, which
	// ends its session and begins another.
	const [reopened, setReopened] = useState(0);

	useToolSession(
		tool,
		reopened,
		tool !== null && definitionOf(tools[tool]).spec.previews === true,
	);

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
			startTool: (next, on) => latestOpenOn.current(next, on),
		});
		controllers[id] = { definition, controller };
	}
	// Done does what the tool's own Done does, then closes it, and lets go of
	// the selection if the tool asks. Its session ends at once rather than
	// when the tool unmounts, so the app sees its changes right away, as Back
	// needs when it saves before leaving.
	const finishTool = () => {
		if (!tool) return;
		const { definition, controller } = controllers[tool];
		definition.done?.(controller);
		commitSession();
		closeTool();
		if (definition.deselectOnDone) selectLayer(null);
	};
	const cancelTool = () => {
		cancelSession();
		closeTool();
	};
	// A tool that needs a photo works in or on `image`: the selected one, or
	// else the main one. Its `started` runs from the effect below, once its
	// session has begun, or at once when it's already open on that photo.
	// Starting a tool that's open, as the rail does, opens it again. An
	// action runs on the photo and opens nothing.
	const selectedImage =
		selectedLayer?.type === "image" && !selectedLayer.hidden
			? selectedLayer
			: null;
	const pendingStart = useRef<{ tool: ToolId; image: ImageLayer } | null>(null);
	const startTool = (
		next: ToolId,
		image = next === "adjust" && selectedImage ? selectedImage : targetImage,
	) => {
		const { definition, controller } = controllers[next];
		if (definition.spec.target !== "none" && !image) return;
		if (definition.run) {
			if (image) definition.run(controller, image);
			return;
		}
		definition.prepare?.(controller);
		if (definition.started && image) {
			const openOnImage =
				mode.type === "tool" &&
				mode.tool === next &&
				(mode.layerId === null || mode.layerId === image.id);
			if (openOnImage) definition.started(controller, image);
			else pendingStart.current = { tool: next, image };
		}
		const start = { tool: next, layerId: image?.id ?? null };
		if (next === tool) setReopened((count) => count + 1);
		dispatchMode({ type: "startTool", start });
	};
	// What a tool's `startTool` runs, from this render whenever it's called,
	// as from a notice shown renders ago.
	const latestOpenOn = useRef<(next: ToolId, image: ImageLayer) => void>(
		() => {},
	);
	latestOpenOn.current = (next, image) => {
		if (!controllers[next]) return;
		if (tool && tool !== next) finishTool();
		startTool(next, image);
	};
	// The tool that edits `layer` in place, if any.
	const editorOf = (layer: Layer): ToolId | undefined =>
		Object.keys(tools).find((id) => definitionOf(tools[id]).edit?.owns(layer));
	// The tool that styles `layer`, if any.
	const stylerOf = (layer: Layer): ToolId | undefined =>
		Object.keys(tools).find(
			(id) =>
				definitionOf(tools[id]).stylesLayer?.(layer) ??
				definitionOf(tools[id]).edit?.owns(layer),
		);
	// `layer`'s editor, set to edit it with what it places at `point` in the
	// document, or at its end, then opened. Any other open tool finishes
	// first.
	const editLayer = (layer: Layer, point?: Point) => {
		const id = editorOf(layer);
		if (id === undefined) return;
		if (tool && tool !== id) finishTool();
		const { definition, controller } = controllers[id];
		const at = point ? toLayerSpace(layer.transform, point) : null;
		definition.edit?.start(controller, layer, at);
		if (id === tool) setReopened((count) => count + 1);
		dispatchMode({
			type: "startTool",
			start: { tool: id, layerId: targetImage?.id ?? null },
		});
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

	// What each tool's key, button, and layer action picks up. A selected
	// drawing or redaction takes the strokes, as its own Draw or Redact does.
	const starters: ToolStarters = {
		...Object.fromEntries(
			Object.keys(tools).map((next) => [next, () => startTool(next)]),
		),
		photo: addPhoto,
	};

	// The tools whose buttons spin, while what they run is working.
	const busy = Object.keys(controllers).filter((id) => {
		const { definition, controller } = controllers[id];
		return definition.busy?.(controller) === true;
	});

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
		startTool: starters,
		busy,
		editLayer,
		editorOf,
		stylerOf,
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
export function useToolSession(
	tool: ToolId | null,
	reopened: number,
	previews: boolean,
) {
	const { beginSession, commitSession } = useStore((state) => state.actions);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `reopened` ends the session and begins another.
	useEffect(() => {
		if (!tool) return;
		beginSession(previews);
		return commitSession;
	}, [tool, reopened, previews, beginSession, commitSession]);
}
