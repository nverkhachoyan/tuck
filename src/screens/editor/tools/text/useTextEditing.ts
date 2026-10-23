import { useRef } from "react";
import { Platform } from "react-native";
import {
	createTextLayer,
	type EditorDocument,
	type TextLayer,
	type TextLayerEdit,
} from "@/model/document";
import type { Rect } from "@/model/geometry";
import type { TextSelection } from "@/model/textEditing";
import { usePreference } from "@/platform/usePreference";
import { selectSelectedTextLayer, useStore } from "@/store";
import type { EditorModeAction, TextEditState } from "../../editorMode";
import type { TextEditorHandle } from "./TextEditor";
import { parseTextStyle, withTextEdit } from "./textSettings";

// Text being typed on the canvas: a new layer, added once editing ends, or
// the selected one, changed then. What's typed and restyled meanwhile stays
// here, so the whole edit is one undo step. New text is placed in `area`,
// the part of the photo in view when it began.
export type TextEditing = TextEditState & {
	initialSelection: TextSelection;
	area?: Rect;
};

/**
 * Typing on the canvas. The edit is the editor mode's (`edit`, changed
 * through `dispatchMode`); this starts it, for new text or the selected
 * text, restyles it, and finishes it into the document.
 */
export function useTextEditing({
	document,
	edit,
	dispatchMode,
}: {
	document: EditorDocument;
	edit: TextEditing | null;
	dispatchMode: (action: EditorModeAction<TextEditing>) => void;
}) {
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const addTextLayer = useStore((state) => state.addTextLayer);
	const updateTextLayer = useStore((state) => state.updateTextLayer);
	const updateSelectedText = useStore((state) => state.updateSelectedText);
	const deleteLayer = useStore((state) => state.deleteLayer);
	// New text starts in the style text was last given.
	const [textStyle, setTextStyle] = usePreference("textStyle", parseTextStyle);
	const editorRef = useRef<TextEditorHandle>(null);
	// The text the dock styles: what's being typed, or else the selection.
	const styledText: TextLayer | undefined = edit?.layer ?? selectedTextLayer;

	const change = (change: Partial<TextEditState>) =>
		dispatchMode({
			type: "changeText",
			change: (current) => ({ ...current, ...change }),
		});
	const changeLayer = (patch: TextLayerEdit) =>
		dispatchMode({
			type: "changeText",
			change: (current) => ({
				...current,
				layer: { ...current.layer, ...patch },
			}),
		});

	const startNew = (area?: Rect) => {
		const start = { start: 0, end: 0 };
		dispatchMode({
			type: "startText",
			edit: {
				layer: createTextLayer(document, "", textStyle, area),
				isNew: true,
				selection: start,
				initialSelection: start,
				focused: false,
				area,
			},
		});
	};
	// With the caret at `index`, or the end.
	const editSelected = (index?: number) => {
		if (!selectedTextLayer) return;
		const at = index ?? selectedTextLayer.text.length;
		dispatchMode({
			type: "startText",
			edit: {
				layer: selectedTextLayer,
				isNew: false,
				selection: { start: at, end: at },
				initialSelection: { start: at, end: at },
				focused: false,
			},
		});
	};
	// Finishing with no text discards a new layer and deletes an existing one.
	const finish = () => {
		if (!edit) return;
		const { layer, isNew, area } = edit;
		const text = layer.text.trim();
		const { font, color, outlineColor, backgroundColor, align } = layer;
		const style = { font, color, outlineColor, backgroundColor, align };
		if (isNew) {
			if (text) addTextLayer(text, style, area);
		} else if (text) {
			updateTextLayer(layer.id, { text, ...style });
		} else {
			deleteLayer(layer.id);
		}
		dispatchMode({ type: "endText" });
	};
	// Restyles the text being typed, or else the selected text, and new text
	// starts in the same style. On web, the dock's buttons take focus from
	// the text being typed, so it takes the keyboard back.
	const style = (patch: TextLayerEdit) => {
		setTextStyle((current) => withTextEdit(current, patch));
		if (!edit) {
			updateSelectedText(patch);
			return;
		}
		changeLayer(patch);
		if (Platform.OS === "web") editorRef.current?.focus();
	};

	return {
		edit,
		editorRef,
		styledText,
		startNew,
		editSelected,
		finish,
		cancel: () => dispatchMode({ type: "endText" }),
		style,
		select: (selection: TextSelection) => {
			editorRef.current?.select(selection);
			change({ selection });
		},
		changeText: (text: string) => changeLayer({ text }),
		changeSelection: (selection: TextSelection) => change({ selection }),
		changeFocus: (focused: boolean) => change({ focused }),
	};
}
