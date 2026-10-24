import { useEffect, useState } from "react";
import type { EditorDocument } from "@/model/document";
import { useStore } from "@/store";
import type { DetectionFeature } from "./detection/imageDetection";
import { layerKindName } from "./tools/layers/LayerRow";

// Long enough to read it and reach Undo, short enough not to linger.
const SHOWN_MS = 5000;

type Notice = { message: string; after: EditorDocument | null };

/**
 * Deleting a layer or a group of layers, and redacting what Find found, say
 * so, with Undo. The note goes once anything else changes the document,
 * since Undo would then take back that change instead, or after a few
 * seconds.
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
		// Called once `count` regions are redacted, `feature` saying what they
		// are (null for both kinds).
		redacted: (count: number, feature: DetectionFeature | null) =>
			setNotice({
				message: `${count} ${regionsName(count, feature)} redacted`,
				after: useStore.getState().document,
			}),
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

function regionsName(count: number, feature: DetectionFeature | null) {
	const one = count === 1;
	if (feature === "faces") return one ? "face" : "faces";
	if (feature === "text") return one ? "text region" : "text regions";
	return one ? "region" : "regions";
}
