import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useReducer,
} from "react";
import {
	createTextLayer,
	type EditorDocument,
	type TextAlign,
	type TextLayer,
} from "@/model/document";
import { editorReducer, initialEditorState } from "./editorReducer";

type EditorContextValue = ReturnType<typeof useEditorState>;

const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * Hosts the single editor state instance so every route (welcome, editor,
 * export) reads and mutates the same document. Mount it above the router.
 */
export function EditorProvider({ children }: { children: ReactNode }) {
	const editor = useEditorState();
	return (
		<EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
	);
}

/** Reads the shared editor state and commands. */
export function useEditor() {
	const editor = useContext(EditorContext);
	if (!editor) {
		throw new Error("useEditor must be used within an EditorProvider");
	}
	return editor;
}

/**
 * Owns the editor's document + selection state and every mutation that acts
 * on them. The reducer holds the actual state transitions so they can be
 * reasoned about (and eventually tested) independent of React Native.
 */
function useEditorState() {
	const [state, dispatch] = useReducer(editorReducer, initialEditorState);

	const openDocument = useCallback(
		(document: EditorDocument) =>
			dispatch({ type: "document-opened", document }),
		[],
	);

	const closeDocument = useCallback(
		() => dispatch({ type: "document-closed" }),
		[],
	);

	/** Adds a text layer and selects it. */
	const addTextLayer = useCallback(
		(text: string, align: TextAlign) => {
			if (!state.document) return;
			dispatch({
				type: "text-layer-added",
				layer: createTextLayer(state.document, text, align),
			});
		},
		[state.document],
	);

	const updateSelectedText = useCallback(
		(patch: Partial<TextLayer>) =>
			dispatch({ type: "selected-text-updated", patch }),
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

	// Only text layers are selectable for now.
	const selectedTextLayer = useMemo(
		() =>
			state.document?.layers.find(
				(layer): layer is TextLayer =>
					layer.type === "text" && layer.id === state.selectedLayerId,
			),
		[state.document, state.selectedLayerId],
	);

	return {
		document: state.document,
		selectedTextLayer,
		openDocument,
		closeDocument,
		addTextLayer,
		updateSelectedText,
		deleteSelectedLayer,
		selectLayer,
		deselectLayer,
	};
}
