import { useEffect, useState } from "react";
import type { EditorDocument } from "@/model/document";
import { useStore } from "@/store";
import { layerKindName } from "./tools/layers/LayerRow";

// Long enough to read it and reach Undo, short enough not to linger.
const SHOWN_MS = 5000;

type Notice = { message: string; after: EditorDocument | null };

/**
 * Deleting a layer or a group of layers says so, with Undo. The note goes
 * once anything else changes the document, since Undo would then take back
 * that change instead, or after a few seconds.
 */
export function useDeleteNotice(document: EditorDocument) {
	const undo = useStore((state) => state.undo);
	const deleteLayer = useStore((state) => state.deleteLayer);
	const deleteLayerGroup = useStore((state) => state.deleteLayerGroup);
	const [notice, setNotice] = useState<Notice | null>(null);

	useEffect(() => {
		if (notice && document !== notice.after) setNotice(null);
	}, [document, notice]);

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), SHOWN_MS);
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
		undo: () => {
			undo();
			setNotice(null);
		},
	};
}
