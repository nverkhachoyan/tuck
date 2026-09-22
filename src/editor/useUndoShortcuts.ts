import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";

/**
 * Cmd/Ctrl+Z undoes, and Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y redoes, on web.
 * Only while the screen is focused, so they can't change the document from
 * Export, and only while `enabled`, so a text input can keep the browser's
 * own undo for typing.
 */
export function useUndoShortcuts({
	enabled,
	onUndo,
	onRedo,
}: {
	enabled: boolean;
	onUndo: () => void;
	onRedo: () => void;
}) {
	useFocusEffect(
		useCallback(() => {
			if (Platform.OS !== "web" || !enabled) return;
			const handleKeyDown = (event: KeyboardEvent) => {
				if (!(event.metaKey || event.ctrlKey)) return;
				const key = event.key.toLowerCase();
				if (key === "z" && !event.shiftKey) onUndo();
				else if ((key === "z" && event.shiftKey) || key === "y") onRedo();
				else return;
				event.preventDefault();
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [enabled, onUndo, onRedo]),
	);
}
