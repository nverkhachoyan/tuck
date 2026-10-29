import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import {
	BackHandler,
	Platform,
	type StyleProp,
	StyleSheet,
	TextInput,
	type TextInputInstance,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native";
import type { TextSelection } from "./selection.ts";

export type HiddenTextInputHandle = {
	// Takes the keyboard back, keeping the caret where it was.
	focus: () => void;
	// Moves the caret, or selects, and takes the keyboard.
	select: (selection: TextSelection) => void;
};

/**
 * The props of a `HiddenTextInput`.
 * - `value`: the text being edited.
 * - `initialSelection`: where the caret starts, once the input first has
 *   focus.
 * - `onChangeText`, `onSelectionChange`, `onFocusChange`: what the input
 *   reports, for the canvas to draw.
 * - `onDone`: Escape, ⌘/Ctrl+Enter, or Android's back button.
 * - `style`: where the input sits. It takes the screen's touches nowhere, but
 *   focusing it scrolls to it, so keep it where the screen won't scroll: by
 *   default the top 44 points.
 * - `keyboardAppearance` and `accessibilityLabel` pass through.
 */
export type HiddenTextInputProps = {
	ref?: Ref<HiddenTextInputHandle>;
	value: string;
	initialSelection: TextSelection;
	onChangeText: (text: string) => void;
	onSelectionChange: (selection: TextSelection) => void;
	onFocusChange: (focused: boolean) => void;
	onDone: () => void;
	style?: StyleProp<ViewStyle>;
	keyboardAppearance?: "default" | "light" | "dark";
	accessibilityLabel?: string;
};

/**
 * An input the keyboard types into, hidden: a canvas draws what it holds
 * exactly as the text will look, at its size, angle, and wrapping, which no
 * input could. It still does the typing, autocorrect, paste, and undo.
 */
export function HiddenTextInput({
	ref,
	value,
	initialSelection,
	onChangeText,
	onSelectionChange,
	onFocusChange,
	onDone,
	style,
	keyboardAppearance,
	accessibilityLabel = "Text",
}: HiddenTextInputProps) {
	const input = useRef<TextInputInstance>(null);
	// The first focus, as it opens, places the caret.
	const placed = useRef(false);

	useImperativeHandle(
		ref,
		() => ({
			focus: () => input.current?.focus(),
			select: (selection) => {
				placed.current = true;
				input.current?.focus();
				if (input.current) setInputSelection(input.current, selection);
			},
		}),
		[],
	);

	// Not `autoFocus`: on web, React focuses that while it can't report the
	// focus, and the caret would never be placed.
	useEffect(() => {
		input.current?.focus();
	}, []);

	// Android's back button finishes editing rather than leaving the screen.
	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				onDone();
				return true;
			},
		);
		return () => subscription.remove();
	}, [onDone]);

	return (
		<View style={[styles.field, style]}>
			<TextInput
				ref={input}
				value={value}
				onChangeText={onChangeText}
				onSelectionChange={(event) =>
					onSelectionChange(event.nativeEvent.selection)
				}
				onFocus={() => {
					onFocusChange(true);
					if (placed.current || !input.current) return;
					placed.current = true;
					setInputSelection(input.current, initialSelection);
				}}
				onBlur={() => onFocusChange(false)}
				onKeyPress={(event) => {
					const { key, metaKey, ctrlKey } =
						event.nativeEvent as typeof event.nativeEvent & {
							metaKey?: boolean;
							ctrlKey?: boolean;
						};
					if (key === "Escape" || (key === "Enter" && (metaKey || ctrlKey))) {
						event.preventDefault();
						onDone();
					}
				}}
				multiline
				keyboardAppearance={keyboardAppearance}
				accessibilityLabel={accessibilityLabel}
				style={styles.input}
			/>
		</View>
	);
}

// React Native Web's input is the DOM's own, which has no `setSelection`.
function setInputSelection(
	input: TextInputInstance,
	{ start, end }: TextSelection,
) {
	if (Platform.OS === "web") {
		(input as unknown as HTMLTextAreaElement).setSelectionRange(start, end);
	} else {
		input.setSelection(start, end);
	}
}

const styles = StyleSheet.create({
	field: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 44,
		pointerEvents: "none",
	},
	// Hidden, and out of the way of what's under it. At least 16px, or
	// Safari on iOS zooms the page into it. On web, lines only break where
	// the text does, so the arrow keys move up and down by those.
	input: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0,
		fontSize: 16,
		pointerEvents: "none",
		...Platform.select({
			web: { whiteSpace: "pre", overflow: "hidden" } as unknown as TextStyle,
		}),
	},
});
