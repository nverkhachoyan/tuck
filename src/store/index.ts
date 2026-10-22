import { Platform } from "react-native";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
	createEditorSlice,
	type EditorSlice,
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedShape,
	selectSelectedTextLayer,
} from "./editorSlice";

export {
	type EditorSlice,
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
	selectSelectedRedaction,
	selectSelectedShape,
	selectSelectedTextLayer,
};

export type StoreState = EditorSlice;

export const useStore = create<StoreState>()(
	devtools(
		(...args) => ({
			...createEditorSlice(...args),
		}),
		// The Redux DevTools extension only exists in a desktop browser.
		{ name: "Tuck", enabled: __DEV__ && Platform.OS === "web" },
	),
);
