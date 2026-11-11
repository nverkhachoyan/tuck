import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
	Platform,
	StyleSheet,
	TextInput,
	type TextInputInstance,
	type TextStyle,
} from "react-native";
import { NAME_MAX_LENGTH, projectName } from "@/projects/projectFile";
import { colors, radii, typography } from "@/ui/theme";

// Browsers ring a focused field in their own blue; the field's own border
// shows focus instead.
const fieldFocusStyle =
	Platform.OS === "web"
		? ({ outlineStyle: "none" } as unknown as TextStyle)
		: null;

/**
 * Leaving the field, or Return, renames it, and Escape puts the name back.
 * A blank name lists the project by its text again.
 */
export function NameField({
	inputRef,
	label,
	disabled,
	autoFocus = false,
	onRename,
	onDone,
}: {
	inputRef: RefObject<TextInputInstance | null>;
	label: string;
	disabled: boolean;
	autoFocus?: boolean;
	onRename: (name: string) => void;
	onDone: () => void;
}) {
	// What's typed, while the field has focus.
	const [draft, setDraft] = useState<string | null>(null);
	const [focused, setFocused] = useState(false);
	const draftRef = useRef<string | null>(null);
	const cancelled = useRef(false);
	const labelRef = useRef(label);
	labelRef.current = label;
	const onRenameRef = useRef(onRename);
	onRenameRef.current = onRename;

	useEffect(() => {
		if (!autoFocus) return;
		const frame = requestAnimationFrame(() => {
			const node = inputRef.current;
			if (!node) return;
			node.focus();
			if (Platform.OS === "web") {
				(node as unknown as HTMLInputElement).setSelectionRange?.(
					0,
					labelRef.current.length,
				);
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [autoFocus, inputRef]);

	// Commits an unblurred edit if Home's Done unmounts the field directly.
	useEffect(() => {
		return () => {
			const typed = draftRef.current;
			draftRef.current = null;
			if (cancelled.current) return;
			if (typed !== null && projectName(typed) !== labelRef.current) {
				onRenameRef.current(typed);
			}
		};
	}, []);

	const finish = () => {
		const typed = draftRef.current;
		draftRef.current = null;
		setDraft(null);
		setFocused(false);
		onDone();
		if (cancelled.current) {
			cancelled.current = false;
			return;
		}
		if (typed !== null && projectName(typed) !== label) onRename(typed);
	};

	return (
		<TextInput
			ref={inputRef}
			value={draft ?? label}
			editable={!disabled}
			hitSlop={8}
			onFocus={() => {
				setFocused(true);
				draftRef.current = label;
				setDraft(label);
				if (Platform.OS !== "web") {
					inputRef.current?.setSelection(0, label.length);
				} else {
					(
						inputRef.current as unknown as HTMLInputElement | null
					)?.setSelectionRange?.(0, label.length);
				}
			}}
			onChangeText={(next) => {
				draftRef.current = next;
				setDraft(next);
			}}
			onSubmitEditing={() => inputRef.current?.blur()}
			onBlur={finish}
			onKeyPress={(event) => {
				if (event.nativeEvent.key !== "Escape") return;
				cancelled.current = true;
				inputRef.current?.blur();
			}}
			selectTextOnFocus
			maxLength={NAME_MAX_LENGTH}
			returnKeyType="done"
			autoCorrect={false}
			accessibilityLabel={`Project name, ${label}`}
			style={[
				styles.label,
				styles.nameField,
				focused && styles.nameFieldFocused,
				fieldFocusStyle,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	label: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	nameField: {
		height: 30,
		marginHorizontal: -2,
		paddingHorizontal: 8,
		// Android pads a TextInput vertically, which cuts the text at this height.
		paddingVertical: 0,
		borderRadius: radii.small,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	nameFieldFocused: {
		borderWidth: 2,
		borderColor: colors.textPrimary,
		paddingHorizontal: 7,
	},
});
