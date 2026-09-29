import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { type EditorDocument, hasEdits } from "@/model/document";
import { projects } from "./projectService";

/**
 * Saves the open project once edits pause, and right away when the app
 * leaves the foreground, since it may not come back. With no project `id`,
 * nothing is saved; on web, leaving the page with edits still asks first.
 */
export function useAutosave(
	id: string | null,
	document: EditorDocument | null,
	latestDocument?: () => EditorDocument | null,
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
				// Read the latest document: React's autosave effect may not run for
				// it before suspension.
				const latest = latestDocument?.();
				if (id && latest) projects.queueAutosave(id, latest);
				projects.flushAutosave();
			} else if (projects.getAutosaveError()) {
				projects.flushAutosave();
			}
		});
		return () => subscription.remove();
	}, [id, latestDocument]);

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
