// Relative `.ts` imports, and only types from zustand and `./index.ts`, keep
// this slice loadable by Node's test runner.
import {
	createTextLayer,
	duplicateTextLayer,
	type EditorDocument,
	type Layer,
	type TextAlign,
	type TextLayer,
	type TextLayerEdit,
} from "../model/document.ts";
import type { Transform } from "../model/geometry.ts";
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
	duplicateSelectedText: () => void;
	updateSelectedText: (patch: TextLayerEdit) => void;
	transformLayer: (id: string, transform: Transform) => void;
	deleteSelectedLayer: () => void;
	selectLayer: (id: string | null) => void;
	undo: () => void;
	redo: () => void;
};

export const selectSelectedTextLayer = ({
	document,
	selectedLayerId,
}: EditorSlice): TextLayer | undefined =>
	document?.layers.find(
		(layer): layer is TextLayer =>
			layer.type === "text" && layer.id === selectedLayerId,
	);

export const selectCanUndo = ({ past }: EditorSlice) => past.length > 0;

export const selectCanRedo = ({ future }: EditorSlice) => future.length > 0;

function transformsEqual(left: Transform, right: Transform): boolean {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.scaleX === right.scaleX &&
		left.scaleY === right.scaleY &&
		left.rotation === right.rotation
	);
}

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

		duplicateSelectedText: () => {
			const layer = selectSelectedTextLayer(get());
			if (!layer) return;
			addOnTop("editor/duplicateSelectedText", duplicateTextLayer(layer));
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

		deleteSelectedLayer: () => {
			const { selectedLayerId } = get();
			if (!selectedLayerId) return;
			setLayers(
				"editor/deleteSelectedLayer",
				(layers) => layers.filter((layer) => layer.id !== selectedLayerId),
				null,
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
