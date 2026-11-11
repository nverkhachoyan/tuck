import type { StateCreator } from "zustand";
// Registers the "zustand/devtools" mutator that `SliceCreator` names.
import type {} from "zustand/middleware";
import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
} from "../document/document.ts";
import { reframe, setBackground } from "../document/documentEdits.ts";
import type { Rect } from "../document/geometry.ts";
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
	deleteLayer,
	deleteLayerGroup,
	moveLayer,
	nudgeLayer,
	resizeBox,
	setLayerFlag,
	setLayerGroupFlag,
	setLayerResizable,
	transformLayer,
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
	type EditorSession,
	type EditorSnapshot,
	MAX_HISTORY,
	type SessionSteps,
	stepsByMark,
	type ToolSession,
	type ToolSessionSteps,
} from "./history.ts";

export type EditorState = {
	document: EditorDocument | null;
	// What the app calls this session (a project, say), or null; the editor
	// uses it only to key what it caches for the document.
	key: string | null;
	selectedLayerId: string | null;
	past: EditorSnapshot[];
	future: EditorSnapshot[];
	// While a tool is open, where it started: Cancel returns there (and redo
	// undoes the cancel), and its changes become one undo step when it's done,
	// unless its spec keeps more (`undoSteps`).
	toolSession: ToolSession | null;
};

type EditorSet = (
	partial: Partial<EditorState>,
	replace?: false,
	action?: string,
) => void;

export const selectSelectedLayer = ({
	document,
	selectedLayerId,
}: EditorState): Layer | undefined =>
	document?.layers.find((layer) => layer.id === selectedLayerId);

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
	past.length > 0 && document !== toolSession?.document;

export const selectCanRedo = ({ future, toolSession }: EditorState) =>
	future.length > 0 && future[0] !== toolSession?.redoStop;

// `get` is the document and its history. An action calls another directly,
// since reading it from `get().actions` makes that action's return type `any`.
export function createEditorActions(set: EditorSet, get: () => EditorState) {
	// The selection after `document` became `next`: a layer the edit added on
	// top, so a stroke or restyle right after changes it, or else the selected
	// layer while it's still there. A hidden or locked layer can't be
	// selected, so hiding or locking the selection clears it.
	const selectionAfter = (document: EditorDocument, next: EditorDocument) => {
		const top = next.layers.at(-1);
		if (top && !findLayer(document, top.id)) return top.id;
		const { selectedLayerId } = get();
		const before = findLayer(document, selectedLayerId);
		const after = findLayer(next, selectedLayerId);
		if (
			!after ||
			(after.hidden && !before?.hidden) ||
			(after.locked && !before?.locked)
		) {
			return null;
		}
		return selectedLayerId;
	};

	// An edit that returns the document it was given changed nothing, so
	// there's no step to record.
	const setDocument = (
		action: string,
		update: (document: EditorDocument) => EditorDocument,
		nextSelectedLayerId?: string | null,
	) => {
		const { document, selectedLayerId, past } = get();
		if (!document) return;
		const next = update(document);
		if (next === document) return;
		set(
			{
				document: next,
				selectedLayerId:
					nextSelectedLayerId === undefined
						? selectionAfter(document, next)
						: nextSelectedLayerId,
				past: [...past, { document, selectedLayerId }].slice(-MAX_HISTORY),
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
			nextSelectedLayerId?: string | null,
		) =>
		(...args: Args) =>
			setDocument(
				action,
				(document) => fn(document, ...args),
				nextSelectedLayerId,
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
		setDocument(action, (document) => addLayerOnTop(document, layer), layer.id);

	// The document the last nudge produced. While it's still the current one,
	// nothing else has changed since, so the next nudge joins its undo step.
	let lastNudge: { document: EditorDocument; id: string } | null = null;

	// By id, like `transformLayer`: text edited in place is committed to
	// the layer it came from, whatever is selected by then.
	const updateTextLayer = edit("editor/updateTextLayer", editTextLayer);

	const beginToolSession = (
		previews = false,
		steps: ToolSessionSteps = "one",
	) => {
		const { document, selectedLayerId, past, future, toolSession } = get();
		if (!document || toolSession) return;
		const newSession: ToolSession = {
			document,
			selectedLayerId,
			undoStop: past.at(-1),
			redoStop: future[0],
			previews,
			steps,
		};
		set({ toolSession: newSession }, false, "editor/beginToolSession");
	};

	// The session's steps become one from where it started, or stay one
	// per change or per mark (`steps`). Each kept step undoes to the
	// selection the session started with, not a mark drawn along the way.
	const commitToolSession = () => {
		const { document, selectedLayerId, toolSession, past } = get();
		if (!document || !toolSession) return;
		if (document === toolSession.document) {
			set({ toolSession: null }, false, "editor/commitToolSession");
			return;
		}
		const own = pastIn(past, toolSession);
		const kept =
			toolSession.steps === "one"
				? [snapshotOf(toolSession)]
				: (toolSession.steps === "each"
						? own
						: stepsByMark(own, { document, selectedLayerId })
					).map((step) => ({
						document: step.document,
						selectedLayerId: toolSession.selectedLayerId,
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
		const { document, selectedLayerId, toolSession, past, future } = get();
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
				future: [{ document, selectedLayerId }, ...future],
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
					selectedLayerId: null,
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
					selectedLayerId: null,
					past: [],
					future: [],
					toolSession: null,
				},
				false,
				"editor/closeDocument",
			),

		// Edits that forward straight to a document/layer edit function. Those
		// that add on top select the new layer through `selectionAfter`; detector
		// proposals (`addRedactionBoxes`) select `null` since the group was added.
		addTextLayer: edit("editor/addTextLayer", placeTextLayer),
		eraseStroke: edit("editor/eraseStroke", eraseStroke),
		eraseWholeStrokes: edit("editor/eraseWholeStrokes", eraseWholeStrokes),
		addRedactionBox: edit("editor/addRedactionBox", addRedactionBox),
		addRedactionBoxes: edit(
			"editor/addRedactionBoxes",
			addRedactionBoxes,
			null,
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
				paintRedaction(document, get().selectedLayerId, stroke, effect),
			),

		// One undo step; the first piece keeps the id, and stays selected.
		separateSelectedDrawing: () => {
			const id = get().selectedLayerId;
			if (!id) return;
			setDocument(
				"editor/separateSelectedDrawing",
				(document) => separateDrawing(document, id),
				id,
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
				copyId,
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
			if (lastNudge?.document === document && lastNudge.id === id) {
				set({ document: next, future: [] }, false, "editor/nudgeLayer");
			} else {
				setDocument("editor/nudgeLayer", () => next);
			}
			lastNudge = { document: next, id };
		},

		selectLayer: (id: string | null) =>
			set({ selectedLayerId: id }, false, "editor/selectLayer"),

		undo: () => {
			const { document, selectedLayerId, past, future } = get();
			const previous = past.at(-1);
			if (!document || !previous || !selectCanUndo(get())) return;
			set(
				{
					...previous,
					past: past.slice(0, -1),
					future: [{ document, selectedLayerId }, ...future],
				},
				false,
				"editor/undo",
			);
		},

		redo: () => {
			const { document, selectedLayerId, past, future } = get();
			const [next, ...rest] = future;
			if (!document || !next || !selectCanRedo(get())) return;
			set(
				{
					...next,
					past: [...past, { document, selectedLayerId }],
					future: rest,
				},
				false,
				"editor/redo",
			);
		},

		beginToolSession,
		commitToolSession,
		cancelToolSession,
		beginSession: beginToolSession,
		commitSession: commitToolSession,
		cancelSession: cancelToolSession,
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
	selectedLayerId: null,
	past: [],
	future: [],
	toolSession: null,
	actions: createEditorActions(set, get),
});
