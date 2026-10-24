import { Platform } from "react-native";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createEditorSlice, type EditorSlice } from "./editorSlice";

export const useStore = create<EditorSlice>()(
	devtools(
		(...args) => ({
			...createEditorSlice(...args),
		}),
		// The Redux DevTools extension only exists in a desktop browser.
		{ name: "Tuck", enabled: __DEV__ && Platform.OS === "web" },
	),
);
