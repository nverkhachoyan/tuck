import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import {
	BackHandler,
	Platform,
	Pressable,
	StyleSheet,
	TextInput,
	type TextStyle,
	View,
} from "react-native";
import type { TextSelection } from "@/layers/textEditing";
import type { TextAlign } from "@/model/document";
import { colors, HEADER_HEIGHT, webTransition } from "@/theme";
import { Button } from "@/ui/Button";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";

const NEXT_ALIGN: Record<TextAlign, TextAlign> = {
	center: "left",
	left: "right",
	right: "center",
};

export type TextEditorHandle = {
	// Takes the keyboard back, keeping the caret where it was.
	focus: () => void;
	// Moves the caret, or selects, and takes the keyboard.
	select: (selection: TextSelection) => void;
};

type TextEditorProps = {
	ref?: Ref<TextEditorHandle>;
	text: string;
	align: TextAlign;
	// Where the caret starts, once the input first has focus.
	initialSelection: TextSelection;
	onChangeText: (text: string) => void;
	onChangeAlign: (align: TextAlign) => void;
	onSelectionChange: (selection: TextSelection) => void;
	onFocusChange: (focused: boolean) => void;
	onDone: () => void;
};

/**
 * Typing into text on the canvas, which draws it in place, caret and all
 * (see `TextEditState`). This is the bar over the screen's header, with the
 * alignment and Done, and the input the keyboard types into, which is
 * hidden under the bar: the canvas shows what it holds exactly as the text
 * will look, at its size, angle, and wrapping, which no input could.
 *
 * On web, Escape or ⌘/Ctrl+Enter finishes, as Done does.
 */
export function TextEditor({
	ref,
	text,
	align,
	initialSelection,
	onChangeText,
	onChangeAlign,
	onSelectionChange,
	onFocusChange,
	onDone,
}: TextEditorProps) {
	const input = useRef<TextInput>(null);
	// The first focus, as it opens, places the caret.
	const placed = useRef(false);
	// Three bars alone read as a menu, so on web, hovering says what they do.
	const alignLabel = `Text alignment: ${align}`;
	const { anchor, tooltip } = useTooltip(alignLabel);

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
		<View style={styles.toolbar}>
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
				keyboardAppearance="dark"
				accessibilityLabel="Text"
				style={styles.input}
			/>
			<Pressable
				{...anchor}
				hitSlop={4}
				onPress={() => {
					onChangeAlign(NEXT_ALIGN[align]);
					// On web, the press took focus from the text.
					if (Platform.OS === "web") input.current?.focus();
				}}
				accessibilityRole="button"
				accessibilityLabel={alignLabel}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.alignButton,
						webTransition,
						hovered && styles.alignButtonHovered,
						pressed && styles.alignButtonPressed,
					];
				}}
			>
				<AlignIcon align={align} />
			</Pressable>
			{tooltip}
			<Button label="Done" variant="primary" size="small" onPress={onDone} />
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

/** Three bars aligned the way the text is. */
function AlignIcon({ align }: { align: TextAlign }) {
	const alignItems =
		align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
	return (
		<View style={[styles.alignIcon, { alignItems }]}>
			<View style={[styles.alignBar, { width: 22 }]} />
			<View style={[styles.alignBar, { width: 14 }]} />
			<View style={[styles.alignBar, { width: 18 }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	// Opaque, over the screen's header, whose actions wait until editing ends.
	toolbar: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: HEADER_HEIGHT,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		backgroundColor: colors.background,
	},
	// Hidden under the bar, and out of the way of its buttons. At least 16px,
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
	// A halo around the icon, overhanging so the bar keeps its spacing.
	alignButton: {
		width: 40,
		height: 40,
		margin: -9,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	alignButtonHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	alignButtonPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	alignIcon: {
		width: 22,
		gap: 4,
	},
	alignBar: {
		height: 2.5,
		borderRadius: 1.25,
		backgroundColor: colors.textPrimary,
	},
});
