import type { AlertButton } from "react-native";

/**
 * React Native Web's `Alert.alert` does nothing, so errors would vanish and a
 * prompt guarding navigation would block it forever. The browser's own
 * dialogs stand in: a cancel button plus an action becomes `confirm`, and
 * anything else an `alert`. Only the first non-cancel button is offered.
 */
export function showAlert(
	title: string,
	message?: string,
	buttons: AlertButton[] = [],
) {
	const text = message ? `${title}\n\n${message}` : title;
	const cancel = buttons.find((button) => button.style === "cancel");
	const action = buttons.find((button) => button.style !== "cancel");

	if (cancel && action) {
		(window.confirm(text) ? action : cancel).onPress?.();
		return;
	}
	window.alert(text);
	(action ?? cancel)?.onPress?.();
}
