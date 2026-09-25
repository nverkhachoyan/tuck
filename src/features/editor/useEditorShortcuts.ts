import { useFocusEffect } from "expo-router";
import { useCallback, useEffectEvent } from "react";
import { Platform } from "react-native";
import { type Shortcut, shortcutFor } from "./shortcuts";

/**
 * The editor's keyboard shortcuts on web (see `shortcutFor`). Only while
 * the screen is focused, so they can't change the document from Export, and
 * only while `enabled`, so a text input keeps its own keys. Keys typed into
 * any other field, like an alert's, are that field's too.
 *
 * `onShortcut` returns whether it acted. A key it didn't use keeps its
 * browser default (arrows scroll, for one), except with ⌘/Ctrl held: those
 * are the editor's either way, rather than bookmarking the page or going
 * back in history.
 */
export function useEditorShortcuts({
	enabled,
	onShortcut,
}: {
	enabled: boolean;
	onShortcut: (shortcut: Shortcut) => boolean;
}) {
	const handleShortcut = useEffectEvent(onShortcut);
	useFocusEffect(
		useCallback(() => {
			if (Platform.OS !== "web" || !enabled) return;
			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.isComposing || isEditable(event.target)) return;
				const shortcut = shortcutFor(event);
				if (!shortcut) return;
				if (handleShortcut(shortcut) || event.metaKey || event.ctrlKey) {
					event.preventDefault();
				}
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [enabled]),
	);
}

function isEditable(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.tagName === "SELECT")
	);
}
