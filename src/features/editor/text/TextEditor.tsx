import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import {
	BackHandler,
	Platform,
	StyleSheet,
	TextInput,
	type TextStyle,
	View,
} from "react-native";
import type { TextSelection } from "@/layers/textEditing";
import { colorScheme, HEADER_HEIGHT } from "@/theme";

export type TextEditorHandle = {
	// Takes the keyboard back, keeping the caret where it was.
	focus: () => void;
	// Moves the caret, or selects, and takes the keyboard.
	select: (selection: TextSelection) => void;
};

type TextEditorProps = {
	ref?: Ref<TextEditorHandle>;
	text: string;
	// Where the caret starts, once the input first has focus.
	initialSelection: TextSelection;
	onChangeText: (text: string) => void;
	onSelectionChange: (selection: TextSelection) => void;
	onFocusChange: (focused: boolean) => void;
	// Escape, ⌘/Ctrl+Enter, or Android's back button, as Done by the dock.
	onDone: () => void;
};

/**
 * Typing into text on the canvas, which draws it in place, caret and all
 * (see `TextEditState`). This is the input the keyboard types into, hidden
 * behind the screen's header, which stays in use: the canvas shows what it
 * holds exactly as the text will look, at its size, angle, and wrapping,
 * which no input could. Done is beside the dock, which rides the keyboard.
 */
export function TextEditor({
	ref,
	text,
	initialSelection,
	onChangeText,
	onSelectionChange,
	onFocusChange,
	onDone,
}: TextEditorProps) {
	const input = useRef<TextInput>(null);
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

	// Android's back button finishes editing rather than leaving the editor.
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
		<View style={styles.field}>
			<TextInput
				ref={input}
				value={text}
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
				keyboardAppearance={colorScheme}
				accessibilityLabel="Caption"
				style={styles.input}
			/>
		</View>
	);
}

// React Native Web's input is the DOM's own, which has no `setSelection`.
function setInputSelection(input: TextInput, { start, end }: TextSelection) {
	if (Platform.OS === "web") {
		(input as unknown as HTMLTextAreaElement).setSelectionRange(start, end);
	} else {
		input.setSelection(start, end);
	}
}

const styles = StyleSheet.create({
	// Where the header is, at the top, so focusing it never scrolls the
	// screen, and letting touches through to the header's buttons.
	field: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: HEADER_HEIGHT,
		pointerEvents: "none",
	},
	// Hidden, and out of the way of the header's buttons. At least 16px,
	// or Safari on iOS zooms the page into it. On web, lines only break
	// where the text does, so the arrow keys move up and down by those.
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
