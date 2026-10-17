// Relative `.ts` imports, and only types from zustand and `./index.ts`, keep
// this slice loadable by Node's test runner.
import type { Adjustments } from "../model/adjustments.ts";
import {
	addMaskStroke,
	createDrawingLayer,
	createImageLayer,
	createLayerGroup,
	createPlacedRedactionBox,
	createRedactionBox,
	createRedactionStrokes,
	createShapeLayer,
	createStickerLayer,
	createTextLayer,
	duplicateLayer,
	type EditorDocument,
	effectsEqual,
	groupsForLayers,
	isCutOut,
	isLineShape,
	type Layer,
	type MaskStroke,
	type RedactionBoxPlacement,
	type RedactionEffect,
	type RedactionLayer,
	reorderLayer,
	resizeLayerBox,
	restyleShape,
	type ShapeEdit,
	type ShapeKind,
	type ShapeLayer,
	type ShapePlacement,
	type ShapeStyle,
	type Stroke,
	type TextLayer,
	type TextLayerEdit,
	type TextLayerStyle,
	withAdjustments,
	withMask,
} from "../model/document.ts";
import { addStroke } from "../model/drawing.ts";
import {
	documentFraming,
	type Framing,
	framingsEqual,
	reframeDocument,
} from "../model/framing.ts";
import {
	type Rect,
	type Transform,
	transformsEqual,
} from "../model/geometry.ts";
import { erasesShape } from "../model/shapes.ts";
import type { SliceCreator } from "./index.ts";

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

export type EditorSlice = {
	document: EditorDocument | null;
	// The saved project the document belongs to; null if it couldn't be saved.
	projectId: string | null;
	selectedLayerId: string | null;
	past: EditorSnapshot[];
	future: EditorSnapshot[];
	// While a tool is open, where it started: Cancel returns there (and redo
	// undoes the cancel), and its changes become one undo step when it's done.
	session: EditorSession | null;
	openDocument: (document: EditorDocument, projectId: string | null) => void;
	closeDocument: () => void;
	// A new layer goes in `area`, the part of the document in view, or else
	// in the middle of the whole of it (see `createTextLayer`).
	addTextLayer: (
		text: string,
		style?: Partial<TextLayerStyle>,
		area?: Rect,
	) => void;
	addImageLayer: (
		uri: string,
		width: number,
		height: number,
		opaque: boolean,
		area?: Rect,
	) => void;
	addStickerLayer: (
		uri: string,
		width: number,
		height: number,
		opaque: boolean,
		area?: Rect,
	) => void;
	duplicateSelectedLayer: () => void;
	drawStroke: (stroke: Stroke) => void;
	addRedactionBox: (rect: Rect, effect: RedactionEffect) => void;
	addRedactionBoxes: (
		placements: readonly RedactionBoxPlacement[],
		effect: RedactionEffect,
		groupName?: string,
	) => void;
	setLayerGroupHidden: (id: string, hidden: boolean) => void;
	setLayerGroupLocked: (id: string, locked: boolean) => void;
	deleteLayerGroup: (id: string) => void;
	paintRedaction: (stroke: MaskStroke, effect: RedactionEffect) => void;
	setRedactionEffect: (id: string, effect: RedactionEffect) => void;
	addShape: (
		shape: ShapeKind,
		placement: ShapePlacement,
		style: ShapeStyle,
	) => void;
	setShapeStyle: (id: string, edit: ShapeEdit) => void;
	setAdjustments: (id: string, adjustments: Adjustments) => void;
	setMask: (
		id: string,
		mask: string | null,
		options?: { keepStrokes?: boolean },
	) => void;
	paintMask: (id: string, stroke: MaskStroke) => void;
	updateSelectedText: (patch: TextLayerEdit) => void;
	updateTextLayer: (id: string, patch: TextLayerEdit) => void;
	transformLayer: (id: string, transform: Transform) => void;
	resizeBox: (
		id: string,
		transform: Transform,
		width: number,
		height: number,
	) => void;
	nudgeLayer: (id: string, dx: number, dy: number) => void;
	reframe: (framing: Framing, turnLayers: boolean) => void;
	setBackground: (background: string | null) => void;
	moveLayer: (id: string, toIndex: number) => void;
	setLayerHidden: (id: string, hidden: boolean) => void;
	setLayerLocked: (id: string, locked: boolean) => void;
	setLayerResizable: (id: string, resizable: boolean) => void;
	deleteLayer: (id: string) => void;
	selectLayer: (id: string | null) => void;
	undo: () => void;
	redo: () => void;
	beginSession: () => void;
	commitSession: () => void;
	cancelSession: () => void;
};

export const selectSelectedLayer = ({
	document,
	selectedLayerId,
}: EditorSlice): Layer | undefined =>
	document?.layers.find((layer) => layer.id === selectedLayerId);

export const selectSelectedTextLayer = (
	state: EditorSlice,
): TextLayer | undefined => {
	const layer = selectSelectedLayer(state);
	return layer?.type === "text" ? layer : undefined;
};

export const selectSelectedRedaction = (
	state: EditorSlice,
): RedactionLayer | undefined => {
	const layer = selectSelectedLayer(state);
	return layer?.type === "redaction" ? layer : undefined;
};

export const selectSelectedShape = (
	state: EditorSlice,
): ShapeLayer | undefined => {
	const layer = selectSelectedLayer(state);
	return layer?.type === "shape" ? layer : undefined;
};

// Within a session, not past its start: Cancel is the way back from there.
export const selectCanUndo = ({ past, document, session }: EditorSlice) =>
	past.length > 0 && document !== session?.document;

export const selectCanRedo = ({ future, session }: EditorSlice) =>
	future.length > 0 && future[0] !== session?.redoStop;

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => {
	const setDocument = (
		action: string,
		update: (document: EditorDocument) => EditorDocument,
		nextSelectedLayerId = get().selectedLayerId,
	) => {
		const { document, selectedLayerId, past } = get();
		if (!document) return;
		set(
			{
				document: update(document),
				selectedLayerId: nextSelectedLayerId,
				past: [...past, { document, selectedLayerId }].slice(-MAX_HISTORY),
				future: [],
			},
			false,
			action,
		);
	};

	const setLayers = (
		action: string,
		update: (layers: Layer[]) => Layer[],
		nextSelectedLayerId?: string | null,
	) =>
		setDocument(
			action,
			(document) => {
				const layers = update(document.layers);
				return {
					...document,
					layers,
					groups: groupsForLayers(document.groups, layers),
				};
			},
			nextSelectedLayerId,
		);

	const addOnTop = (action: string, layer: Layer) =>
		setLayers(action, (layers) => [...layers, layer], layer.id);

	const replaceLayer = (
		action: string,
		target: Layer,
		next: Layer,
		nextSelectedLayerId?: string | null,
	) =>
		setLayers(
			action,
			(layers) => layers.map((layer) => (layer === target ? next : layer)),
			nextSelectedLayerId,
		);

	const findLayer = (id: string) =>
		get().document?.layers.find((layer) => layer.id === id);

	const findUnlockedLayer = (id: string) =>
		get().document?.layers.find((layer) => !layer.locked && layer.id === id);

	// The selection, or null if it's one of `ids`.
	const selectionWithout = (ids: ReadonlySet<string>) => {
		const { selectedLayerId } = get();
		return selectedLayerId !== null && ids.has(selectedLayerId)
			? null
			: selectedLayerId;
	};

	// A hidden or locked layer can't be selected, so hiding or locking the
	// selection clears it.
	const setLayerFlag = (
		action: string,
		id: string,
		flag: "hidden" | "locked",
		value: boolean,
	) => {
		const target = findLayer(id);
		if (!target || target[flag] === value) return;
		replaceLayer(
			action,
			target,
			{ ...target, [flag]: value },
			value ? selectionWithout(new Set([id])) : get().selectedLayerId,
		);
	};

	const setLayerGroupFlag = (
		action: string,
		id: string,
		flag: "hidden" | "locked",
		value: boolean,
	) => {
		const group = get().document?.groups?.find(
			(candidate) => candidate.id === id,
		);
		if (!group) return;
		const ids = new Set(group.layerIds);
		const changes = (layer: Layer) =>
			ids.has(layer.id) && layer[flag] !== value;
		if (!(get().document?.layers ?? []).some(changes)) return;
		setLayers(
			action,
			(layers) =>
				layers.map((layer) =>
					changes(layer) ? { ...layer, [flag]: value } : layer,
				),
			value ? selectionWithout(ids) : get().selectedLayerId,
		);
	};

	// The document the last nudge produced. While it's still the current one,
	// nothing else has changed since, so the next nudge joins its undo step.
	let lastNudge: { document: EditorDocument; id: string } | null = null;

	return {
		document: null,
		projectId: null,
		selectedLayerId: null,
		past: [],
		future: [],
		session: null,

		openDocument: (document, projectId) =>
			set(
				{
					document,
					projectId,
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
					projectId: null,
					selectedLayerId: null,
					past: [],
					future: [],
					session: null,
				},
				false,
				"editor/closeDocument",
			),

		addTextLayer: (text, style, area) => {
			const { document } = get();
			if (!document) return;
			addOnTop(
				"editor/addTextLayer",
				createTextLayer(document, text, style, area),
			);
		},

		addImageLayer: (uri, width, height, opaque, area) => {
			const { document } = get();
			if (!document) return;
			addOnTop(
				"editor/addImageLayer",
				createImageLayer(document, uri, width, height, opaque, area),
			);
		},

		addStickerLayer: (uri, width, height, opaque, area) => {
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

		// A stroke in document space joins the selected drawing, or starts a new
		// one on top. That one is selected, so the next stroke joins it too. An
		// eraser also removes each shape it passes over, whole, in the same undo
		// step; a shape is one mark, so it's never left in pieces.
		drawStroke: (stroke) => {
			const { document } = get();
			if (!document || stroke.points.length < 2) return;
			const selected = selectSelectedLayer(get());
			const target =
				selected?.type === "drawing" && !selected.locked ? selected : null;
			const erased = new Set(
				stroke.type === "eraser"
					? document.layers
							.filter(
								(layer) =>
									layer.type === "shape" &&
									!layer.locked &&
									!layer.hidden &&
									erasesShape(layer, stroke.points, stroke.width),
							)
							.map((layer) => layer.id)
					: [],
			);
			if (target || erased.size > 0) {
				setLayers(
					"editor/drawStroke",
					(layers) =>
						layers
							.filter((layer) => !erased.has(layer.id))
							.map((layer) =>
								layer === target ? addStroke(target, stroke) : layer,
							),
					selectionWithout(erased),
				);
			} else if (stroke.type === "pen") {
				addOnTop("editor/drawStroke", createDrawingLayer(stroke));
			}
		},

		// A box in document space, on top and selected, so restyling it right
		// after (see `setRedactionEffect`) changes it.
		addRedactionBox: (rect, effect) => {
			if (rect.width <= 0 || rect.height <= 0) return;
			addOnTop("editor/addRedactionBox", createRedactionBox(rect, effect));
		},

		// Detector proposals land together, on top, as one undo step. Their
		// group is metadata over the flat paint order, so a large result stays
		// one compact row without adding a canvas compositing layer. None of
		// them is selected: the group, not any one box, is what was added.
		addRedactionBoxes: (placements, effect, groupName = "Find results") => {
			const boxes = placements
				.filter(({ width, height }) => width > 0 && height > 0)
				.map((placement) => createPlacedRedactionBox(placement, effect));
			if (boxes.length === 0) return;
			setDocument(
				"editor/addRedactionBoxes",
				(document) => ({
					...document,
					layers: [...document.layers, ...boxes],
					groups: [
						...(document.groups ?? []),
						createLayerGroup(
							groupName,
							boxes.map((box) => box.id),
						),
					],
				}),
				null,
			);
		},

		setLayerGroupHidden: (id, hidden) =>
			setLayerGroupFlag(
				hidden ? "editor/hideLayerGroup" : "editor/showLayerGroup",
				id,
				"hidden",
				hidden,
			),

		setLayerGroupLocked: (id, locked) =>
			setLayerGroupFlag(
				locked ? "editor/lockLayerGroup" : "editor/unlockLayerGroup",
				id,
				"locked",
				locked,
			),

		deleteLayerGroup: (id) => {
			const group = get().document?.groups?.find(
				(candidate) => candidate.id === id,
			);
			if (!group) return;
			const ids = new Set(group.layerIds);
			setDocument(
				"editor/deleteLayerGroup",
				(document) => ({
					...document,
					layers: document.layers.filter((layer) => !ids.has(layer.id)),
					groups: (document.groups ?? []).filter(
						(candidate) => candidate !== group,
					),
				}),
				selectionWithout(ids),
			);
		},

		// Like `drawStroke`: a stroke joins the selected brushed redaction, or a
		// pen starts a new one with `effect` on top.
		paintRedaction: (stroke, effect) => {
			if (stroke.points.length < 2) return;
			const selected = selectSelectedLayer(get());
			if (
				selected?.type === "redaction" &&
				selected.shape === "strokes" &&
				!selected.locked
			) {
				replaceLayer(
					"editor/paintRedaction",
					selected,
					addStroke(selected, stroke),
				);
			} else if (stroke.type === "pen") {
				addOnTop(
					"editor/paintRedaction",
					createRedactionStrokes({ ...stroke, type: "pen" }, effect),
				);
			}
		},

		setRedactionEffect: (id, effect) => {
			const target = findLayer(id);
			if (target?.type !== "redaction" || effectsEqual(target.effect, effect)) {
				return;
			}
			replaceLayer("editor/setRedactionEffect", target, { ...target, effect });
		},

		// On top and selected, like a redaction's box, so restyling it right
		// after (see `setShapeStyle`) changes it. A box needs both sides.
		addShape: (shape, placement, style) => {
			const { width, height } = placement;
			if (width <= 0 || (height <= 0 && !isLineShape(shape))) return;
			addOnTop("editor/addShape", createShapeLayer(shape, placement, style));
		},

		setShapeStyle: (id, edit) => {
			const target = findLayer(id);
			if (target?.type !== "shape") return;
			const restyled = restyleShape(target, edit);
			if (restyled === target) return;
			replaceLayer("editor/setShapeStyle", target, restyled);
		},

		// By id, like `transformLayer`: a dial's drag belongs to the image it
		// started on.
		setAdjustments: (id, adjustments) => {
			const target = findLayer(id);
			if (target?.type !== "image") return;
			const adjusted = withAdjustments(target, adjustments);
			if (adjusted === target) return;
			replaceLayer("editor/setAdjustments", target, adjusted);
		},

		// By id: the mask was found for the image it started on, which may no
		// longer be selected, or may be gone.
		setMask: (id, mask, options) => {
			const target = findLayer(id);
			if (target?.type !== "image") return;
			const masked = withMask(target, mask, options);
			if (masked === target) return;
			replaceLayer("editor/setMask", target, masked);
		},

		// By id, like `setMask`: the stroke refines the image the tool is
		// cutting out, whatever is selected. Keeping what's already whole
		// changes nothing, so a pen on an uncut image isn't a step.
		paintMask: (id, stroke) => {
			const target = findLayer(id);
			if (target?.type !== "image" || stroke.points.length < 2) return;
			if (stroke.type === "pen" && !isCutOut(target)) return;
			replaceLayer("editor/paintMask", target, addMaskStroke(target, stroke));
		},

		updateSelectedText: (patch) => {
			const selected = selectSelectedTextLayer(get());
			if (selected) get().updateTextLayer(selected.id, patch);
		},

		// By id, like `transformLayer`: text edited in place is committed to
		// the layer it came from, whatever is selected by then.
		updateTextLayer: (id, patch) => {
			const target = findLayer(id);
			if (target?.type !== "text") return;
			const keys = Object.keys(patch) as (keyof TextLayerEdit)[];
			if (keys.every((key) => target[key] === patch[key])) return;
			replaceLayer("editor/updateTextLayer", target, { ...target, ...patch });
		},

		// By id rather than "the selected layer": a gesture can end just as the
		// selection moves on, and its result belongs to the layer it moved.
		transformLayer: (id, transform) => {
			const target = findUnlockedLayer(id);
			if (!target || transformsEqual(target.transform, transform)) return;
			replaceLayer("editor/transformLayer", target, { ...target, transform });
		},

		// Like `transformLayer`, for a box resized by its handles, a redaction's
		// or a shape's: its size changes, and its center moves with the sides
		// that did. A line's length is `width`, and its ends turn it too.
		resizeBox: (id, transform, width, height) => {
			const target = findUnlockedLayer(id);
			if (!target) return;
			const resized = resizeLayerBox(target, transform, width, height);
			if (!resized) return;
			replaceLayer("editor/resizeBox", target, resized);
		},

		setLayerResizable: (id, resizable) => {
			const target = findUnlockedLayer(id);
			if (
				(target?.type !== "image" && target?.type !== "text") ||
				target.resizable === resizable
			) {
				return;
			}
			replaceLayer("editor/setLayerResizable", target, {
				...target,
				resizable,
			});
		},

		// Moves a layer by a document-space offset. A run of nudges to the same
		// layer, like holding an arrow key, is a single undo step.
		nudgeLayer: (id, dx, dy) => {
			const target = findUnlockedLayer(id);
			const { document } = get();
			if (!target || !document || (dx === 0 && dy === 0)) return;
			const { x, y } = target.transform;
			const moved = {
				...target,
				transform: { ...target.transform, x: x + dx, y: y + dy },
			};
			const layers = document.layers.map((layer) =>
				layer === target ? moved : layer,
			);
			if (lastNudge?.document === document && lastNudge.id === id) {
				set(
					{ document: { ...document, layers }, future: [] },
					false,
					"editor/nudgeLayer",
				);
			} else {
				setLayers("editor/nudgeLayer", () => layers);
			}
			const nudged = get().document;
			lastNudge = nudged && { document: nudged, id };
		},

		reframe: (framing, turnLayers) => {
			const { document } = get();
			if (!document || framingsEqual(documentFraming(document), framing)) {
				return;
			}
			setDocument("editor/reframe", (document) =>
				reframeDocument(document, framing, turnLayers),
			);
		},

		setBackground: (background) => {
			if (get().document?.background === background) return;
			setDocument("editor/setBackground", (document) => ({
				...document,
				background,
			}));
		},

		moveLayer: (id, toIndex) => {
			const layers = get().document?.layers;
			if (!layers) return;
			const reordered = reorderLayer(layers, id, toIndex);
			if (reordered === layers) return;
			setLayers("editor/moveLayer", () => reordered);
		},

		setLayerHidden: (id, hidden) =>
			setLayerFlag(
				hidden ? "editor/hideLayer" : "editor/showLayer",
				id,
				"hidden",
				hidden,
			),

		setLayerLocked: (id, locked) =>
			setLayerFlag(
				locked ? "editor/lockLayer" : "editor/unlockLayer",
				id,
				"locked",
				locked,
			),

		deleteLayer: (id) => {
			if (!findLayer(id)) return;
			setLayers(
				"editor/deleteLayer",
				(layers) => layers.filter((layer) => layer.id !== id),
				selectionWithout(new Set([id])),
			);
		},

		selectLayer: (id) =>
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
};

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
