import type { EditorDocument } from "./document/document";
import { useStore } from "./store";
import type { EditorState } from "./store/editorSlice";

/**
 * What the app sees of the editor's session: the document open in it, or
 * null, and the key the app opened it with.
 */
export type Session = Pick<EditorState, "document" | "key">;

export function useSession<T>(select: (session: Session) => T): T {
	return useStore(select);
}

// For a read outside React, or after an `await`.
export function getSession(): Session {
	return useStore.getState();
}

export function openDocument(document: EditorDocument, key: string | null) {
	useStore.getState().actions.openDocument(document, key);
}

export function closeDocument() {
	useStore.getState().actions.closeDocument();
}
