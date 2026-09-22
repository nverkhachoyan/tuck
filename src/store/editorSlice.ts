// Relative `.ts` imports, and only types from zustand and `./index.ts`, keep
// this slice loadable by Node's test runner.
import {
	createTextLayer,
	duplicateLayer,
	type EditorDocument,
	type Layer,
	reorderLayer,
	type TextAlign,
	type TextLayer,
	type TextLayerEdit,
} from "../model/document.ts";
import { type Transform, transformsEqual } from "../model/geometry.ts";
import type { SliceCreator } from "./index.ts";

export type EditorSnapshot = {
	document: EditorDocument;
	selectedLayerId: string | null;
};

export type EditorSlice = {
	document: EditorDocument | null;
	selectedLayerId: string | null;
	past: EditorSnapshot[];
	future: EditorSnapshot[];
	openDocument: (document: EditorDocument) => void;
	closeDocument: () => void;
	addTextLayer: (text: string, align: TextAlign) => void;
	duplicateSelectedLayer: () => void;
	updateSelectedText: (patch: TextLayerEdit) => void;
	transformLayer: (id: string, transform: Transform) => void;
	nudgeLayer: (id: string, dx: number, dy: number) => void;
	moveLayer: (id: string, toIndex: number) => void;
	setLayerHidden: (id: string, hidden: boolean) => void;
	deleteLayer: (id: string) => void;
	selectLayer: (id: string | null) => void;
	undo: () => void;
	redo: () => void;
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

export const selectCanUndo = ({ past }: EditorSlice) => past.length > 0;

export const selectCanRedo = ({ future }: EditorSlice) => future.length > 0;

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => {
	const setLayers = (
		action: string,
		update: (layers: Layer[]) => Layer[],
		nextSelectedLayerId = get().selectedLayerId,
	) => {
		const { document, selectedLayerId, past } = get();
		if (!document) return;
		set(
			{
				document: { ...document, layers: update(document.layers) },
				selectedLayerId: nextSelectedLayerId,
				past: [...past, { document, selectedLayerId }],
				future: [],
			},
			false,
			action,
		);
	};

	const addOnTop = (action: string, layer: Layer) =>
		setLayers(action, (layers) => [...layers, layer], layer.id);

	// Never the pinned photo at index 0.
	const findUnpinnedLayer = (id: string) =>
		get().document?.layers.find((layer, index) => index > 0 && layer.id === id);

	// The document the last nudge produced. While it's still the current one,
	// nothing else has changed since, so the next nudge joins its undo step.
	let lastNudge: { document: EditorDocument; id: string } | null = null;

	return {
		document: null,
		selectedLayerId: null,
		past: [],
		future: [],

		openDocument: (document) =>
			set(
				{ document, selectedLayerId: null, past: [], future: [] },
				false,
				"editor/openDocument",
			),

		closeDocument: () =>
			set(
				{ document: null, selectedLayerId: null, past: [], future: [] },
				false,
				"editor/closeDocument",
			),

		addTextLayer: (text, align) => {
			const { document } = get();
			if (!document) return;
			addOnTop("editor/addTextLayer", createTextLayer(document, text, align));
		},

		duplicateSelectedLayer: () => {
			const layer = selectSelectedLayer(get());
			if (!layer) return;
			addOnTop("editor/duplicateSelectedLayer", duplicateLayer(layer));
		},

		updateSelectedText: (patch) => {
			const selected = selectSelectedTextLayer(get());
			if (!selected) return;
			const keys = Object.keys(patch) as (keyof TextLayerEdit)[];
			if (keys.every((key) => selected[key] === patch[key])) return;
			setLayers("editor/updateSelectedText", (layers) =>
				layers.map((layer) =>
					layer === selected ? { ...selected, ...patch } : layer,
				),
			);
		},

		// By id rather than "the selected layer": a gesture can end just as the
		// selection moves on, and its result belongs to the layer it moved.
		transformLayer: (id, transform) => {
			const layer = get().document?.layers.find((layer) => layer.id === id);
			if (!layer || transformsEqual(layer.transform, transform)) return;
			setLayers("editor/transformLayer", (layers) =>
				layers.map((layer) =>
					layer.id === id ? { ...layer, transform } : layer,
				),
			);
		},

		// Moves a layer by a document-space offset. A run of nudges to the same
		// layer, like holding an arrow key, is a single undo step.
		nudgeLayer: (id, dx, dy) => {
			const target = findUnpinnedLayer(id);
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

		moveLayer: (id, toIndex) => {
			const layers = get().document?.layers;
			if (!layers) return;
			const reordered = reorderLayer(layers, id, toIndex);
			if (reordered === layers) return;
			setLayers("editor/moveLayer", () => reordered);
		},

		// A hidden layer can't be selected, so hiding the selection clears it.
		setLayerHidden: (id, hidden) => {
			const target = findUnpinnedLayer(id);
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

		deleteLayer: (id) => {
			if (!findUnpinnedLayer(id)) return;
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
			if (!document || !previous) return;
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
	};
};
