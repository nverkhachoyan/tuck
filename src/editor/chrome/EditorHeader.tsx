import type { ReactNode } from "react";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { RAIL_INSET } from "./useEditorLayout";

/**
 * The editor's header. Back and Export stay through every tool and while
 * typing: leaving keeps the changes, as the browser's own Back does.
 * - `bar`: the open tool's context bar, on a wide screen.
 * - `title`, `saved`: what the app calls the document, and whether it's
 *   kept, shown only on a wide screen with no bar, where there's room
 *   between Back and the actions.
 */
export function EditorHeader({
	wide,
	title,
	saved,
	onBack,
	bar,
	children,
}: {
	wide: boolean;
	title: string;
	saved: boolean;
	onBack: () => void;
	bar?: ReactNode;
	children: ReactNode;
}) {
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
