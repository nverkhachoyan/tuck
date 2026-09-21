import { createContext, type ReactNode, useContext } from "react";
import { useEditor } from "@/features/editor/state/useEditor";

type EditorContextValue = ReturnType<typeof useEditor>;

const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * Hosts the single `useEditor()` instance so every route (editor, export, …)
 * reads and mutates the same document. Mount it above the router's `<Slot />`.
 */
export function EditorProvider({ children }: { children: ReactNode }) {
	const editor = useEditor();
	return (
		<EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
	);
}

export function useEditorContext() {
	const editor = useContext(EditorContext);
	if (!editor) {
		throw new Error("useEditorContext must be used within an EditorProvider");
	}
	return editor;
}
