import { Alert, type AlertButton } from "react-native";

/**
 * `Alert.alert`, with a web counterpart in `showAlert.web.tsx`. A `.tsx`
 * file, though it has no JSX, so Metro prefers the web one: see AGENTS.md.
 */
export function showAlert(
	title: string,
	message?: string,
	buttons?: AlertButton[],
) {
	Alert.alert(title, message, buttons);
}
