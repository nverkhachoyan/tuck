import type { StateCreator } from "zustand";
// Registers the "zustand/devtools" mutator that `SliceCreator` names.
import type {} from "zustand/middleware";
import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
} from "../document/document.ts";
import { reframe, setBackground } from "../document/documentEdits.ts";
import type { GroupTransformChange, Rect } from "../document/geometry.ts";
import { createLayerId } from "../layers/base.ts";
import type { Stroke } from "../layers/drawing/drawing.ts";
import {
	drawStroke,
	eraseStroke,
	eraseWholeStrokes,
	restyleDrawing,
	separateDrawing,
} from "../layers/drawing/drawingEdits.ts";
import {
	createImageLayer,
	createStickerLayer,
	type ImageLayer,
} from "../layers/image/image.ts";
import {
	addCutCopy,
	invertMask,
	paintMask,
	setAdjustments,
	setMask,
} from "../layers/image/imageEdits.ts";
import { duplicateLayer, type Layer } from "../layers/layer.ts";
import {
	type ArrangeMove,
	arrangeLayers,
	deleteLayer,
	deleteLayerGroup,
	deleteLayers,
	duplicateLayers,
	moveLayer,
	nudgeLayer,
	nudgeLayers,
	resizeBox,
	setLayerFlag,
	setLayerGroupFlag,
	setLayerResizable,
	transformLayer,
	transformLayers,
} from "../layers/layerEdits.ts";
import type {
	RedactionEffect,
	RedactionLayer,
} from "../layers/redaction/redaction.ts";
import {
	addMaskedRedaction,
	addRedactionBox,
	addRedactionBoxes,
	paintRedaction,
	setRedactionEffect,
} from "../layers/redaction/redactionEdits.ts";
import type { ShapeLayer } from "../layers/shape/shape.ts";
import { addShape, setShapeStyle } from "../layers/shape/shapeEdits.ts";
import type { MaskStroke } from "../layers/strokes.ts";
import type { TextLayer, TextLayerEdit } from "../layers/text/text.ts";
import {
	updateTextLayer as editTextLayer,
	addTextLayer as placeTextLayer,
} from "../layers/text/textEdits.ts";
import {
	type EditorSnapshot,
	MAX_HISTORY,
	pastBefore,
	pastIn,
	snapshotOf,
	stepsByMark,
	type ToolSession,
	type ToolSessionSteps,
} from "./history.ts";

export {
	type EditorSnapshot,
	MAX_HISTORY,
	stepsByMark,
	type ToolSession,
	type ToolSessionSteps,
} from "./history.ts";

export type EditorState = {
	document: EditorDocument | null;
	// What the app calls this session (a project, say), or null; the editor
	// uses it only to key what it caches for the document.
	key: string | null;
	// Selected layer ids in bottom-to-top document order, with no duplicates.
	selectedLayerIds: readonly string[];
	past: EditorSnapshot[];
	future: EditorSnapshot[];
	// While a tool is open, where it started: Cancel returns there (and redo
	// undoes the cancel), and its changes become one undo step when it's done,
	// unless its spec keeps more (`undoSteps`).
	toolSession: ToolSession | null;
};

const NO_IDS: readonly string[] = [];
const NO_LAYERS: readonly Layer[] = [];

function sameIds(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((id, index) => id === b[index]);
}

function normalizeSelection(
	document: EditorDocument | null,
	ids: readonly string[],
): readonly string[] {
	if (!document || ids.length === 0) return NO_IDS;
	const wanted = new Set(ids);
	const ordered = document.layers
		.filter((layer) => wanted.has(layer.id))
		.map((layer) => layer.id);
	return ordered.length === 0 ? NO_IDS : ordered;
}

type EditorSet = (
	partial: Partial<EditorState>,
	replace?: false,
	action?: string,
) => void;

export const selectSelectedLayerId = ({
	selectedLayerIds,
}: Pick<EditorState, "selectedLayerIds">): string | null =>
	selectedLayerIds.length === 1 ? selectedLayerIds[0] : null;

export const selectSelectedLayer = (state: EditorState): Layer | undefined => {
	const id = selectSelectedLayerId(state);
	return id === null
		? undefined
		: state.document?.layers.find((layer) => layer.id === id);
};

let cachedLayersDoc: EditorDocument | null = null;
let cachedLayersIds: readonly string[] = NO_IDS;
let cachedLayers: readonly Layer[] = NO_LAYERS;

export const selectSelectedLayers = ({
	document,
	selectedLayerIds,
}: Pick<EditorState, "document" | "selectedLayerIds">): readonly Layer[] => {
	if (!document || selectedLayerIds.length === 0) return NO_LAYERS;
	if (document === cachedLayersDoc && selectedLayerIds === cachedLayersIds) {
		return cachedLayers;
	}
	const selected = new Set(selectedLayerIds);
	cachedLayersDoc = document;
	cachedLayersIds = selectedLayerIds;
	cachedLayers = document.layers.filter((layer) => selected.has(layer.id));
	return cachedLayers;
};

export const selectSelectedTextLayer = (
	state: EditorState,
): TextLayer | undefined => {
	const layer = selectSelectedLayer(state);
	return layer?.type === "text" ? layer : undefined;
};

export const selectSelectedRedaction = (
	state: EditorState,
): RedactionLayer | undefined => {
	const layer = selectSelectedLayer(state);
	return layer?.type === "redaction" ? layer : undefined;
};

export const selectSelectedShape = (
	state: EditorState,
): ShapeLayer | undefined => {
	const layer = selectSelectedLayer(state);
	return layer?.type === "shape" ? layer : undefined;
};

/**
 * The document as the app sees it, to save or draw a thumbnail of: where a
 * session started while its tool only previews its changes.
 */
export const selectAppDocument = ({ document, toolSession }: EditorState) =>
	toolSession?.previews ? toolSession.document : document;

// Within a session, not past its start: Cancel is the way back from there.
export const selectCanUndo = ({ past, document, toolSession }: EditorState) =>
	past.length > 0 && document !== toolSession?.opened;

export const selectCanRedo = ({ future, toolSession }: EditorState) =>
	future.length > 0 && future[0] !== toolSession?.redoStop;

// `get` is the document and its history. An action calls another directly,
// since reading it from `get().actions` makes that action's return type `any`.
export function createEditorActions(set: EditorSet, get: () => EditorState) {
	// The selection after `document` became `next`: a layer the edit added on
	// top, so a stroke or restyle right after changes it, or else each selected
	// layer that's still there and wasn't just hidden or locked, in document
	// order.
	const selectionAfter = (
		document: EditorDocument,
		next: EditorDocument,
	): readonly string[] => {
		const top = next.layers.at(-1);
		if (top && !findLayer(document, top.id)) return [top.id];
		const { selectedLayerIds } = get();
		if (selectedLayerIds.length === 0) return NO_IDS;
		const selected = new Set(selectedLayerIds);
		const kept = next.layers
			.filter((after) => {
				if (!selected.has(after.id)) return false;
				const before = findLayer(document, after.id);
				return !(
					(after.hidden && !before?.hidden) ||
					(after.locked && !before?.locked)
				);
			})
			.map((layer) => layer.id);
		if (kept.length === 0) return NO_IDS;
		return sameIds(selectedLayerIds, kept) ? selectedLayerIds : kept;
	};

	// An edit that returns the document it was given changed nothing, so
	// there's no step to record.
	const setDocument = (
		action: string,
		update: (document: EditorDocument) => EditorDocument,
		nextSelectedLayerIds?: readonly string[],
	) => {
		const { document, selectedLayerIds, past } = get();
		if (!document) return;
		const next = update(document);
		if (next === document) return;
		set(
			{
				document: next,
				selectedLayerIds:
					nextSelectedLayerIds === undefined
						? selectionAfter(document, next)
						: nextSelectedLayerIds,
				past: [...past, { document, selectedLayerIds }].slice(-MAX_HISTORY),
				future: [],
			},
			false,
			action,
		);
	};

	const edit =
		<Args extends unknown[]>(
			action: string,
			fn: (document: EditorDocument, ...args: Args) => EditorDocument,
			nextSelectedLayerIds?: readonly string[],
		) =>
		(...args: Args) =>
			setDocument(
				action,
				(document) => fn(document, ...args),
				nextSelectedLayerIds,
			);

	const toggleFlag =
		(
			onAction: string,
			offAction: string,
			fn: (
				document: EditorDocument,
				id: string,
				value: boolean,
			) => EditorDocument,
		) =>
		(id: string, value: boolean) =>
			setDocument(value ? onAction : offAction, (document) =>
				fn(document, id, value),
			);

	const addOnTop = (action: string, layer: Layer) =>
		setDocument(action, (document) => addLayerOnTop(document, layer), [
			layer.id,
		]);

	// The document the last nudge produced. While it's still the current one,
	// nothing else has changed since, so the next nudge joins its undo step.
	let lastNudge: { document: EditorDocument; ids: readonly string[] } | null =
		null;

	// By id, like `transformLayer`: text edited in place is committed to
	// the layer it came from, whatever is selected by then.
	const updateTextLayer = edit("editor/updateTextLayer", editTextLayer);

	// With `absorbs`, the session starts from before the last undo step, as
	// though the tool had made it (see `ToolSession`'s `opened`).
	const beginToolSession = (
		previews = false,
		steps: ToolSessionSteps = "one",
		absorbs = false,
	) => {
		const { document, selectedLayerIds, past, future, toolSession } = get();
		if (!document || toolSession) return;
		const absorbed = absorbs ? past.at(-1) : undefined;
		const newSession: ToolSession = {
			...(absorbed ?? { document, selectedLayerIds }),
			opened: document,
			undoStop: past.at(absorbed ? -2 : -1),
			redoStop: future[0],
			previews,
			steps,
		};
		set({ toolSession: newSession }, false, "editor/beginToolSession");
	};

	// Undo stops at the document as it is now, as though the session had
	// opened on it: for a change a tool makes as it opens (Cut's empty
	// selection), which isn't the user's to undo.
	const startToolSessionHere = () => {
		const { document, toolSession } = get();
		if (!document || !toolSession || toolSession.opened === document) return;
		set(
			{ toolSession: { ...toolSession, opened: document } },
			false,
			"editor/startToolSessionHere",
		);
	};

	// The session's steps become one from where it started, or stay one
	// per change or per mark (`steps`). Mark steps undo to the selection the
	// session started with, not a mark drawn along the way; `"each"` keeps
	// each step's own selection so Select's edits restore what was selected.
	const commitToolSession = () => {
		const { document, selectedLayerIds, toolSession, past } = get();
		if (!document || !toolSession) return;
		if (document === toolSession.document) {
			set({ toolSession: null }, false, "editor/commitToolSession");
			return;
		}
		if (document === toolSession.opened) {
			cancelToolSession();
			return;
		}
		const own = pastIn(past, toolSession);
		const kept =
			toolSession.steps === "one"
				? [snapshotOf(toolSession)]
				: toolSession.steps === "each"
					? own
					: stepsByMark(own, { document, selectedLayerIds }).map((step) => ({
							document: step.document,
							selectedLayerIds: toolSession.selectedLayerIds,
						}));
		set(
			{
				past: [...pastBefore(past, toolSession), ...kept].slice(-MAX_HISTORY),
				future: [],
				toolSession: null,
			},
			false,
			"editor/commitToolSession",
		);
	};

	// Redo brings the canceled changes back as one step. Any change in the
	// session cleared the redo steps from before it, so `future` holds only
	// the session's own undone steps, which still follow on from there. A
	// session that only previews leaves nothing to redo: what it showed
	// wasn't an edit (Cut's selection), so the redo steps go back to the
	// ones from before it.
	const cancelToolSession = () => {
		const { document, selectedLayerIds, toolSession, past, future } = get();
		if (!document || !toolSession) return;
		if (toolSession.previews) {
			const stop = toolSession.redoStop
				? future.indexOf(toolSession.redoStop)
				: -1;
			set(
				{
					...snapshotOf(toolSession),
					past: pastBefore(past, toolSession),
					future: stop === -1 ? [] : future.slice(stop),
					toolSession: null,
				},
				false,
				"editor/cancelToolSession",
			);
			return;
		}
		if (document === toolSession.document) {
			set({ toolSession: null }, false, "editor/cancelToolSession");
			return;
		}
		set(
			{
				...snapshotOf(toolSession),
				past: pastBefore(past, toolSession),
				future: [{ document, selectedLayerIds }, ...future],
				toolSession: null,
			},
			false,
			"editor/cancelToolSession",
		);
	};

	return {
		openDocument: (document: EditorDocument, key: string | null) =>
			set(
				{
					document,
					key,
					selectedLayerIds: NO_IDS,
					past: [],
					future: [],
					toolSession: null,
				},
				false,
				"editor/openDocument",
			),

		closeDocument: () =>
			set(
				{
					document: null,
					key: null,
					selectedLayerIds: NO_IDS,
					past: [],
					future: [],
					toolSession: null,
				},
				false,
				"editor/closeDocument",
			),

		// Edits that forward straight to a document/layer edit function. Those
		// that add on top select the new layer through `selectionAfter`; detector
		// proposals (`addRedactionBoxes`) select nothing since the group was added.
		addTextLayer: edit("editor/addTextLayer", placeTextLayer),
		eraseStroke: edit("editor/eraseStroke", eraseStroke),
		eraseWholeStrokes: edit("editor/eraseWholeStrokes", eraseWholeStrokes),
		addRedactionBox: edit("editor/addRedactionBox", addRedactionBox),
		addRedactionBoxes: edit(
			"editor/addRedactionBoxes",
			addRedactionBoxes,
			NO_IDS,
		),
		addMaskedRedaction: edit("editor/addMaskedRedaction", addMaskedRedaction),
		setRedactionEffect: edit("editor/setRedactionEffect", setRedactionEffect),
		addShape: edit("editor/addShape", addShape),
		setShapeStyle: edit("editor/setShapeStyle", setShapeStyle),
		restyleDrawing: edit("editor/restyleDrawing", restyleDrawing),
		setAdjustments: edit("editor/setAdjustments", setAdjustments),
		setMask: edit("editor/setMask", setMask),
		invertMask: edit("editor/invertMask", invertMask),
		paintMask: edit("editor/paintMask", paintMask),
		updateTextLayer,
		transformLayer: edit("editor/transformLayer", transformLayer),
		resizeBox: edit("editor/resizeBox", resizeBox),
		setLayerResizable: edit("editor/setLayerResizable", setLayerResizable),
		reframe: edit("editor/reframe", reframe),
		setBackground: edit("editor/setBackground", setBackground),
		moveLayer: edit("editor/moveLayer", moveLayer),
		deleteLayer: edit("editor/deleteLayer", deleteLayer),
		deleteLayers: edit("editor/deleteLayers", deleteLayers),
		deleteLayerGroup: edit("editor/deleteLayerGroup", deleteLayerGroup),
		setLayerHidden: toggleFlag(
			"editor/hideLayer",
			"editor/showLayer",
			(document, id, hidden) => setLayerFlag(document, id, "hidden", hidden),
		),
		setLayerLocked: toggleFlag(
			"editor/lockLayer",
			"editor/unlockLayer",
			(document, id, locked) => setLayerFlag(document, id, "locked", locked),
		),
		setLayerGroupHidden: toggleFlag(
			"editor/hideLayerGroup",
			"editor/showLayerGroup",
			(document, id, hidden) =>
				setLayerGroupFlag(document, id, "hidden", hidden),
		),
		setLayerGroupLocked: toggleFlag(
			"editor/lockLayerGroup",
			"editor/unlockLayerGroup",
			(document, id, locked) =>
				setLayerGroupFlag(document, id, "locked", locked),
		),

		addImageLayer: (
			uri: string,
			width: number,
			height: number,
			opaque: boolean,
			area?: Rect,
		) => {
			const { document } = get();
			if (!document) return;
			addOnTop(
				"editor/addImageLayer",
				createImageLayer(document, uri, width, height, opaque, area),
			);
		},

		addStickerLayer: (
			uri: string,
			width: number,
			height: number,
			opaque: boolean,
			area?: Rect,
		) => {
			const { document } = get();
			if (!document) return;
			addOnTop(
				"editor/addStickerLayer",
				createStickerLayer(document, uri, width, height, opaque, area),
			);
		},

		duplicateSelectedLayer: () => {
			const layer = selectSelectedLayer(get());
			if (!layer) return;
			addOnTop("editor/duplicateSelectedLayer", duplicateLayer(layer));
		},

		deleteSelectedLayers: () => {
			const { selectedLayerIds } = get();
			if (selectedLayerIds.length === 0) return;
			setDocument(
				"editor/deleteSelectedLayers",
				(document) => deleteLayers(document, selectedLayerIds),
				NO_IDS,
			);
		},

		duplicateSelectedLayers: () => {
			const { document, selectedLayerIds } = get();
			if (!document || selectedLayerIds.length === 0) return;
			const { document: next, copyIds } = duplicateLayers(
				document,
				selectedLayerIds,
			);
			if (next === document) return;
			setDocument("editor/duplicateSelectedLayers", () => next, copyIds);
		},

		arrangeSelectedLayers: (move: ArrangeMove) => {
			const { selectedLayerIds } = get();
			if (selectedLayerIds.length === 0) return;
			setDocument("editor/arrangeSelectedLayers", (document) =>
				arrangeLayers(document, selectedLayerIds, move),
			);
		},

		transformSelectedLayers: (change: GroupTransformChange) => {
			const { selectedLayerIds } = get();
			if (selectedLayerIds.length === 0) return;
			setDocument("editor/transformSelectedLayers", (document) =>
				transformLayers(document, selectedLayerIds, change),
			);
		},

		// Joins the mark `joinId` (see `continuesMark`) or starts one on top.
		// The mark it lands in is selected, so Pen can ask about it next.
		drawStroke: (
			stroke: Stroke & { type: "pen" },
			joinId: string | null = null,
		) =>
			setDocument("editor/drawStroke", (document) =>
				drawStroke(document, joinId, stroke),
			),

		// Like `drawStroke`, a new redaction is selected, so the next stroke
		// joins it.
		paintRedaction: (stroke: MaskStroke, effect: RedactionEffect) =>
			setDocument("editor/paintRedaction", (document) =>
				paintRedaction(document, selectSelectedLayerId(get()), stroke, effect),
			),

		// One undo step; the first piece keeps the id, and stays selected.
		separateSelectedDrawing: () => {
			const id = selectSelectedLayerId(get());
			if (!id) return;
			setDocument(
				"editor/separateSelectedDrawing",
				(document) => separateDrawing(document, id),
				[id],
			);
		},

		// By id, like `setMask`. The copy is selected, though it isn't on top.
		addCutCopy: (
			id: string,
			selection: Pick<ImageLayer, "mask" | "maskStrokes">,
		) => {
			const copyId = createLayerId("image");
			setDocument(
				"editor/addCutCopy",
				(document) => addCutCopy(document, id, selection, copyId),
				[copyId],
			);
		},

		updateSelectedText: (patch: TextLayerEdit) => {
			const selected = selectSelectedTextLayer(get());
			if (selected) updateTextLayer(selected.id, patch);
		},

		// A run of nudges to the same layer, like holding an arrow key, is a
		// single undo step.
		nudgeLayer: (id: string, dx: number, dy: number) => {
			const { document } = get();
			if (!document) return;
			const next = nudgeLayer(document, id, dx, dy);
			if (next === document) return;
			const ids = [id];
			if (lastNudge?.document === document && sameIds(lastNudge.ids, ids)) {
				set({ document: next, future: [] }, false, "editor/nudgeLayer");
			} else {
				setDocument("editor/nudgeLayer", () => next);
			}
			lastNudge = { document: next, ids };
		},

		// A run of nudges to the same selection is a single undo step.
		nudgeSelectedLayers: (dx: number, dy: number) => {
			const { document, selectedLayerIds } = get();
			if (!document || selectedLayerIds.length === 0) return;
			const next = nudgeLayers(document, selectedLayerIds, dx, dy);
			if (next === document) return;
			if (
				lastNudge?.document === document &&
				sameIds(lastNudge.ids, selectedLayerIds)
			) {
				set(
					{ document: next, future: [] },
					false,
					"editor/nudgeSelectedLayers",
				);
			} else {
				setDocument("editor/nudgeSelectedLayers", () => next);
			}
			lastNudge = { document: next, ids: selectedLayerIds };
		},

		selectLayer: (id: string | null) => {
			const { document, selectedLayerIds } = get();
			const next =
				id === null
					? NO_IDS
					: document
						? normalizeSelection(document, [id])
						: [id];
			if (sameIds(selectedLayerIds, next)) return;
			set({ selectedLayerIds: next }, false, "editor/selectLayer");
		},

		selectLayers: (ids: readonly string[]) => {
			const { document, selectedLayerIds } = get();
			const next = normalizeSelection(document, ids);
			if (sameIds(selectedLayerIds, next)) return;
			set({ selectedLayerIds: next }, false, "editor/selectLayers");
		},

		toggleLayerSelected: (id: string) => {
			const { document, selectedLayerIds } = get();
			if (!document) return;
			const next = selectedLayerIds.includes(id)
				? selectedLayerIds.filter((selectedId) => selectedId !== id)
				: normalizeSelection(document, [...selectedLayerIds, id]);
			if (sameIds(selectedLayerIds, next)) return;
			set(
				{ selectedLayerIds: next.length === 0 ? NO_IDS : next },
				false,
				"editor/toggleLayerSelected",
			);
		},

		selectAll: () => {
			const { document, selectedLayerIds } = get();
			if (!document) return;
			const next = document.layers
				.filter((layer) => !layer.hidden && !layer.locked)
				.map((layer) => layer.id);
			if (sameIds(selectedLayerIds, next)) return;
			set(
				{ selectedLayerIds: next.length === 0 ? NO_IDS : next },
				false,
				"editor/selectAll",
			);
		},

		undo: () => {
			const { document, selectedLayerIds, past, future } = get();
			const previous = past.at(-1);
			if (!document || !previous || !selectCanUndo(get())) return;
			set(
				{
					...previous,
					past: past.slice(0, -1),
					future: [{ document, selectedLayerIds }, ...future],
				},
				false,
				"editor/undo",
			);
		},

		redo: () => {
			const { document, selectedLayerIds, past, future } = get();
			const [next, ...rest] = future;
			if (!document || !next || !selectCanRedo(get())) return;
			set(
				{
					...next,
					past: [...past, { document, selectedLayerIds }],
					future: rest,
				},
				false,
				"editor/redo",
			);
		},

		beginToolSession,
		startToolSessionHere,
		commitToolSession,
		cancelToolSession,
	};
}

export type EditorStoreActions = ReturnType<typeof createEditorActions>;

export type EditorSlice = EditorState & {
	actions: EditorStoreActions;
};

type SliceCreator<Slice> = StateCreator<
	EditorSlice,
	[["zustand/devtools", never]],
	[],
	Slice
>;

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => ({
	document: null,
	key: null,
	selectedLayerIds: NO_IDS,
	past: [],
	future: [],
	toolSession: null,
	actions: createEditorActions(set, get),
});
