import { useReducer } from "react";
import {
	type EditedText,
	editorModeReducer,
	initialEditorMode,
	type ModeTargets,
	settle,
} from "./editorMode";

/**
 * The editor's mode (see `EditorModeState`), settled against `targets` as
 * it renders. What's settled is kept, not only shown: a tool or picker whose
 * target went away stays closed if the target comes back.
 */
export function useEditorMode<TextEdit extends EditedText>(
	targets: ModeTargets,
) {
	const [state, dispatch] = useReducer(
		editorModeReducer<TextEdit>,
		initialEditorMode,
	);
	const settled = settle(state, targets);
	if (settled !== state) dispatch({ type: "settle", targets });
	return [settled, dispatch] as const;
}
