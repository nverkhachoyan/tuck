import {
	type TextSelection,
	useCanvasTextGesture,
} from "@tuck/skia-text-input";
import { useCallback } from "react";
import { hitTestBox, toLayerSpace } from "@/model/geometry";
import { textIndexAt } from "@/render/textLayerLayout";
import { layerBounds } from "../canvas/layerBounds";
import { HIT_PADDING_PX } from "../canvas/layerTargets";
import { TAP_SLOP_PX } from "../canvas/strokeIntent";
import { type DocumentViewport, viewPointToDocument } from "../canvas/viewport";
import type { TextEditState } from "../editorMode";

const ignore = () => {};

/**
 * Presses on the canvas while text is edited in place (`useCanvasTextGesture`),
 * on the edited layer as the viewport shows it. A press counts as on the text
 * within the layer's box and the canvas's hit padding.
 */
export function useTextEditGesture({
	edit,
	viewport,
	onSelect,
	onDone,
	onCursor,
}: {
	edit: TextEditState | null;
	viewport: DocumentViewport;
	onSelect?: (selection: TextSelection) => void;
	onDone?: () => void;
	onCursor: (cursor: "default" | "text") => void;
}) {
	const { scale } = viewport;
	const toIndex = useCallback(
		(screenX: number, screenY: number, clamp: boolean) => {
			if (!edit || scale === 0) return null;
			const { layer } = edit;
			const point = viewPointToDocument(viewport, { x: screenX, y: screenY });
			const padding = HIT_PADDING_PX / (scale * layer.transform.scaleX);
			if (
				!clamp &&
				!hitTestBox(layer.transform, layerBounds(layer, padding), point)
			) {
				return null;
			}
			return textIndexAt(layer, toLayerSpace(layer.transform, point));
		},
		[edit, scale, viewport],
	);
	return useCanvasTextGesture({
		text: edit?.layer.text ?? "",
		toIndex,
		onSelect: onSelect ?? ignore,
		onDone: onDone ?? ignore,
		onCursor,
		tapSlop: TAP_SLOP_PX,
	});
}
