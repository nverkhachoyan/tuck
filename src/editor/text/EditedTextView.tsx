import {
	Caret,
	clampSelection,
	SelectionHighlight,
} from "@tuck/skia-text-input";
import { useMemo } from "react";
import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import { Group, Paint } from "react-native-skia";
import { withPlaceholder } from "@/model/layers/text";
import { TextLayerView } from "@/render/layers/TextLayerView";
import { textCaretRect, textSelectionRects } from "@/render/textLayerLayout";
import { colors } from "@/ui/theme";
import { SELECTION_HALO } from "../canvas/SelectionOverlay";
import type { TextEditState } from "../editorMode";

// Faint enough to read as a hint rather than text that's there.
const PLACEHOLDER_OPACITY = 0.45;

/**
 * Text being edited, in its layer's space: what's typed so far, with the
 * selection over it, or the caret, blinking while it holds still. Empty, it
 * shows the placeholder, faded, with the caret at its start.
 */
export function EditedTextView({
	edit,
	viewScale,
}: {
	edit: TextEditState;
	viewScale: DerivedValue<number>;
}) {
	const { layer, focused } = edit;
	const shown = useMemo(() => withPlaceholder(layer), [layer]);
	const selection = clampSelection(edit.selection, layer.text.length);
	const collapsed = selection.start === selection.end;
	// One screen pixel, across the layer, in its own units.
	const { scaleX } = layer.transform;
	const pixel = useDerivedValue(
		() => 1 / (viewScale.value * scaleX),
		[viewScale, scaleX],
	);
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
