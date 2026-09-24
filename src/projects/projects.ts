import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { type EditorDocument, hasEdits } from "@/model/document";
import { createProjectLifecycle } from "./projectLifecycle";
import * as storage from "./projectStorage";

const projects = createProjectLifecycle(storage);

export const {
	createProject,
	createBlankProject,
	openProject,
	closeProject,
	deleteProject,
	listProjects,
} = projects;

/**
 * Saves the open project once edits pause, and right away when the app
 * leaves the foreground, since it may not come back. With no project `id`,
 * nothing is saved; on web, leaving the page with edits still asks first.
 */
export function useAutosave(
	id: string | null,
	document: EditorDocument | null,
	prepareForBackgroundSave?: () => EditorDocument | null,
) {
	const error = useSyncExternalStore(
		projects.subscribeAutosave,
		projects.getAutosaveError,
		projects.getAutosaveError,
	);

	useEffect(() => {
		if (!id || !document) return;
		projects.queueAutosave(id, document);
	}, [id, document]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active") {
				// Commit any canvas gesture first, then read the document that
				// commit wrote. React's autosave effect may not run before suspension.
				const latest = prepareForBackgroundSave?.();
				if (id && latest) projects.queueAutosave(id, latest);
				projects.flushAutosave();
			} else if (projects.getAutosaveError()) {
				projects.flushAutosave();
			}
		});
		return () => subscription.remove();
	}, [id, prepareForBackgroundSave]);

	useLayoutEffect(() => {
		if (Platform.OS !== "web" || !document) return;
		const warn = (event: BeforeUnloadEvent) => {
			const unsaved = id
				? projects.hasUnsavedChanges(id, document)
				: hasEdits(document);
			if (unsaved) event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [id, document]);

	return { error, retry: projects.flushAutosave };
}
