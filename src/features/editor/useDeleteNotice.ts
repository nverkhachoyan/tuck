import { useEffect, useState } from "react";
import type { EditorDocument } from "@/model/document";
import { useStore } from "@/store";

// Long enough to read it and reach Undo, short enough not to linger.
const SHOWN_MS = 5000;

type Notice = { message: string; after: EditorDocument | null };

/**
 * Deleting a layer says so, with Undo. The note goes once anything else
 * changes the document, since Undo would then take back that change instead,
 * or after a few seconds.
 */
export function useDeleteNotice(document: EditorDocument) {
	const undo = useStore((state) => state.undo);
	const [notice, setNotice] = useState<Notice | null>(null);

	useEffect(() => {
		if (notice && document !== notice.after) setNotice(null);
	}, [document, notice]);

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), SHOWN_MS);
		return () => clearTimeout(timer);
	}, [notice]);

	return {
		message: notice?.message ?? null,
		// Runs `remove`, then shows `message` if it changed the document.
		deleted: (message: string, remove: () => void) => {
			const before = useStore.getState().document;
			remove();
			const after = useStore.getState().document;
			if (after !== before) setNotice({ message, after });
		},
		undo: () => {
			undo();
			setNotice(null);
		},
	};
}
