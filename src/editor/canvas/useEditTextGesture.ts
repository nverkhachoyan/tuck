import {
	type TextSelection,
	useCanvasTextGesture,
} from "@tuck/skia-text-input";
import { useCallback } from "react";
import { type Point, toLayerSpace } from "../document/geometry";
import type { Layer } from "../layers/layer";
import { HIT_PADDING_PX } from "./layerTargets";
import { TAP_SLOP_PX } from "./strokeIntent";
import { type DocumentViewport, viewPointToDocument } from "./viewport";

/**
 * Text being edited in place on the canvas, as the tool editing it describes
 * it.
 * - `layer`: where it sits (its transform), and what's outlined.
 * - `text`: what's typed so far.
 * - `indexAt`: the index at `point`, in the layer's space, or null for a
 *   press off the text, `padding` beyond its box in the layer's units; a
 *   null `padding` clamps to the nearest index instead.
 * - `onSelect`: a press placed the caret, or selected.
 * - `onDone`: a tap off the text, to finish editing.
 */
export type EditText = {
	layer: Layer;
	text: string;
	indexAt: (point: Point, padding: number | null) => number | null;
	onSelect: (selection: TextSelection) => void;
	onDone: () => void;
};

const ignore = () => {};

/**
 * Presses on the canvas while text is edited in place (`useCanvasTextGesture`),
 * on the edited layer as the viewport shows it. A press counts as on the text
 * within the canvas's hit padding.
 */
export function useEditTextGesture({
	edit,
	viewport,
	onCursor,
	enabled = true,
}: {
	edit: EditText | null;
	viewport: DocumentViewport;
	onCursor: (cursor: "default" | "text") => void;
	enabled?: boolean;
}) {
	const { scale } = viewport;
	const toIndex = useCallback(
		(screenX: number, screenY: number, clamp: boolean) => {
			if (!edit || scale === 0) return null;
			const { transform } = edit.layer;
			const point = viewPointToDocument(viewport, { x: screenX, y: screenY });
			const padding = HIT_PADDING_PX / (scale * transform.scaleX);
			return edit.indexAt(
				toLayerSpace(transform, point),
				clamp ? null : padding,
			);
		},
		[edit, scale, viewport],
	);
	return useCanvasTextGesture({
		text: edit?.text ?? "",
		toIndex,
		onSelect: edit?.onSelect ?? ignore,
		onDone: edit?.onDone ?? ignore,
		onCursor,
		tapSlop: TAP_SLOP_PX,
		enabled: enabled && Boolean(edit),
	});
}
