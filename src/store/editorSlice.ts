// Relative `.ts` imports, and only types from zustand and `./index.ts`, keep
// this slice loadable by Node's test runner.
import type { Adjustments } from "../model/adjustments.ts";
import {
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
	groupsForLayers,
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

export type EditorSlice = {
	document: EditorDocument | null;
	// The saved project the document belongs to; null if it couldn't be saved.
	projectId: string | null;
	selectedLayerId: string | null;
	past: EditorSnapshot[];
	future: EditorSnapshot[];
	// While a tool is open, where it started: Cancel returns there, and its
	// changes become one undo step when it's done.
	session: EditorSnapshot | null;
	openDocument: (document: EditorDocument, projectId: string | null) => void;
	closeDocument: () => void;
	addTextLayer: (text: string, style?: Partial<TextLayerStyle>) => void;
	addImageLayer: (
		uri: string,
		width: number,
		height: number,
		opaque: boolean,
	) => void;
	addStickerLayer: (
		uri: string,
		width: number,
		height: number,
		opaque: boolean,
	) => void;
	duplicateSelectedLayer: () => void;
	drawStroke: (stroke: Stroke) => void;
	addRedactionBox: (rect: Rect, effect: RedactionEffect) => void;
	addRedactionBoxes: (
		placements: readonly RedactionBoxPlacement[],
		effect: RedactionEffect,
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

export const selectCanRedo = ({ future }: EditorSlice) => future.length > 0;

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

	const findLayer = (id: string) =>
		get().document?.layers.find((layer) => layer.id === id);

	const findUnlockedLayer = (id: string) =>
		get().document?.layers.find((layer) => !layer.locked && layer.id === id);

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

		addTextLayer: (text, style) => {
			const { document } = get();
			if (!document) return;
			addOnTop("editor/addTextLayer", createTextLayer(document, text, style));
		},

		addImageLayer: (uri, width, height, opaque) => {
			const { document } = get();
			if (!document) return;
			addOnTop(
				"editor/addImageLayer",
				createImageLayer(document, uri, width, height, opaque),
			);
		},

		addStickerLayer: (uri, width, height, opaque) => {
			const { document } = get();
			if (!document) return;
			addOnTop(
				"editor/addStickerLayer",
				createStickerLayer(document, uri, width, height, opaque),
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
			const { document, selectedLayerId } = get();
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
					selectedLayerId !== null && erased.has(selectedLayerId)
						? null
						: selectedLayerId,
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
		// one compact row without adding a canvas compositing layer.
		addRedactionBoxes: (placements, effect) => {
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
							"Find results",
							boxes.map((box) => box.id),
						),
					],
				}),
				boxes[boxes.length - 1].id,
			);
		},

		setLayerGroupHidden: (id, hidden) => {
			const group = get().document?.groups?.find(
				(candidate) => candidate.id === id,
			);
			if (!group) return;
			const ids = new Set(group.layerIds);
			if (
				!(get().document?.layers ?? []).some(
					(layer) => ids.has(layer.id) && layer.hidden !== hidden,
				)
			) {
				return;
			}
			const selectedLayerId = get().selectedLayerId;
			setLayers(
				hidden ? "editor/hideLayerGroup" : "editor/showLayerGroup",
				(layers) =>
					layers.map((layer) =>
						ids.has(layer.id) && layer.hidden !== hidden
							? { ...layer, hidden }
							: layer,
					),
				selectedLayerId !== null && ids.has(selectedLayerId) && hidden
					? null
					: selectedLayerId,
			);
		},

		setLayerGroupLocked: (id, locked) => {
			const group = get().document?.groups?.find(
				(candidate) => candidate.id === id,
			);
			if (!group) return;
			const ids = new Set(group.layerIds);
			if (
				!(get().document?.layers ?? []).some(
					(layer) => ids.has(layer.id) && layer.locked !== locked,
				)
			) {
				return;
			}
			const selectedLayerId = get().selectedLayerId;
			setLayers(
				locked ? "editor/lockLayerGroup" : "editor/unlockLayerGroup",
				(layers) =>
					layers.map((layer) =>
						ids.has(layer.id) && layer.locked !== locked
							? { ...layer, locked }
							: layer,
					),
				selectedLayerId !== null && ids.has(selectedLayerId) && locked
					? null
					: selectedLayerId,
			);
		},

		deleteLayerGroup: (id) => {
			const group = get().document?.groups?.find(
				(candidate) => candidate.id === id,
			);
			if (!group) return;
			const ids = new Set(group.layerIds);
			const { selectedLayerId } = get();
			setDocument(
				"editor/deleteLayerGroup",
				(document) => ({
					...document,
					layers: document.layers.filter((layer) => !ids.has(layer.id)),
					groups: (document.groups ?? []).filter(
						(candidate) => candidate !== group,
					),
				}),
				selectedLayerId && ids.has(selectedLayerId) ? null : selectedLayerId,
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
				setLayers("editor/paintRedaction", (layers) =>
					layers.map((layer) =>
						layer === selected ? addStroke(selected, stroke) : layer,
					),
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
			setLayers("editor/setRedactionEffect", (layers) =>
				layers.map((layer) =>
					layer === target ? { ...target, effect } : layer,
				),
			);
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
			setLayers("editor/setShapeStyle", (layers) =>
				layers.map((layer) => (layer === target ? restyled : layer)),
			);
		},

		// By id, like `transformLayer`: a dial's drag belongs to the image it
		// started on.
		setAdjustments: (id, adjustments) => {
			const target = findLayer(id);
			if (target?.type !== "image") return;
			const adjusted = withAdjustments(target, adjustments);
			if (adjusted === target) return;
			setLayers("editor/setAdjustments", (layers) =>
				layers.map((layer) => (layer === target ? adjusted : layer)),
			);
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
			setLayers("editor/updateTextLayer", (layers) =>
				layers.map((layer) =>
					layer === target ? { ...target, ...patch } : layer,
				),
			);
		},

		// By id rather than "the selected layer": a gesture can end just as the
		// selection moves on, and its result belongs to the layer it moved.
		transformLayer: (id, transform) => {
			const layer = findUnlockedLayer(id);
			if (!layer || transformsEqual(layer.transform, transform)) return;
			setLayers("editor/transformLayer", (layers) =>
				layers.map((layer) =>
					layer.id === id ? { ...layer, transform } : layer,
				),
			);
		},

		// Like `transformLayer`, for a box resized by its handles, a redaction's
		// or a shape's: its size changes, and its center moves with the sides
		// that did. A line's length is `width`, and its ends turn it too.
		resizeBox: (id, transform, width, height) => {
			const target = findUnlockedLayer(id);
			const resized =
				target && resizeLayerBox(target, transform, width, height);
			if (!resized) return;
			setLayers("editor/resizeBox", (layers) =>
				layers.map((layer) => (layer === target ? resized : layer)),
			);
		},

		setLayerResizable: (id, resizable) => {
			const target = findUnlockedLayer(id);
			if (
				(target?.type !== "image" && target?.type !== "text") ||
				target.resizable === resizable
			) {
				return;
			}
			setLayers("editor/setLayerResizable", (layers) =>
				layers.map((layer) =>
					layer === target ? { ...target, resizable } : layer,
				),
			);
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

		// A hidden layer can't be selected, so hiding the selection clears it.
		setLayerHidden: (id, hidden) => {
			const target = findLayer(id);
			if (!target || target.hidden === hidden) return;
			const { selectedLayerId } = get();
			setLayers(
				hidden ? "editor/hideLayer" : "editor/showLayer",
				(layers) =>
					layers.map((layer) =>
						layer === target ? { ...target, hidden } : layer,
					),
				hidden && selectedLayerId === id ? null : selectedLayerId,
			);
		},

		// A locked layer can't be selected, so locking the selection clears it.
		setLayerLocked: (id, locked) => {
			const target = findLayer(id);
			if (!target || target.locked === locked) return;
			const { selectedLayerId } = get();
			setLayers(
				locked ? "editor/lockLayer" : "editor/unlockLayer",
				(layers) =>
					layers.map((layer) =>
						layer === target ? { ...target, locked } : layer,
					),
				locked && selectedLayerId === id ? null : selectedLayerId,
			);
		},

		deleteLayer: (id) => {
			if (!findLayer(id)) return;
			const { selectedLayerId } = get();
			setLayers(
				"editor/deleteLayer",
				(layers) => layers.filter((layer) => layer.id !== id),
				selectedLayerId === id ? null : selectedLayerId,
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
			if (!document || !next) return;
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
			const { document, selectedLayerId, session } = get();
			if (!document || session) return;
			set(
				{ session: { document, selectedLayerId } },
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
					past: [...pastBefore(past, session), session].slice(-MAX_HISTORY),
					future: [],
					session: null,
				},
				false,
				"editor/commitSession",
			);
		},

		cancelSession: () => {
			const { document, session, past } = get();
			if (!session) return;
			if (document === session.document) {
				set({ session: null }, false, "editor/cancelSession");
				return;
			}
			set(
				{
					...session,
					past: pastBefore(past, session),
					future: [],
					session: null,
				},
				false,
				"editor/cancelSession",
			);
		},
	};
};

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

function effectsEqual(left: RedactionEffect, right: RedactionEffect): boolean {
	switch (left.type) {
		case "solid":
			return right.type === "solid" && left.color === right.color;
		case "blur":
			return right.type === "blur" && left.radius === right.radius;
		case "pixelate":
			return right.type === "pixelate" && left.size === right.size;
	}
}
