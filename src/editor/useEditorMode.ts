import { useReducer } from "react";
import {
	type EditorModeAction,
	type EditorModeState,
	editorModeReducer,
	initialEditorMode,
	type ModeTargets,
	settle,
} from "./editorMode";
import type { ToolSpecs } from "./toolSpec";

/**
 * The editor's mode (see `EditorModeState`) for the tools in `specs`, which
 * must not change while it's mounted, settled against `targets` as it
 * renders. What's settled is kept, not only shown: a tool or picker whose
 * target went away stays closed if the target comes back.
 */
export function useEditorMode(targets: ModeTargets, specs: ToolSpecs) {
	const [state, dispatch] = useReducer(
		(current: EditorModeState, action: EditorModeAction) =>
			editorModeReducer(current, action, specs),
		initialEditorMode,
	);
	const settled = settle(state, targets, specs);
	if (settled !== state) dispatch({ type: "settle", targets });
	return [settled, dispatch] as const;
}
