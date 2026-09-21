import { useCallback, useMemo, useReducer } from "react";
import { Alert } from "react-native";
import { pickPhotoDocument } from "@/import/pickPhoto";
import { createTextLayer, type TextLayer } from "@/model/document";
import { editorReducer, initialEditorState } from "./editorReducer";

/**
 * Owns the editor's document + selection state and every mutation that acts
 * on them. Keeping this out of the screen components means the document
 * model can be reasoned about (and eventually tested) independent of React
 * Native rendering concerns.
 */
export function useEditorState() {
	const [state, dispatch] = useReducer(editorReducer, initialEditorState);

	/** Resolves to `true` when a photo was opened as the current document. */
	const pickImage = useCallback(async () => {
		const result = await pickPhotoDocument();
		if (result.status === "picked") {
			dispatch({ type: "document-opened", document: result.document });
			return true;
		}
		if (result.status === "permission-denied") {
			Alert.alert(
				"Permission required",
				"Permission to access the media library is required.",
			);
		}
		return false;
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
