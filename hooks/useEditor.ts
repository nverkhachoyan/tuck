import { useCallback, useMemo, useReducer } from "react";
import { Alert } from "react-native";
import {
	createTextLayer,
	type EditorDocument,
	type TextLayer,
} from "../lib/editor-document";
import { pickPhotoDocument } from "../lib/pick-photo";

type EditorState = {
	document: EditorDocument | null;
	selectedLayerId: string | null;
};

type EditorAction =
	| { type: "document-opened"; document: EditorDocument }
	| { type: "document-closed" }
	| { type: "text-layer-added"; layer: TextLayer }
	| { type: "selected-layer-updated"; patch: Partial<TextLayer> }
	| { type: "selected-layer-deleted" }
	| { type: "layer-selected"; id: string | null };

const initialState: EditorState = {
	document: null,
	selectedLayerId: null,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
	switch (action.type) {
		case "document-opened":
			return { document: action.document, selectedLayerId: null };
		case "document-closed":
			return initialState;
		case "text-layer-added":
			if (!state.document) return state;
			return {
				document: {
					...state.document,
					layers: [...state.document.layers, action.layer],
				},
				selectedLayerId: action.layer.id,
			};
		case "selected-layer-updated":
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

/**
 * Owns the editor's document + selection state and every mutation that acts
 * on them. Keeping this out of the screen components means the document
 * model can be reasoned about (and eventually tested) independent of React
 * Native rendering concerns.
 */
export function useEditor() {
	const [state, dispatch] = useReducer(editorReducer, initialState);

	const pickImage = useCallback(async () => {
		const result = await pickPhotoDocument();
		if (result.status === "picked") {
			dispatch({ type: "document-opened", document: result.document });
		} else if (result.status === "permission-denied") {
			Alert.alert(
				"Permission required",
				"Permission to access the media library is required.",
			);
		}
	}, []);

	const closeDocument = useCallback(
		() => dispatch({ type: "document-closed" }),
		[],
	);

	const addTextLayer = useCallback(() => {
		if (!state.document) return;
		dispatch({
			type: "text-layer-added",
			layer: createTextLayer(state.document),
		});
	}, [state.document]);

	const updateSelectedLayer = useCallback(
		(patch: Partial<TextLayer>) =>
			dispatch({ type: "selected-layer-updated", patch }),
		[],
	);

	const deleteSelectedLayer = useCallback(
		() => dispatch({ type: "selected-layer-deleted" }),
		[],
	);

	const selectLayer = useCallback(
		(id: string | null) => dispatch({ type: "layer-selected", id }),
		[],
	);
	const deselectLayer = useCallback(() => selectLayer(null), [selectLayer]);

	const selectedLayer = useMemo(
		() =>
			state.document?.layers.find(
				(layer): layer is TextLayer =>
					layer.type === "text" && layer.id === state.selectedLayerId,
			),
		[state.document, state.selectedLayerId],
	);

	return {
		doc: state.document,
		selectedLayer,
		pickImage,
		closeDocument,
		addTextLayer,
		updateSelectedLayer,
		deleteSelectedLayer,
		selectLayer,
		deselectLayer,
	};
}
