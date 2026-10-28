import type { StateCreator } from "zustand";
// Registers the "zustand/devtools" mutator that `SliceCreator` names.
import type {} from "zustand/middleware";
import type { Adjustments } from "../../model/adjustments.ts";
import {
	addLayerOnTop,
	type EditorDocument,
	findLayer,
} from "../../model/document.ts";
import { setAdjustments } from "../../model/edits/adjust.ts";
import { reframe, setBackground } from "../../model/edits/crop.ts";
import { invertMask, paintMask, setMask } from "../../model/edits/cutout.ts";
import { addShape, drawStroke, setShapeStyle } from "../../model/edits/draw.ts";
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
} from "../../model/edits/layers.ts";
import {
	addMaskedRedaction,
	addRedactionBox,
	addRedactionBoxes,
	paintRedaction,
	setRedactionEffect,
} from "../../model/edits/redact.ts";
import {
	updateTextLayer as editTextLayer,
	addTextLayer as placeTextLayer,
} from "../../model/edits/text.ts";
import type { Framing } from "../../model/framing.ts";
import type { Rect, Transform } from "../../model/geometry.ts";
import type { Stroke } from "../../model/layers/drawing.ts";
import {
	type CutStroke,
	createImageLayer,
	createStickerLayer,
} from "../../model/layers/image.ts";
import { duplicateLayer, type Layer } from "../../model/layers/layer.ts";
import type {
	RedactionBoxPlacement,
	RedactionEffect,
	RedactionLayer,
} from "../../model/layers/redaction.ts";
import type {
	ShapeEdit,
	ShapeKind,
	ShapeLayer,
	ShapePlacement,
	ShapeStyle,
} from "../../model/layers/shape.ts";
import type {
	TextLayer,
	TextLayerEdit,
	TextLayerStyle,
} from "../../model/layers/text.ts";
import type { MaskStroke } from "../../model/strokes.ts";

// Undo steps kept; the oldest are dropped beyond this.
export const MAX_HISTORY = 100;

export type EditorSnapshot = {
	document: EditorDocument;
	selectedLayerId: string | null;
};

// While a tool is open, where it started, and the redo step that was next
// then. Undo stops at the start, and redo at that step, so a tool never
// steps into changes from before it opened.
export type EditorSession = EditorSnapshot & {
	redoStop: EditorSnapshot | undefined;
};

export type EditorState = {
	document: EditorDocument | null;
	// What the app calls this session (a project, say), or null; the editor
	// uses it only to key what it caches for the document.
	key: string | null;
	selectedLayerId: string | null;
	past: EditorSnapshot[];
	future: EditorSnapshot[];
	// While a tool is open, where it started: Cancel returns there (and redo
	// undoes the cancel), and its changes become one undo step when it's done.
	session: EditorSession | null;
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

// Within a session, not past its start: Cancel is the way back from there.
export const selectCanUndo = ({ past, document, session }: EditorState) =>
	past.length > 0 && document !== session?.document;

export const selectCanRedo = ({ future, session }: EditorState) =>
	future.length > 0 && future[0] !== session?.redoStop;

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

	const addOnTop = (action: string, layer: Layer) =>
		setDocument(action, (document) => addLayerOnTop(document, layer), layer.id);

	// The document the last nudge produced. While it's still the current one,
	// nothing else has changed since, so the next nudge joins its undo step.
	let lastNudge: { document: EditorDocument; id: string } | null = null;

	// By id, like `transformLayer`: text edited in place is committed to
	// the layer it came from, whatever is selected by then.
	const updateTextLayer = (id: string, patch: TextLayerEdit) =>
		setDocument("editor/updateTextLayer", (document) =>
			editTextLayer(document, id, patch),
		);

	return {
		openDocument: (document: EditorDocument, key: string | null) =>
			set(
				{
					document,
					key,
					selectedLayerId: null,
					past: [],
					future: [],
					session: null,
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
					session: null,
				},
				false,
				"editor/closeDocument",
			),

		// A new layer goes in `area`, the part of the document in view, or else
		// in the middle of the whole of it (see `createTextLayer`).
		addTextLayer: (
			text: string,
			style?: Partial<TextLayerStyle>,
			area?: Rect,
		) =>
			setDocument("editor/addTextLayer", (document) =>
				placeTextLayer(document, text, style, area),
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

		// A new drawing is selected, so the next stroke joins it too.
		drawStroke: (stroke: Stroke) =>
			setDocument("editor/drawStroke", (document) =>
				drawStroke(document, get().selectedLayerId, stroke),
			),

		// On top and selected, so restyling it right after (see
		// `setRedactionEffect`) changes it.
		addRedactionBox: (rect: Rect, effect: RedactionEffect) =>
			setDocument("editor/addRedactionBox", (document) =>
				addRedactionBox(document, rect, effect),
			),

		// Detector proposals land as one undo step. None of them is selected:
		// the group, not any one box, is what was added.
		addRedactionBoxes: (
			placements: readonly RedactionBoxPlacement[],
			effect: RedactionEffect,
			groupName?: string,
		) =>
			setDocument(
				"editor/addRedactionBoxes",
				(document) =>
					addRedactionBoxes(document, placements, effect, groupName),
				null,
			),

		// Selected, like a box.
		addMaskedRedaction: (
			imageId: string,
			mask: string,
			rect: Rect,
			effect: RedactionEffect,
		) =>
			setDocument("editor/addMaskedRedaction", (document) =>
				addMaskedRedaction(document, imageId, mask, rect, effect),
			),

		setLayerGroupHidden: (id: string, hidden: boolean) =>
			setDocument(
				hidden ? "editor/hideLayerGroup" : "editor/showLayerGroup",
				(document) => setLayerGroupFlag(document, id, "hidden", hidden),
			),

		setLayerGroupLocked: (id: string, locked: boolean) =>
			setDocument(
				locked ? "editor/lockLayerGroup" : "editor/unlockLayerGroup",
				(document) => setLayerGroupFlag(document, id, "locked", locked),
			),

		deleteLayerGroup: (id: string) =>
			setDocument("editor/deleteLayerGroup", (document) =>
				deleteLayerGroup(document, id),
			),

		// Like `drawStroke`, a new redaction is selected, so the next stroke
		// joins it.
		paintRedaction: (stroke: MaskStroke, effect: RedactionEffect) =>
			setDocument("editor/paintRedaction", (document) =>
				paintRedaction(document, get().selectedLayerId, stroke, effect),
			),

		setRedactionEffect: (id: string, effect: RedactionEffect) =>
			setDocument("editor/setRedactionEffect", (document) =>
				setRedactionEffect(document, id, effect),
			),

		// Selected, like a redaction's box, so restyling it right after (see
		// `setShapeStyle`) changes it.
		addShape: (
			shape: ShapeKind,
			placement: ShapePlacement,
			style: ShapeStyle,
		) =>
			setDocument("editor/addShape", (document) =>
				addShape(document, shape, placement, style),
			),

		setShapeStyle: (id: string, edit: ShapeEdit) =>
			setDocument("editor/setShapeStyle", (document) =>
				setShapeStyle(document, id, edit),
			),

		// By id, like `transformLayer`: a dial's drag belongs to the image it
		// started on.
		setAdjustments: (id: string, adjustments: Adjustments) =>
			setDocument("editor/setAdjustments", (document) =>
				setAdjustments(document, id, adjustments),
			),

		// By id: the mask was found for the image it started on, which may no
		// longer be selected, or may be gone.
		setMask: (
			id: string,
			mask: string | null,
			options?: { keepStrokes?: boolean },
		) =>
			setDocument("editor/setMask", (document) =>
				setMask(document, id, mask, options),
			),

		// By id, like `setMask`.
		invertMask: (id: string, mask: string) =>
			setDocument("editor/invertMask", (document) =>
				invertMask(document, id, mask),
			),

		// By id, like `setMask`: the stroke refines the image the tool is
		// cutting out, whatever is selected.
		paintMask: (id: string, stroke: CutStroke) =>
			setDocument("editor/paintMask", (document) =>
				paintMask(document, id, stroke),
			),

		updateSelectedText: (patch: TextLayerEdit) => {
			const selected = selectSelectedTextLayer(get());
			if (selected) updateTextLayer(selected.id, patch);
		},

		updateTextLayer,

		// By id rather than "the selected layer": a gesture can end just as the
		// selection moves on, and its result belongs to the layer it moved.
		transformLayer: (id: string, transform: Transform) =>
			setDocument("editor/transformLayer", (document) =>
				transformLayer(document, id, transform),
			),

		// By id, like `transformLayer`.
		resizeBox: (
			id: string,
			transform: Transform,
			width: number,
			height: number,
		) =>
			setDocument("editor/resizeBox", (document) =>
				resizeBox(document, id, transform, width, height),
			),

		setLayerResizable: (id: string, resizable: boolean) =>
			setDocument("editor/setLayerResizable", (document) =>
				setLayerResizable(document, id, resizable),
			),

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

		reframe: (framing: Framing, turnLayers: boolean) =>
			setDocument("editor/reframe", (document) =>
				reframe(document, framing, turnLayers),
			),

		setBackground: (background: string | null) =>
			setDocument("editor/setBackground", (document) =>
				setBackground(document, background),
			),

		moveLayer: (id: string, toIndex: number) =>
			setDocument("editor/moveLayer", (document) =>
				moveLayer(document, id, toIndex),
			),

		setLayerHidden: (id: string, hidden: boolean) =>
			setDocument(
				hidden ? "editor/hideLayer" : "editor/showLayer",
				(document) => setLayerFlag(document, id, "hidden", hidden),
			),

		setLayerLocked: (id: string, locked: boolean) =>
			setDocument(
				locked ? "editor/lockLayer" : "editor/unlockLayer",
				(document) => setLayerFlag(document, id, "locked", locked),
			),

		deleteLayer: (id: string) =>
			setDocument("editor/deleteLayer", (document) =>
				deleteLayer(document, id),
			),

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

		beginSession: () => {
			const { document, selectedLayerId, future, session } = get();
			if (!document || session) return;
			set(
				{ session: { document, selectedLayerId, redoStop: future[0] } },
				false,
				"editor/beginSession",
			);
		},

		// The session's steps become one, from where it started.
		commitSession: () => {
			const { document, session, past } = get();
			if (!session) return;
			if (document === session.document) {
				set({ session: null }, false, "editor/commitSession");
				return;
			}
			set(
				{
					past: [...pastBefore(past, session), snapshotOf(session)].slice(
						-MAX_HISTORY,
					),
					future: [],
					session: null,
				},
				false,
				"editor/commitSession",
			);
		},

		// Redo brings the canceled changes back as one step. Any change in the
		// session cleared the redo steps from before it, so `future` holds only
		// the session's own undone steps, which still follow on from there.
		cancelSession: () => {
			const { document, selectedLayerId, session, past, future } = get();
			if (!document || !session) return;
			if (document === session.document) {
				set({ session: null }, false, "editor/cancelSession");
				return;
			}
			set(
				{
					...snapshotOf(session),
					past: pastBefore(past, session),
					future: [{ document, selectedLayerId }, ...future],
					session: null,
				},
				false,
				"editor/cancelSession",
			);
		},
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
	session: null,
	actions: createEditorActions(set, get),
});

function snapshotOf({
	document,
	selectedLayerId,
}: EditorSnapshot): EditorSnapshot {
	return { document, selectedLayerId };
}

/**
 * The undo steps from before `session`. Its first change recorded where it
 * started, and undo can't go past that, so the last step holding the
 * session's starting document is where it began. Without one, the session
 * took so many steps that everything before it was dropped.
 */
function pastBefore(
	past: EditorSnapshot[],
	session: EditorSnapshot,
): EditorSnapshot[] {
	for (let index = past.length - 1; index >= 0; index--) {
		if (past[index].document === session.document) return past.slice(0, index);
	}
	return [];
}
