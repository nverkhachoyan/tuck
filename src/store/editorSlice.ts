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

export type EditorSlice = {
	document: EditorDocument | null;
	selectedLayerId: string | null;
	openDocument: (document: EditorDocument) => void;
	closeDocument: () => void;
	addTextLayer: (text: string, align: TextAlign) => void;
	duplicateSelectedText: () => void;
	updateSelectedText: (patch: TextLayerEdit) => void;
	transformLayer: (id: string, transform: Transform) => void;
	deleteSelectedLayer: () => void;
	selectLayer: (id: string | null) => void;
};

export const selectSelectedTextLayer = ({
	document,
	selectedLayerId,
}: EditorSlice): TextLayer | undefined =>
	document?.layers.find(
		(layer): layer is TextLayer =>
			layer.type === "text" && layer.id === selectedLayerId,
	);

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => {
	const setLayers = (
		action: string,
		update: (layers: Layer[]) => Layer[],
		selectedLayerId = get().selectedLayerId,
	) => {
		const { document } = get();
		if (!document) return;
		set(
			{
				document: { ...document, layers: update(document.layers) },
				selectedLayerId,
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

		openDocument: (document) =>
			set({ document, selectedLayerId: null }, false, "editor/openDocument"),

		closeDocument: () =>
			set(
				{ document: null, selectedLayerId: null },
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
			const { selectedLayerId } = get();
			if (!selectedLayerId) return;
			setLayers("editor/updateSelectedText", (layers) =>
				layers.map((layer) =>
					layer.type === "text" && layer.id === selectedLayerId
						? { ...layer, ...patch }
						: layer,
				),
			);
		},

		// By id rather than "the selected layer": a gesture can end just as the
		// selection moves on, and its result belongs to the layer it moved.
		transformLayer: (id, transform) =>
			setLayers("editor/transformLayer", (layers) =>
				layers.map((layer) =>
					layer.id === id ? { ...layer, transform } : layer,
				),
			),

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
	};
};
