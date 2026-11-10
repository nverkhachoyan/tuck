import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	closeDocument,
	getSession,
	openDocument,
	renderThumbnail,
	useSession,
} from "@/editor";
import type { EditorDocument } from "@/editor/core";
import { getPreviewUri } from "@/photos/previewCache";
import { deleteTemporaryFile } from "@/platform/temporaryFile";
import { isProjectOpenElsewhere } from "@/projects/projectLifecycle";
import { projectRouteId } from "@/projects/projectRoute";
import { projects } from "@/projects/projectService";
import { errorMessage } from "@/ui/errorMessage";
import { createProjectSession } from "./projectSession";

/** The app's one project session controller, shared by every screen. */
export const projectSession = createProjectSession({
	projects,
	editor: { getSession, openDocument, closeDocument },
	renderThumbnail,
	getPreviewUri,
	deleteTemporaryFile,
});

export const {
	hasOpenSession,
	hasSavedSession,
	startFromPhoto,
	startBlank,
	open: openProjectSession,
	openCopy: openProjectCopy,
	end: endSession,
	updateThumbnail: updateProjectThumbnail,
	addImage: addSessionImage,
	title: sessionTitle,
} = projectSession;

/** Reads the open document outside React renders, as when the app backgrounds. */
export const latestSessionDocument = () => getSession().document;

/** The project id of the open session, or null for an unsaved session. */
export function useSessionProjectId(): string | null {
	return useSession((session) => session.key);
}

/** The open document when its route id matches `routeId`, or null otherwise. */
export function useRouteDocument(routeId: string): EditorDocument | null {
	return useSession((session) =>
		session.document !== null && projectRouteId(session.key) === routeId
			? session.document
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
		void openProjectSession(routeId, () => wanted.current)
			.catch((error: unknown) => {
				setFailure({
					routeId,
					message: errorMessage(error),
					openElsewhere: isProjectOpenElsewhere(error),
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
			retry,
		};
	}
	return { status: "opening" };
}
