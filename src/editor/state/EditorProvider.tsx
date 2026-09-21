import { createContext, type ReactNode, useContext } from "react";
import { useEditorState } from "./useEditorState";

type EditorContextValue = ReturnType<typeof useEditorState>;

const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * Hosts the single `useEditorState()` instance so every route (editor, export, …)
 * reads and mutates the same document. Mount it above the router's `<Slot />`.
 */
export function EditorProvider({ children }: { children: ReactNode }) {
	const editor = useEditorState();
	return (
		<EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
	);
}

/** Reads the shared editor. Use this in screens instead of `useEditorState`. */
export function useEditor() {
	const editor = useContext(EditorContext);
	if (!editor) {
		throw new Error("useEditor must be used within an EditorProvider");
	}
	return editor;
}
