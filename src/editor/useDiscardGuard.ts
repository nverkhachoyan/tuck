import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect } from "react";
import { Platform } from "react-native";
import { showAlert } from "@/lib/showAlert";

/**
 * Leaving the editor by any route (Back, iOS swipe, Android back) discards
 * the edits, so ask first while `hasEdits`. On web, a reload or closing the
 * tab also loses them, and no route is removed to catch it; the browser's
 * own leave-page prompt covers that.
 */
export function useDiscardGuard(hasEdits: boolean) {
	const navigation = useNavigation();
	usePreventRemove(hasEdits, ({ data }) => {
		showAlert("Discard edits?", "Your changes to this photo will be lost.", [
			{ text: "Keep Editing", style: "cancel" },
			{
				text: "Discard",
				style: "destructive",
				onPress: () => navigation.dispatch(data.action),
			},
		]);
	});

	useEffect(() => {
		if (Platform.OS !== "web" || !hasEdits) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [hasEdits]);
}
