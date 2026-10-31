import type {
	HiddenTextInputHandle,
	TextSelection,
} from "@tuck/skia-text-input";
import { useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { usePreference } from "@/platform/usePreference";
import { layerBounds } from "../../canvas/layerBounds";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import type { Point, Rect } from "../../document/geometry";
import {
	createTextLayer,
	type TextLayer,
	type TextLayerEdit,
	withPlaceholder,
} from "../../layers/text/text";
import { textIndexAt } from "../../layers/text/textLayerLayout";
import { useStore } from "../../store";
import { selectSelectedTextLayer } from "../../store/editorSlice";
import {
	parseTextStyle,
	type TextColorKey,
	withTextEdit,
} from "./textSettings";

export type TextController = ReturnType<typeof useTextTool>;

/**
 * Text being edited in place: its layer as typed so far, which is drawn in
 * place of the document's (or on top when `isNew`: it's added once editing
 * ends), and its caret or selection. The caret shows while `focused`.
 */
export type TextEditState = {
	layer: TextLayer;
	isNew: boolean;
	selection: TextSelection;
	focused: boolean;
	// Where the caret starts, once the input first has focus.
	initialSelection: TextSelection;
	// New text is placed in `area`, the part of the photo in view when it began.
	area?: Rect;
};

/**
 * Typing on the canvas, and styling text. Text is open exactly while it's
 * typed: `startNew` and `startEditing` ready the edit before it opens, and
 * closing it any way but Done (`commit`) drops what's typed. What's typed
 * and restyled meanwhile stays on the edit, so the whole edit is one undo
 * step. With nothing typed, its panel styles the selected text.
 */
export function useTextTool({
	document,
	open,
	close,
	view,
}: Pick<ToolEnv, "document" | "open" | "close" | "view">) {
	const selectedTextLayer = useStore(selectSelectedTextLayer);
	const { addTextLayer, updateTextLayer, updateSelectedText, deleteLayer } =
		useStore((state) => state.actions);
	// New text starts in the style text was last given.
	const [textStyle, setTextStyle] = usePreference("textStyle", parseTextStyle);
	const inputRef = useRef<HiddenTextInputHandle>(null);
	const [edit, setEdit] = useState<TextEditState | null>(null);
	if (!open && edit) setEdit(null);
	// The text the panel styles: what's being typed, or else the selection.
	const styledText: TextLayer | undefined = edit?.layer ?? selectedTextLayer;
	// A picker for one of the styled text's colors. It closes, and stays
	// closed, once other text is styled.
	const [picker, setPicker] = useState<{
		layerId: string;
		key: TextColorKey;
	} | null>(null);
	if (picker && picker.layerId !== styledText?.id) setPicker(null);

	const change = (patch: Partial<TextEditState>) =>
		setEdit((current) => current && { ...current, ...patch });
	const changeLayer = (patch: TextLayerEdit) =>
		setEdit(
			(current) =>
				current && { ...current, layer: { ...current.layer, ...patch } },
		);

	const startNew = () => {
		const area = view.visibleArea();
		const start = { start: 0, end: 0 };
		setEdit({
			layer: createTextLayer(document, "", textStyle, area),
			isNew: true,
			selection: start,
			initialSelection: start,
			focused: false,
			area,
		});
	};
	// With the caret at `index`, or the end.
	const startEditing = (layer: TextLayer, index?: number) => {
		const at = index ?? layer.text.length;
		setEdit({
			layer,
			isNew: false,
			selection: { start: at, end: at },
			initialSelection: { start: at, end: at },
			focused: false,
		});
	};
	// Finishing with no text discards a new layer and deletes an existing one.
	const commit = () => {
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
		setEdit(null);
	};
	const finish = () => {
		commit();
		close();
	};
	// Restyles the text being typed, or else the selected text, and new text
	// starts in the same style. On web, the panel's buttons take focus from
	// the text being typed, so it takes the keyboard back.
	const style = (patch: TextLayerEdit) => {
		setTextStyle((current) => withTextEdit(current, patch));
		if (!edit) {
			updateSelectedText(patch);
			return;
		}
		changeLayer(patch);
		if (Platform.OS === "web") inputRef.current?.focus();
	};
	// Reported back through `changeSelection`.
	const select = (selection: TextSelection) =>
		inputRef.current?.select(selection);

	// Empty, the text is placed and outlined with its placeholder.
	const editedLayer = edit?.layer;
	const shown = useMemo(
		() => editedLayer && withPlaceholder(editedLayer),
		[editedLayer],
	);
	// The canvas's presses reach the latest `select` and `finish` without
	// changing its input on every render.
	const latest = useRef({ select, finish });
	latest.current = { select, finish };
	const canvasInput = useMemo(
		(): CanvasInput | null =>
			editedLayer && shown
				? {
						type: "editText",
						layer: shown,
						text: editedLayer.text,
						indexAt: (point, padding) =>
							textIndexIn(editedLayer, point, padding),
						onSelect: (selection) => latest.current.select(selection),
						onDone: () => latest.current.finish(),
					}
				: null,
		[editedLayer, shown],
	);

	return {
		edit,
		shown,
		inputRef,
		styledText,
		picker,
		startNew,
		startEditing,
		commit,
		finish,
		style,
		preview: edit ? changeLayer : undefined,
		select,
		canvasInput,
		openPicker: (key: TextColorKey) => {
			if (styledText) setPicker({ layerId: styledText.id, key });
			if (edit && Platform.OS === "web") inputRef.current?.focus();
		},
		closePicker: () => {
			setPicker(null);
			if (edit && Platform.OS === "web") inputRef.current?.focus();
		},
		changeText: (text: string) => changeLayer({ text }),
		changeSelection: (selection: TextSelection) => change({ selection }),
		changeFocus: (focused: boolean) => change({ focused }),
	};
}

/**
 * The index in `layer`'s text at `point`, in its space, or null off its box
 * and `padding`; a null `padding` takes the nearest index anywhere.
 */
function textIndexIn(
	layer: TextLayer,
	point: Point,
	padding: number | null,
): number | null {
	if (padding !== null) {
		const box = layerBounds(layer, padding);
		if (
			Math.abs(point.x) > box.halfWidth ||
			Math.abs(point.y) > box.halfHeight
		) {
			return null;
		}
	}
	return textIndexAt(layer, point);
}
