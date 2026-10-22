/**
 * Where an editing session that couldn't be saved lives in the URL. No saved
 * project has this id: theirs always hold a dash.
 */
export const UNSAVED_PROJECT = "unsaved";

/** The id a project's routes use: its own, or `UNSAVED_PROJECT` for none. */
export function projectRouteId(projectId: string | null): string {
	return projectId ?? UNSAVED_PROJECT;
}

export function editorHref(projectId: string | null) {
	return {
		pathname: "/projects/[id]",
		params: { id: projectRouteId(projectId) },
	} as const;
}

export function exportHref(projectId: string | null) {
	return {
		pathname: "/projects/[id]/export",
		params: { id: projectRouteId(projectId) },
	} as const;
}
