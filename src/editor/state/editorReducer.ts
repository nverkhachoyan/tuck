import type {
	EditorDocument,
	TextLayer,
	TextLayerEdit,
} from "@/model/document";
import type { Transform } from "@/model/geometry";

export type EditorState = {
	document: EditorDocument | null;
	selectedLayerId: string | null;
};

export type EditorAction =
	| { type: "document-opened"; document: EditorDocument }
	| { type: "document-closed" }
	| { type: "text-layer-added"; layer: TextLayer }
	| { type: "selected-text-updated"; patch: TextLayerEdit }
	| { type: "layer-transformed"; id: string; transform: Transform }
	| { type: "selected-layer-deleted" }
	| { type: "layer-selected"; id: string | null };

export const initialEditorState: EditorState = {
	document: null,
	selectedLayerId: null,
};

export function editorReducer(
	state: EditorState,
	action: EditorAction,
): EditorState {
	switch (action.type) {
		case "document-opened":
			return { document: action.document, selectedLayerId: null };
		case "document-closed":
			return initialEditorState;
		case "text-layer-added":
			if (!state.document) return state;
			return {
				document: {
					...state.document,
					layers: [...state.document.layers, action.layer],
				},
				selectedLayerId: action.layer.id,
			};
		case "selected-text-updated":
			if (!state.document || !state.selectedLayerId) return state;
			return {
				...state,
				document: {
					...state.document,
					layers: state.document.layers.map((layer) =>
						layer.type === "text" && layer.id === state.selectedLayerId
							? { ...layer, ...action.patch }
							: layer,
					),
				},
			};
		// By id rather than "the selected layer": a gesture can end just as the
		// selection moves on, and its result belongs to the layer it moved.
		case "layer-transformed":
			if (!state.document) return state;
			return {
				...state,
				document: {
					...state.document,
					layers: state.document.layers.map((layer) =>
						layer.id === action.id
							? { ...layer, transform: action.transform }
							: layer,
					),
				},
			};
		case "selected-layer-deleted":
			if (!state.document || !state.selectedLayerId) return state;
			return {
				document: {
					...state.document,
					layers: state.document.layers.filter(
						(layer) => layer.id !== state.selectedLayerId,
					),
				},
				selectedLayerId: null,
			};
		case "layer-selected":
			return { ...state, selectedLayerId: action.id };
	}
}
