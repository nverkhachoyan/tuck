import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import type { EditorDocument } from "@/model/document";
import { useStore } from "@/store";
import type { RenderThumbnail } from "./projectLifecycle";
import { projectRouteId, UNSAVED_PROJECT } from "./projectRoute";
import { closeProject, openProject } from "./projectService";

export type ProjectSession =
	| { status: "open"; document: EditorDocument }
	| { status: "opening" }
	| { status: "failed"; message: string; retry: () => void };

/**
 * The editing session a project route shows. Usually the screen that led here
 * opened it already; otherwise, as for a link, a reload, or the browser's
 * Forward, this opens the project, first ending any other session the store
 * holds. Only while the route is in front: one left behind in the stack for
 * another project waits until the user comes back to it.
 */
export function useProjectSession(
	routeId: string,
	renderThumbnail: RenderThumbnail,
): ProjectSession {
	const document = useStore((state) =>
		state.document !== null && projectRouteId(state.projectId) === routeId
			? state.document
			: null,
	);
	const focused = useIsFocused();
	const [failure, setFailure] = useState<{
		routeId: string;
		message: string;
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
		void switchToProject(routeId, renderThumbnail, () => wanted.current)
			.catch((error: unknown) => {
				setFailure({ routeId, message: errorMessage(error) });
			})
			.finally(() => {
				opening.current = false;
			});
	}, [document, focused, failed, routeId, renderThumbnail]);

	const retry = useCallback(() => setFailure(null), []);

	if (document) return { status: "open", document };
	if (failed) return { status: "failed", message: failed.message, retry };
	return { status: "opening" };
}

async function switchToProject(
	routeId: string,
	renderThumbnail: RenderThumbnail,
	stillWanted: () => boolean,
) {
	if (routeId === UNSAVED_PROJECT) {
		throw new Error("This photo couldn't be saved, so it can't be reopened.");
	}

	const { document, projectId } = useStore.getState();
	if (document) {
		if (projectId !== null) {
			await closeProject(projectId, document, renderThumbnail);
		}
		// The home screen may have ended the same session meanwhile.
		if (useStore.getState().document === document) {
			useStore.getState().closeDocument();
		}
	}

	const opened = await openProject(routeId);
	if (!opened) {
		throw new Error("It may have been saved by a newer version of the app.");
	}
	// Left before it opened: close it again, rather than leave it open
	// behind the screen the user went to.
	if (!stillWanted() || useStore.getState().document) {
		await closeProject(routeId, opened);
		return;
	}
	useStore.getState().openDocument(opened, routeId);
}
