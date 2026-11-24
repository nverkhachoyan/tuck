import type { EditorDocument } from "../document/document";
import { drawingPieces } from "../layers/drawing/drawingEdits";
import type { Layer } from "../layers/layer";
import { canArrangeLayers } from "../layers/layerEdits";
import { useStore } from "../store";
import {
	type ArrangeMove,
	SelectionBar,
	SelectionBarItems,
} from "./SelectionBar";

/**
 * Moving the selected layers in the stack (`arrange`), and whether they can
 * move forward or backward while keeping locked layers fixed.
 */
export function useArrangeSelected(
	document: EditorDocument,
	selectedLayers: readonly Layer[],
) {
	const { arrangeSelectedLayers } = useStore((state) => state.actions);
	const ids = selectedLayers.map((layer) => layer.id);
	return {
		canMoveForward: canArrangeLayers(document.layers, ids, "forward"),
		canMoveBackward: canArrangeLayers(document.layers, ids, "backward"),
		arrange: arrangeSelectedLayers,
	};
}

/**
 * The selection bar for the selected `layers`: Edit for a single layer a tool
 * edits in place (`onEdit`), Free resize for a single text or image, Separate
 * for a single unlocked drawing in pieces, and Arrange, Duplicate, and Delete
 * for one or several. `inBar` gives the wide header's group instead of the bar
 * that floats by the selection.
 */
export function LayerSelectionBar({
	layers,
	inBar = false,
	canMoveForward,
	canMoveBackward,
	onEdit,
	onSetResizable,
	onArrange,
	onDuplicate,
	onDelete,
}: {
	layers: readonly Layer[];
	inBar?: boolean;
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onEdit?: () => void;
	onSetResizable: (id: string, resizable: boolean) => void;
	onArrange: (move: ArrangeMove) => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	const { separateSelectedDrawing } = useStore((state) => state.actions);
	const single = layers.length === 1 ? layers[0] : undefined;
	const resizable =
		single !== undefined &&
		(single.type === "text" || (single.type === "image" && !single.sticker));
	const inPieces =
		single?.type === "drawing" &&
		!single.locked &&
		drawingPieces(single).length > 1;
	const actions = {
		canMoveForward,
		canMoveBackward,
		onEdit: single ? onEdit : undefined,
		stretched: single?.resizable === true,
		onToggleStretch:
			single && resizable
				? () => onSetResizable(single.id, !single.resizable)
				: undefined,
		onSeparate: inPieces ? separateSelectedDrawing : undefined,
		onArrange,
		onDuplicate,
		onDelete,
	};
	return inBar ? (
		<SelectionBarItems {...actions} />
	) : (
		<SelectionBar {...actions} />
	);
}
