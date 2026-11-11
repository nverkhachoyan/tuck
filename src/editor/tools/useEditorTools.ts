import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BackHandler } from "react-native";
import type { ToolStarters } from "../chrome/ToolsPanel";
import type { EditorDocument } from "../document/document";
import { visibleImageLayer } from "../document/framing";
import { type Point, type Size, toLayerSpace } from "../document/geometry";
import type { EditorHost } from "../editorHost";
import type { EditorMode, EditorModeAction } from "../editorMode";
import type { ImageLayer } from "../layers/image/image";
import type { Layer } from "../layers/layer";
import { useStore } from "../store";
import {
	selectSelectedLayer,
	type ToolSessionSteps,
} from "../store/editorSlice";
import {
	definitionOf,
	type NoticeAction,
	type ToolControllers,
	type ToolEnv,
	type ToolList,
} from "./defineTool";
import { dropsWork, type ToolId } from "./toolSpec";

/**
 * All of the editor's tools (`tools`, which must not change while it's
 * mounted), their undo session, and their starters, Done, and Cancel. Every
 * other close (`putDownTool`: Escape, a tap away, Android's back button,
 * picking up another tool) runs the open tool's Done, except for a tool
 * that only `previews` or `picks` what it does, which it drops as Cancel
 * does. Leaving the editor (`leaveTool`) runs Done for one that picks, and
 * a tap away (`tapAway`) does nothing while the tool holds work. Each
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
	const { cancelToolSession, commitToolSession, selectLayer } = useStore(
		(state) => state.actions,
	);
	const selectedLayer = useStore(selectSelectedLayer);
	const tool = mode.type === "tool" ? mode.tool : null;
	// Counts the open tool being started again, as the rail does, which
	// ends its session and begins another.
	const [reopened, setReopened] = useState(0);

	const openSpec = tool === null ? null : definitionOf(tools[tool]).spec;
	useToolSession(
		tool,
		reopened,
		openSpec?.previews === true,
		openSpec?.undoSteps ?? "one",
	);

	const closeTool = () => dispatchMode({ type: "endTool" });
	const openImageId = mode.type === "tool" ? mode.layerId : null;
	// The layer whose actions opened the tool, while it's still there.
	const openOnId = mode.type === "tool" ? mode.on : null;
	const openOn =
		openOnId === null
			? null
			: (document.layers.find((layer) => layer.id === openOnId) ?? null);
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
			on: open ? openOn : null,
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
	// the selection if the tool asks, unless a layer's actions opened it: that
	// layer stays selected, with its actions. Its session ends at once rather than
	// when the tool unmounts, so the app sees its changes right away, as Back
	// needs when it saves before leaving.
	const finishTool = () => {
		if (!tool) return;
		const { definition, controller } = controllers[tool];
		definition.done?.(controller);
		commitToolSession();
		closeTool();
		if (definition.deselectOnDone && openOnId === null) selectLayer(null);
	};
	// What a tool picks was never in the document, so dropping the picks
	// keeps the session's other changes, such as a layer hidden meanwhile.
	const cancelTool = () => {
		if (!tool) return;
		if (definitionOf(tools[tool]).spec.picks) commitToolSession();
		else cancelToolSession();
		closeTool();
	};
	// What a preview shows or a tool picks isn't an edit until the tool's
	// own Done, so any other close drops it (Cut's selection, Find's regions).
	const putDownTool = () => {
		if (!tool) return;
		if (dropsWork(definitionOf(tools[tool]).spec)) cancelTool();
		else finishTool();
	};
	// Leaving the editor applies what a tool picked rather than dropping it
	// out of sight, so no face chosen in Find is left unredacted.
	const leaveTool = () => {
		if (tool && definitionOf(tools[tool]).spec.picks) finishTool();
		else putDownTool();
	};
	// A tap away puts the tool down, unless that would drop what it holds: a
	// preview that has changed the document, or what it picked.
	const previewChanged = useStore(
		(state) =>
			state.toolSession?.previews === true &&
			state.document !== state.toolSession.document,
	);
	const current = tool === null ? null : controllers[tool];
	const holding =
		current !== null &&
		(previewChanged || current.definition.holds?.(current.controller) === true);
	const tapAway = holding ? undefined : putDownTool;
	// A tool that needs a photo works in or on `image`: the selected one, or
	// else the main one. Its `started` runs from the effect below, once its
	// session has begun, or at once when it's already open on that photo.
	// Starting a tool that's open, as the rail does, opens it again. An
	// action runs on the photo and opens nothing. `on` is the layer whose
	// actions opened it, which stays selected.
	const selectedImage =
		selectedLayer?.type === "image" && !selectedLayer.hidden
			? selectedLayer
			: null;
	const pendingStart = useRef<{ tool: ToolId; image: ImageLayer } | null>(null);
	const startTool = (
		next: ToolId,
		image = definitionOf(tools[next]).spec.stickers && selectedImage
			? selectedImage
			: targetImage,
		on: string | null = null,
	) => {
		const { definition, controller } = controllers[next];
		if (definition.spec.target !== "none" && !image) return;
		if (definition.run) {
			if (image) definition.run(controller, image);
			return;
		}
		if (definition.startsUnselected && on === null) selectLayer(null);
		definition.prepare?.(controller);
		if (definition.started && image) {
			const openOnImage =
				mode.type === "tool" &&
				mode.tool === next &&
				(mode.layerId === null || mode.layerId === image.id);
			if (openOnImage) definition.started(controller, image);
			else pendingStart.current = { tool: next, image };
		}
		const start = { tool: next, layerId: image?.id ?? null, on };
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
		if (tool && tool !== next) putDownTool();
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
		if (tool && tool !== id) putDownTool();
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

	// Android's back button puts the open tool down.
	const onBack = useEffectEvent(putDownTool);
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
	// The same from the selected layer's actions, which opens each tool on
	// that layer (see `ToolEnv`'s `on`).
	const layerStarters: ToolStarters = Object.fromEntries(
		Object.keys(tools).map((next) => [
			next,
			() => startTool(next, undefined, selectedLayer?.id ?? null),
		]),
	);

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
		layerStarters,
		busy,
		editLayer,
		editorOf,
		stylerOf,
		done: finishTool,
		cancel: cancelTool,
		putDownTool,
		leaveTool,
		tapAway,
		stepToolSize,
		resetEdit,
		announcements,
	};
}

/**
 * A tool's changes as one session: one undo step (or one per change or
 * mark, as `steps` says), or none if canceled. Closing the tool any way,
 * leaving the editor included, keeps them, unless it only `previews` them,
 * and each change of `reopened` starts a new session for the same tool.
 * Called ahead of the tool hooks, so the session has begun before a tool's
 * own effects change the document.
 */
export function useToolSession(
	tool: ToolId | null,
	reopened: number,
	previews: boolean,
	steps: ToolSessionSteps,
) {
	const { beginToolSession, commitToolSession, cancelToolSession } = useStore(
		(state) => state.actions,
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `reopened` ends the session and begins another.
	useEffect(() => {
		if (!tool) return;
		beginToolSession(previews, steps);
		return previews ? cancelToolSession : commitToolSession;
	}, [
		tool,
		reopened,
		previews,
		steps,
		beginToolSession,
		commitToolSession,
		cancelToolSession,
	]);
}
