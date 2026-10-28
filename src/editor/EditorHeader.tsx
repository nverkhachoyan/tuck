import { type ReactNode, useMemo } from "react";
import type { EditorDocument } from "@/model/document";
import { projectLabel } from "@/projects/projectFile";
import {
	openProjectCreatedAt,
	openProjectName,
} from "@/projects/projectService";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { RAIL_INSET } from "./useEditorLayout";

/**
 * The editor's header. Back and Export stay through every tool and while
 * typing: leaving keeps the changes, as the browser's own Back does.
 * - `bar`: the open tool's context bar, on a wide screen.
 * - `projectId`, `document`, `saved`: the project's name, as home lists it,
 *   and whether it's kept, shown only on a wide screen with no bar, where
 *   there's room between Back and the actions.
 */
export function EditorHeader({
	wide,
	projectId,
	document,
	saved,
	onBack,
	bar,
	children,
}: {
	wide: boolean;
	projectId: string | null;
	document: EditorDocument;
	saved: boolean;
	onBack: () => void;
	bar?: ReactNode;
	children: ReactNode;
}) {
	const title = useMemo(
		() => projectTitle(projectId, document),
		[projectId, document],
	);
	const titled = wide && !bar;
	return (
		<ScreenHeader
			backLabel="Back to projects"
			// Over the rail's tools.
			backColumn={wide ? RAIL_INSET : undefined}
			onBack={onBack}
			title={titled ? title : undefined}
			subtitle={
				titled ? (saved ? "Saved on this device" : "Not saved") : undefined
			}
			bar={bar}
			action={children}
		/>
	);
}

/** What home lists the project as. */
function projectTitle(projectId: string | null, document: EditorDocument) {
	if (projectId === null) return projectLabel(document, Date.now());
	return (
		openProjectName(projectId) ||
		projectLabel(document, openProjectCreatedAt(projectId) ?? Date.now())
	);
}
