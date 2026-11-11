import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getOpenDocument, useOpenDocument } from "@/editor";
import type { EditorDocument } from "@/editor/core";
import {
	isProjectOpenElsewhere,
	PROJECT_GONE_MESSAGE,
} from "@/projects/openProjects";
import { projectRouteId } from "@/projects/projectRoute";
import { errorMessage } from "@/ui/errorMessage";
import { appSession } from "./appSession";

/** Reads the open document outside React renders, as when the app backgrounds. */
export const latestSessionDocument = (): EditorDocument | null =>
	getOpenDocument().document;

/** The open session's key (project id), or null for an unsaved session / none. */
export const openSessionKey = (): string | null => getOpenDocument().key;

/** The project id of the open session, or null for an unsaved session. */
export function useSessionProjectId(): string | null {
	return useOpenDocument((openDoc) => openDoc.key);
}

/** Whether a document is open in the editor. */
export function useHasOpenSession(): boolean {
	return useOpenDocument((openDoc) => openDoc.document !== null);
}

/** The open document when its route id matches `routeId`, or null otherwise. */
export function useRouteDocument(routeId: string): EditorDocument | null {
	return useOpenDocument((openDoc) =>
		openDoc.document !== null && projectRouteId(openDoc.key) === routeId
			? openDoc.document
			: null,
	);
}

type ProjectSession =
	| { status: "open"; document: EditorDocument }
	| { status: "opening" }
	| {
			status: "failed";
			message: string;
			openElsewhere: boolean;
			// Not saved, as a photo opened and left unedited isn't, or deleted:
			// trying again can't help.
			gone: boolean;
			retry: () => void;
	  };

/**
 * The editing session a project route shows. Usually the screen that led here
 * opened it already; otherwise, as for a link, a reload, or the browser's
 * Forward, this opens the project, first ending any other session the editor
 * holds. Only while the route is in front: one left behind in the stack for
 * another project waits until the user comes back to it.
 */
export function useProjectSession(routeId: string): ProjectSession {
	const document = useRouteDocument(routeId);
	const focused = useIsFocused();
	const [failure, setFailure] = useState<{
		routeId: string;
		message: string;
		openElsewhere: boolean;
		gone: boolean;
	} | null>(null);
	const failed = failure?.routeId === routeId ? failure : null;
	// Set at once, so a render before the project opens can't open it again.
	const opening = useRef(false);
	// Whether an opened project is still wanted here once it's read.
	const wanted = useRef(focused);

	useEffect(() => {
		wanted.current = focused;
		return () => {
			wanted.current = false;
		};
	}, [focused]);

	useEffect(() => {
		if (document || !focused || failed || opening.current) return;
		opening.current = true;
		void appSession
			.open(routeId, () => wanted.current)
			.catch((error: unknown) => {
				const message = errorMessage(error);
				setFailure({
					routeId,
					message,
					openElsewhere: isProjectOpenElsewhere(error),
					gone: message === PROJECT_GONE_MESSAGE,
				});
			})
			.finally(() => {
				opening.current = false;
			});
	}, [document, focused, failed, routeId]);

	const retry = useCallback(() => setFailure(null), []);

	if (document) return { status: "open", document };
	if (failed) {
		return {
			status: "failed",
			message: failed.message,
			openElsewhere: failed.openElsewhere,
			gone: failed.gone,
			retry,
		};
	}
	return { status: "opening" };
}
