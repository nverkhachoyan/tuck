import type { EditorDocument } from "./document/document";
import { useStore } from "./store";
import { type EditorState, selectAppDocument } from "./store/editorSlice";

/**
 * What the app sees of the editor: the document open in it, or
 * null, and the key the app opened it with. While a tool only previews its
 * changes (Cut's selection), the document is the one from before it opened.
 */
export type OpenDocument = Pick<EditorState, "document" | "key">;

const openDocumentOf = (state: EditorState): OpenDocument => ({
	document: selectAppDocument(state),
	key: state.key,
});

export function useOpenDocument<T>(select: (openDoc: OpenDocument) => T): T {
	return useStore((state) => select(openDocumentOf(state)));
}

// For a read outside React, or after an `await`.
export function getOpenDocument(): OpenDocument {
	return openDocumentOf(useStore.getState());
}

export function openDocument(document: EditorDocument, key: string | null) {
	useStore.getState().actions.openDocument(document, key);
}

export function closeDocument() {
	useStore.getState().actions.closeDocument();
}
