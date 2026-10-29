import {
	Caret,
	clampSelection,
	HiddenTextInput,
	SelectionHighlight,
} from "@tuck/skia-text-input";
import { StyleSheet } from "react-native";
import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import { Group, Paint } from "react-native-skia";
import { TextLayerView } from "@/render/layers/TextLayerView";
import { textCaretRect, textSelectionRects } from "@/render/textLayerLayout";
import { colorScheme, colors, HEADER_HEIGHT } from "@/ui/theme";
import { SELECTION_HALO } from "../../canvas/SelectionOverlay";
import type { TextController } from "./useTextTool";

// Faint enough to read as a hint rather than text that's there.
const PLACEHOLDER_OPACITY = 0.45;

/**
 * Text being edited, in its layer's space: what's typed so far, with the
 * selection over it, or the caret, blinking while it holds still. Empty, it
 * shows the placeholder, faded, with the caret at its start.
 */
export function TextDraft({
	controller: text,
	viewScale,
}: {
	controller: TextController;
	viewScale: DerivedValue<number>;
}) {
	const { edit, shown } = text;
	// One screen pixel, across the layer, in its own units.
	const scaleX = edit?.layer.transform.scaleX ?? 1;
	const pixel = useDerivedValue(
		() => 1 / (viewScale.value * scaleX),
		[viewScale, scaleX],
	);
	if (!edit || !shown) return null;
	const { layer, focused } = edit;
	const selection = clampSelection(edit.selection, layer.text.length);
	const collapsed = selection.start === selection.end;
	return (
		<>
			{shown === layer ? (
				<TextLayerView layer={layer} />
			) : (
				// A layer, faded as a whole: a paragraph keeps its own paints, which
				// a group's opacity doesn't reach.
				<Group layer={<Paint opacity={PLACEHOLDER_OPACITY} />}>
					<TextLayerView layer={shown} />
				</Group>
			)}
			{!collapsed && (
				<SelectionHighlight rects={textSelectionRects(layer, selection)} />
			)}
			{focused && collapsed && (
				<Caret
					rect={textCaretRect(shown, selection.start)}
					pixel={pixel}
					color={colors.selection}
					haloColor={SELECTION_HALO}
					key={`${selection.start}:${layer.text}`}
				/>
			)}
		</>
	);
}

/**
 * The input that takes the keyboard while text is typed, behind the header,
 * which stays in use, so focusing it never scrolls the screen.
 */
export function TextInput({
	controller: text,
}: {
	controller: TextController;
}) {
	const { edit } = text;
	if (!edit) return null;
	return (
		<HiddenTextInput
			ref={text.inputRef}
			value={edit.layer.text}
			initialSelection={edit.initialSelection}
			onChangeText={text.changeText}
			onSelectionChange={text.changeSelection}
			onFocusChange={text.changeFocus}
			onDone={text.finish}
			style={styles.input}
			keyboardAppearance={colorScheme}
			accessibilityLabel="Caption"
		/>
	);
}

const styles = StyleSheet.create({
	input: {
		height: HEADER_HEIGHT,
	},
});
