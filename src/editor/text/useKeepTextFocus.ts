import { type RefObject, useEffect } from "react";
import { Platform, type ViewInstance } from "react-native";

/**
 * On web, a press on the canvas would take the focus, and with it the
 * keyboard, from the input typing into the edited text. The press places
 * its caret instead.
 */
export function useKeepTextFocus(
	containerRef: RefObject<ViewInstance | null>,
	editingText: boolean,
) {
	useEffect(() => {
		if (Platform.OS !== "web" || !editingText) return;
		const node = containerRef.current as unknown as HTMLElement | null;
		const keepFocus = (event: MouseEvent) => event.preventDefault();
		node?.addEventListener("mousedown", keepFocus);
		return () => node?.removeEventListener("mousedown", keepFocus);
	}, [containerRef, editingText]);
}
