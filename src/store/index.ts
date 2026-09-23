import { Platform } from "react-native";
import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { createEditorSlice, type EditorSlice } from "./editorSlice";

export type StoreState = EditorSlice;

export type SliceCreator<Slice> = StateCreator<
	StoreState,
	[["zustand/devtools", never]],
	[],
	Slice
>;

export const useStore = create<StoreState>()(
	devtools(
		(...args) => ({
			...createEditorSlice(...args),
		}),
		// The Redux DevTools extension only exists in a desktop browser.
		{ name: "Tuck", enabled: __DEV__ && Platform.OS === "web" },
	),
);
