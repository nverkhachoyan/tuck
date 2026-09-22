import { Alert, type AlertButton } from "react-native";

/** `Alert.alert`, with a web counterpart in `showAlert.web.ts`. */
export function showAlert(
	title: string,
	message?: string,
	buttons?: AlertButton[],
) {
	Alert.alert(title, message, buttons);
}
