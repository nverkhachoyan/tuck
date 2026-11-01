import { useEffect, useState } from "react";
import type { NoticeAction } from "./defineTool";
import type { EditorDocument } from "./document/document";
import { layerKindName } from "./layers/panel/LayerRow";
import { useStore } from "./store";

// Long enough to read it and reach Undo, short enough not to linger. A
// note with a second action (Refine) stays up longer: deciding on it takes
// more than reaching for Undo.
const SHOWN_MS = 5000;
const ACTION_SHOWN_MS = 20000;

type Notice = {
	message: string;
	after: EditorDocument | null;
	action?: NoticeAction;
};

/**
 * Deleting a layer or a group of layers, and what a tool notifies (Find's
 * redaction), say so, with Undo, and the tool's own `action` if it gives one.
 * The note goes once anything else changes the document, since Undo would
 * then take back that change instead, after a few seconds, or once its
 * action is pressed. A note with a second action (Refine) stays up
 * longer, since deciding on it takes more than reaching for Undo.
 */
export function useEditNotice(document: EditorDocument) {
	const { undo, deleteLayer, deleteLayerGroup, beginSession, commitSession } =
		useStore((state) => state.actions);
	const [notice, setNotice] = useState<Notice | null>(null);

	useEffect(() => {
		if (notice && document !== notice.after) setNotice(null);
	}, [document, notice]);

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(
			() => setNotice(null),
			notice.action ? ACTION_SHOWN_MS : SHOWN_MS,
		);
		return () => clearTimeout(timer);
	}, [notice]);

	// Runs `remove`, then shows `message` if it changed the document.
	const deleted = (message: string, remove: () => void) => {
		const before = useStore.getState().document;
		remove();
		const after = useStore.getState().document;
		if (after !== before) setNotice({ message, after });
	};

	return {
		message: notice?.message ?? null,
		action: notice?.action && {
			label: notice.action.label,
			onPress: () => {
				setNotice(null);
				notice.action?.onPress();
			},
		},
		deleteLayer: (id: string) => {
			const layer = document.layers.find((candidate) => candidate.id === id);
			if (!layer) return;
			deleted(`${layerKindName(layer)} deleted`, () => deleteLayer(id));
		},
		deleteGroup: (id: string) => {
			const group = document.groups?.find((candidate) => candidate.id === id);
			if (!group) return;
			deleted(`${group.name} deleted`, () => deleteLayerGroup(id));
		},
		// Shows `message`, once a tool has changed the document.
		notify: (message: string, action?: NoticeAction) =>
			setNotice({ message, after: useStore.getState().document, action }),
		// A change made just before a tool opened (Find's redaction, as Redact
		// opens) sits before the new session's start, where Undo doesn't
		// reach. The session has no changes of its own while the note shows,
		// so it's closed for the Undo and opened again.
		undo: () => {
			const { session, document: current } = useStore.getState();
			if (session && session.document === current) {
				commitSession();
				undo();
				beginSession();
			} else {
				undo();
			}
			setNotice(null);
		},
	};
}
