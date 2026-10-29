import { createDocumentFromImage } from "@src/editor/document/document.ts";
import {
	createEditorSlice,
	type EditorSlice,
} from "@src/editor/store/editorSlice.ts";
import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

/** One call to the store's `set`, named as Redux DevTools would show it. */
export type ActionRecord = {
	id: number;
	action: string;
	before: EditorSlice;
	after: EditorSlice;
};

let nextRecord = 0;

/**
 * The app's real editor slice in a store of its own, built as its tests
 * build one, with a photo open. Every `set` the slice makes is reported to
 * `onAction` with the action name it passes, which the app sends to Redux
 * DevTools.
 */
export function createLessonStore(onAction: (record: ActionRecord) => void) {
	// Opening the photo isn't the reader's action, and happens while a
	// component is still rendering, where it mustn't set state.
	let reporting = false;
	const store = createStore<EditorSlice>()(
		devtools(
			(set, get, api) => {
				const recordingSet = ((partial, replace, action) => {
					const before = get();
					set(partial as never, replace as never, action);
					if (!reporting) return;
					onAction({
						id: nextRecord++,
						action:
							typeof action === "string" ? action : (action?.type ?? "set"),
						before,
						after: get(),
					});
				}) as typeof set;
				return createEditorSlice(recordingSet, get, api);
			},
			{ enabled: false },
		),
	);
	store
		.getState()
		.actions.openDocument(
			createDocumentFromImage("photo.jpg", 1200, 900, true),
			"lesson",
		);
	reporting = true;
	return store;
}

export type LessonStore = ReturnType<typeof createLessonStore>;

/** What an action did to the history, in words. */
export function historyEffect({ action, before, after }: ActionRecord): string {
	if (action === "editor/undo") return "stepped back";
	if (action === "editor/redo") return "stepped forward";
	if (action === "editor/beginSession") return "marked where the tool started";
	if (action === "editor/commitSession") {
		return after.past === before.past
			? "nothing changed in the tool"
			: "squashed into one step";
	}
	if (action === "editor/cancelSession") {
		return after.document === before.document
			? "nothing to cancel"
			: "back to where the tool started";
	}
	if (after.document === before.document) return "no change to the document";
	if (after.past.length > before.past.length) return "new undo step";
	if (after.past.length === before.past.length && before.past.length > 0) {
		return "joined the last step";
	}
	return "new undo step";
}
